import express from "express";
import { createServer as createViteServer } from "vite";
import db from "./src/db.ts";
import { GoogleGenAI } from "@google/genai";

// --- Types ---
interface CurrencyRates {
  [key: string]: number;
}

const MOCK_RATES: CurrencyRates = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 150.5,
  CAD: 1.35
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // Get Financial Summary
  app.get("/api/finance/summary", (req, res) => {
    const user = db.prepare("SELECT monthly_burn, tax_rate, base_currency FROM users LIMIT 1").get() as any;
    const monthlyBurnUSD = user?.monthly_burn || 5000;
    const baseCurrency = user?.base_currency || 'EUR'; 
    const rate = MOCK_RATES[baseCurrency] || 1;

    const paidInvoices = db.prepare("SELECT SUM(amount) as total FROM invoices WHERE status = 'paid'").get() as any;
    const pendingInvoices = db.prepare("SELECT amount, currency, expected_cash_date FROM invoices WHERE status = 'pending'").all() as any[];
    
    const cashPaidUSD = paidInvoices.total || 0;
    
    // Calculate Pending Cash with 45-day lag and FX conversion
    let cashPendingHedgedUSD = 0;
    let cashPendingRawUSD = 0;
    const hedgingContracts = db.prepare("SELECT * FROM hedging_contracts").all() as any[];

    pendingInvoices.forEach(inv => {
      const invRate = MOCK_RATES[inv.currency] || 1;
      const amountUSD = inv.amount / invRate;
      cashPendingRawUSD += amountUSD;

      // Check if hedged
      const hedge = hedgingContracts.find(c => c.pair.includes(inv.currency));
      if (hedge) {
        cashPendingHedgedUSD += inv.amount * hedge.locked_rate;
      } else {
        cashPendingHedgedUSD += amountUSD;
      }
    });

    // --- 2026 Dutch Tax Logic (Box 1) ---
    const annualProfitEUR = (cashPaidUSD + cashPendingHedgedUSD) * (MOCK_RATES['EUR'] / MOCK_RATES['USD']);
    const zelfstandigenaftrek = 1270; // Updated to 2026 value from user prompt
    const taxableProfitStep1 = Math.max(0, annualProfitEUR - zelfstandigenaftrek);
    const mkbWinstvrijstelling = taxableProfitStep1 * 0.127;
    const taxableIncome = taxableProfitStep1 - mkbWinstvrijstelling;

    let taxDebt = 0;
    if (taxableIncome <= 38883) {
      taxDebt = taxableIncome * 0.3575;
    } else if (taxableIncome <= 78426) {
      taxDebt = (38883 * 0.3575) + (taxableIncome - 38883) * 0.3756;
    } else {
      taxDebt = (38883 * 0.3575) + (78426 - 38883) * 0.3756 + (taxableIncome - 78426) * 0.4950;
    }

    const zvwContribution = taxableIncome * 0.0485;
    const totalTaxReserveEUR = taxDebt + zvwContribution;

    res.json({
      cashPaid: cashPaidUSD * rate,
      cashPending: cashPendingHedgedUSD * rate,
      cashPendingRaw: cashPendingRawUSD * rate,
      monthlyBurn: monthlyBurnUSD * rate,
      baseCurrency,
      conversionRate: rate,
      escrowAmount: totalTaxReserveEUR * (rate / MOCK_RATES['EUR']),
      taxRate: totalTaxReserveEUR / annualProfitEUR,
      hedgingActive: hedgingContracts.length > 0,
      runwayMonths: (cashPaidUSD + cashPendingHedgedUSD) / monthlyBurnUSD,
      dutchTaxDetails: {
        annualProfitEUR,
        taxableIncome,
        taxDebt,
        zvwContribution,
        totalTaxReserveEUR
      }
    });
  });

  // Currency Converter API
  app.get("/api/currency/convert", (req, res) => {
    const { from, to, amount } = req.query;
    if (!from || !to || !amount) return res.status(400).json({ error: "Missing parameters" });
    
    const fromRate = MOCK_RATES[from as string];
    const toRate = MOCK_RATES[to as string];
    
    if (!fromRate || !toRate) return res.status(400).json({ error: "Unsupported currency" });
    
    const converted = (Number(amount) / fromRate) * toRate;
    res.json({ converted, rate: toRate / fromRate });
  });

  // Get Hedging Contracts
  app.get("/api/hedging/contracts", (req, res) => {
    const contracts = db.prepare("SELECT * FROM hedging_contracts").all();
    res.json(contracts);
  });

  // Add Hedging Contract
  app.post("/api/hedging/contracts", (req, res) => {
    const { pair, lockedRate, amount, expiryDate } = req.body;
    if (!pair || !lockedRate || !amount || !expiryDate) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    db.prepare("INSERT INTO hedging_contracts (pair, locked_rate, amount, expiry_date) VALUES (?, ?, ?, ?)").run(pair, lockedRate, amount, expiryDate);
    res.json({ message: "Contract added" });
  });

  // Delete Hedging Contract
  app.delete("/api/hedging/contracts/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM hedging_contracts WHERE id = ?").run(id);
    res.json({ message: "Contract deleted" });
  });

  // Mock Seasonality Forecast
  app.get("/api/forecast/seasonality", (req, res) => {
    const trends = db.prepare("SELECT * FROM market_trends ORDER BY id ASC").all() as any[];
    if (trends.length > 0) {
      return res.json(trends.map(t => ({
        month: t.month,
        intensity: t.hiring_trend,
        budgetMoment: t.budget_moment,
        description: t.description
      })));
    }

    // Fallback heuristic: Summer (July-Aug) and Winter (Dec) are "Dead Zones"
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const forecast = months.map((month, index) => {
      let intensity = 0.8 + Math.random() * 0.2; // Baseline
      if (index === 6 || index === 7 || index === 11) {
        intensity = 0.3 + Math.random() * 0.2; // Dead zone
      }
      return { month, intensity, budgetMoment: [0, 3, 9].includes(index) };
    });
    res.json(forecast);
  });

  // Get Market Trends
  app.get("/api/market/trends", (req, res) => {
    const trends = db.prepare("SELECT * FROM market_trends ORDER BY id ASC").all();
    res.json(trends);
  });

  // Get Leads
  app.get("/api/leads", (req, res) => {
    const leads = db.prepare("SELECT * FROM leads ORDER BY scouted_at DESC").all();
    res.json(leads);
  });

  // Get Pending Invoices
  app.get("/api/invoices/pending", (req, res) => {
    const invoices = db.prepare("SELECT * FROM invoices WHERE status = 'pending' ORDER BY expected_cash_date ASC").all();
    res.json(invoices);
  });

  // Get Wise Accounts
  app.get("/api/wise/accounts", (req, res) => {
    const accounts = db.prepare("SELECT * FROM wise_accounts").all();
    res.json(accounts);
  });

  // Decision Engine Advice (Gemini Powered)
  app.get("/api/strategic/advice", async (req, res) => {
    try {
      const pending = db.prepare("SELECT expected_cash_date, amount, currency FROM invoices WHERE status = 'pending'").all() as any[];
      const user = db.prepare("SELECT monthly_burn, base_currency FROM users LIMIT 1").get() as any;
      const trends = db.prepare("SELECT * FROM market_trends").all() as any[];
      const accounts = db.prepare("SELECT * FROM wise_accounts").all() as any[];

      const context = {
        pendingInvoices: pending,
        burnRate: user?.monthly_burn || 5000,
        baseCurrency: user?.base_currency || 'EUR',
        marketTrends: trends,
        accounts: accounts,
        currentDate: new Date().toISOString()
      };

      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set in environment variables.");
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are a financial advisor for a Dutch freelancer. 
        Analyze the following context and provide 3 strategic pieces of advice.
        Focus on:
        1. Cash flow forecasting (45-day lag from CAD to EUR).
        2. Hedging strategies for currency volatility.
        3. Hiring trends and budget moments (LinkedIn/Jobboard data).
        4. Tax compliance (2026 Dutch regulations).

        Context: ${JSON.stringify(context)}

        Return a JSON array of objects with the following structure:
        [{ "type": "growth" | "liquidity" | "info", "title": "...", "message": "..." }]`,
        config: {
          responseMimeType: "application/json"
        }
      });

      const advice = JSON.parse(response.text);
      res.json(advice);
    } catch (err) {
      console.error("Gemini Advice Error:", err);
      // Fallback advice
      res.json([
        {
          type: 'info',
          title: 'Steady State',
          message: 'Your 45-day lag is currently bridged by your Wise EUR reserves. Keep an eye on CAD/EUR volatility.'
        }
      ]);
    }
  });

  // --- Data Management Endpoints ---

  // Add Invoice
  app.post("/api/invoices", (req, res) => {
    const { amount, currency, status, issuedDate, expectedCashDate } = req.body;
    if (!amount || !currency || !status || !issuedDate || !expectedCashDate) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    db.prepare("INSERT INTO invoices (amount, currency, status, issued_date, expected_cash_date) VALUES (?, ?, ?, ?, ?)").run(amount, currency, status, issuedDate, expectedCashDate);
    res.json({ message: "Invoice added" });
  });

  // Delete Invoice
  app.delete("/api/invoices/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM invoices WHERE id = ?").run(id);
    res.json({ message: "Invoice deleted" });
  });

  // Add Wise Account
  app.post("/api/wise/accounts", (req, res) => {
    const { currency, balance, label, isJar } = req.body;
    if (!currency || balance === undefined || !label) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    db.prepare("INSERT INTO wise_accounts (currency, balance, label, is_jar) VALUES (?, ?, ?, ?)").run(currency, balance, label, isJar ? 1 : 0);
    res.json({ message: "Account added" });
  });

  // Delete Wise Account
  app.delete("/api/wise/accounts/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM wise_accounts WHERE id = ?").run(id);
    res.json({ message: "Account deleted" });
  });

  // Add Lead
  app.post("/api/leads", (req, res) => {
    const { company, role, status, scoutedAt, linkedinUrl } = req.body;
    if (!company || !role || !status || !scoutedAt) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    db.prepare("INSERT INTO leads (company, role, status, scouted_at, linkedin_url) VALUES (?, ?, ?, ?, ?)").run(company, role, status, scoutedAt, linkedinUrl);
    res.json({ message: "Lead added" });
  });

  // Delete Lead
  app.delete("/api/leads/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM leads WHERE id = ?").run(id);
    res.json({ message: "Lead deleted" });
  });

  // Get Burn History
  app.get("/api/finance/burn-history", (req, res) => {
    const user = db.prepare("SELECT base_currency FROM users LIMIT 1").get() as any;
    const baseCurrency = user?.base_currency || 'EUR';
    const rate = MOCK_RATES[baseCurrency] || 1;

    const history = db.prepare("SELECT month, amount FROM burn_history ORDER BY id ASC").all() as any[];
    const convertedHistory = history.map(h => ({
      month: h.month,
      amount: h.amount * rate
    }));
    res.json(convertedHistory);
  });

  // Update User Settings
  app.post("/api/user/settings", (req, res) => {
    const { monthlyBurn, baseCurrency } = req.body;
    
    // For demo, we just update the first user or create one if not exists
    const userExists = db.prepare("SELECT id FROM users LIMIT 1").get();
    if (userExists) {
      if (typeof monthlyBurn === 'number') {
        db.prepare("UPDATE users SET monthly_burn = ?").run(monthlyBurn);
      }
      if (baseCurrency) {
        db.prepare("UPDATE users SET base_currency = ?").run(baseCurrency);
      }
    } else {
      db.prepare("INSERT INTO users (email, monthly_burn, base_currency) VALUES (?, ?, ?)").run('user@example.com', monthlyBurn || 5000, baseCurrency || 'EUR');
    }
    
    res.json({ message: "Settings updated" });
  });

  // --- LinkedIn OAuth Routes ---

  const getRedirectUri = () => {
    const baseUrl = (process.env.APP_URL || "").replace(/\/$/, "");
    return `${baseUrl}/auth/linkedin/callback`;
  };

  app.get("/api/auth/linkedin/url", (req, res) => {
    const redirectUri = getRedirectUri();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: 'r_liteprofile r_emailaddress', // Use appropriate scopes for profile extraction
      state: 'random_state_string'
    });
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    res.json({ url: authUrl });
  });

  app.get("/auth/linkedin/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    const redirectUri = getRedirectUri();

    try {
      // 1. Exchange code for access token
      const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: redirectUri,
          client_id: process.env.LINKEDIN_CLIENT_ID!,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET!
        })
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        throw new Error(`LinkedIn Token Error: ${tokenRes.status} - ${errorText}`);
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // 2. Fetch Profile Data (Lite Profile)
      const profileRes = await fetch("https://api.linkedin.com/v2/me", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!profileRes.ok) {
        const errorText = await profileRes.text();
        throw new Error(`LinkedIn Profile Error: ${profileRes.status} - ${errorText}`);
      }

      const profileData = await profileRes.json();

      // 3. Store in DB (For demo, we update the first user)
      const name = `${profileData.localizedFirstName} ${profileData.localizedLastName}`;
      const headline = "Freelancer extracted from LinkedIn"; // Headline might need different scope/endpoint

      db.prepare(`
        UPDATE users SET 
          linkedin_id = ?, 
          linkedin_name = ?, 
          linkedin_headline = ?,
          linkedin_access_token = ?
        WHERE id = (SELECT id FROM users LIMIT 1)
      `).run(profileData.id, name, headline, accessToken);

      res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f4f4f9;">
            <div style="text-align: center; padding: 2rem; background: white; border-radius: 1rem; shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #0A66C2;">LinkedIn Connected!</h2>
              <p>You can close this window now.</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'LINKEDIN_AUTH_SUCCESS' }, '*');
                  setTimeout(() => window.close(), 1000);
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (err) {
      console.error("LinkedIn Auth Error:", err);
      res.status(500).send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fff5f5;">
            <div style="text-align: center; padding: 2rem; background: white; border-radius: 1rem; border: 1px solid #feb2b2;">
              <h2 style="color: #c53030;">Authentication Failed</h2>
              <p>Something went wrong during the LinkedIn connection.</p>
              <button onclick="window.close()" style="padding: 0.5rem 1rem; background: #c53030; color: white; border: none; border-radius: 0.5rem; cursor: pointer;">Close Window</button>
            </div>
          </body>
        </html>
      `);
    }
  });

  app.delete("/api/auth/linkedin", (req, res) => {
    db.prepare(`
      UPDATE users SET 
        linkedin_id = NULL, 
        linkedin_name = NULL, 
        linkedin_headline = NULL,
        linkedin_summary = NULL,
        linkedin_profile_url = NULL,
        linkedin_access_token = NULL,
        linkedin_refresh_token = NULL
      WHERE id = (SELECT id FROM users LIMIT 1)
    `).run();
    res.json({ message: "LinkedIn disconnected" });
  });

  app.get("/api/user/profile", (req, res) => {
    const profile = db.prepare("SELECT linkedin_name, linkedin_headline, linkedin_summary, linkedin_profile_url FROM users LIMIT 1").get();
    res.json(profile);
  });

  // --- Projects API ---

  app.get("/api/projects", (req, res) => {
    const projects = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
    res.json(projects);
  });

  app.post("/api/projects", (req, res) => {
    const { title, company, description, status, source, externalUrl } = req.body;
    db.prepare(`
      INSERT INTO projects (title, company, description, status, source, external_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(title, company, description, status || 'lead', source || 'manual', externalUrl, new Date().toISOString());
    res.json({ message: "Project added" });
  });

  app.delete("/api/projects/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    res.json({ message: "Project deleted" });
  });

  app.post("/api/seed", (req, res) => {
    db.prepare("DELETE FROM users").run();
    db.prepare("DELETE FROM invoices").run();
    db.prepare("DELETE FROM wise_accounts").run();
    db.prepare("DELETE FROM leads").run();
    db.prepare("DELETE FROM burn_history").run();
    db.prepare("DELETE FROM hedging_contracts").run();
    db.prepare("DELETE FROM market_trends").run();
    db.prepare("DELETE FROM projects").run();
    seedData();
    res.json({ message: "Data re-seeded" });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  // Seed data function
  const seedData = () => {
    const userExists = db.prepare("SELECT id FROM users LIMIT 1").get();
    if (!userExists) {
      console.log("Seeding initial data...");
      db.prepare("INSERT INTO users (email, monthly_burn, industry, base_currency) VALUES (?, ?, ?, ?)").run('user@example.com', 5000, 'Software Engineering', 'EUR');
      
      const today = new Date();
      const march1 = new Date(2026, 2, 1);
      const april1 = new Date(2026, 3, 1);
      const may1 = new Date(2026, 4, 1);
      
      // Moneybird Mock: Invoices with 45-day lag
      db.prepare("INSERT INTO invoices (amount, currency, status, issued_date, expected_cash_date) VALUES (?, ?, ?, ?, ?)").run(15000, 'CAD', 'pending', '2026-03-31', '2026-05-15');
      db.prepare("INSERT INTO invoices (amount, currency, status, issued_date, expected_cash_date) VALUES (?, ?, ?, ?, ?)").run(15000, 'CAD', 'pending', '2026-04-30', '2026-06-15');
      db.prepare("INSERT INTO invoices (amount, currency, status, issued_date, expected_cash_date) VALUES (?, ?, ?, ?, ?)").run(12000, 'EUR', 'paid', '2026-01-31', '2026-03-15');
      
      // Wise Mock: Accounts and Jars
      db.prepare("INSERT INTO wise_accounts (currency, balance, label) VALUES (?, ?, ?)").run('CAD', 25000, 'Operating Capital');
      db.prepare("INSERT INTO wise_accounts (currency, balance, label, is_jar) VALUES (?, ?, ?, ?)").run('EUR', 8500, 'Tax Reserve Jar', 1);
      db.prepare("INSERT INTO wise_accounts (currency, balance, label) VALUES (?, ?, ?)").run('EUR', 12000, 'Main Business Account');

      db.prepare("INSERT INTO leads (company, role, status, scouted_at, linkedin_url) VALUES (?, ?, ?, ?, ?)").run('TechCorp', 'Senior TS Engineer', 'scouted', new Date().toISOString(), 'https://www.linkedin.com/company/techcorp');
      db.prepare("INSERT INTO leads (company, role, status, scouted_at, linkedin_url) VALUES (?, ?, ?, ?, ?)").run('InnovateIO', 'Lead Architect', 'contacted', new Date().toISOString(), 'https://www.linkedin.com/company/innovateio');

      const months = ["Mar 25", "Apr 25", "May 25", "Jun 25", "Jul 25", "Aug 25", "Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26"];
      const baseBurn = 5000;
      months.forEach(month => {
        const amount = baseBurn + (Math.random() * 1000 - 500);
        db.prepare("INSERT INTO burn_history (month, amount) VALUES (?, ?)").run(month, amount);
      });

      // Market Trends: Budget Moments & Hiring Trends
      const marketData = [
        { month: 'Jan', trend: 0.95, budget: 1, desc: 'Q1 Budget Release - High Hiring' },
        { month: 'Feb', trend: 0.85, budget: 0, desc: 'Steady Market' },
        { month: 'Mar', trend: 0.80, budget: 0, desc: 'End of Q1 - Slowdown' },
        { month: 'Apr', trend: 0.90, budget: 1, desc: 'Q2 Budget Refresh' },
        { month: 'May', trend: 0.85, budget: 0, desc: 'Steady Market' },
        { month: 'Jun', trend: 0.70, budget: 0, desc: 'Pre-Summer Slowdown' },
        { month: 'Jul', trend: 0.30, budget: 0, desc: 'Summer Dead Zone' },
        { month: 'Aug', trend: 0.25, budget: 0, desc: 'Summer Dead Zone' },
        { month: 'Sep', trend: 0.85, budget: 0, desc: 'Post-Summer Recovery' },
        { month: 'Oct', trend: 0.95, budget: 1, desc: 'Q4 Budget Push' },
        { month: 'Nov', trend: 0.80, budget: 0, desc: 'Year-end Wrap up' },
        { month: 'Dec', trend: 0.40, budget: 0, desc: 'Holiday Freeze' }
      ];
      marketData.forEach(m => {
        db.prepare("INSERT INTO market_trends (month, hiring_trend, budget_moment, description) VALUES (?, ?, ?, ?)").run(m.month, m.trend, m.budget, m.desc);
      });
    }
  };

  seedData();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
