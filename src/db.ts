import Database from 'better-sqlite3';

const db = new Database('nexus.db');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    monthly_burn REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0.30,
    industry TEXT,
    next_available_date TEXT,
    base_currency TEXT DEFAULT 'EUR',
    linkedin_id TEXT,
    linkedin_name TEXT,
    linkedin_headline TEXT,
    linkedin_summary TEXT,
    linkedin_profile_url TEXT,
    linkedin_access_token TEXT,
    linkedin_refresh_token TEXT
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    company TEXT,
    description TEXT,
    status TEXT, -- 'active', 'completed', 'lead'
    source TEXT, -- 'linkedin', 'manual'
    external_url TEXT,
    created_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS hedging_contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    pair TEXT, -- e.g., 'EUR/USD'
    locked_rate REAL,
    amount REAL, -- Amount in foreign currency
    expiry_date TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL,
    currency TEXT DEFAULT 'USD',
    status TEXT, -- 'pending', 'paid'
    issued_date TEXT,
    due_date TEXT,
    paid_date TEXT,
    expected_cash_date TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS wise_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    currency TEXT,
    balance REAL,
    is_jar BOOLEAN DEFAULT 0,
    label TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    company TEXT,
    role TEXT,
    status TEXT, -- 'scouted', 'contacted', 'replied'
    scouted_at TEXT,
    linkedin_url TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS burn_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    month TEXT,
    amount REAL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS market_trends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT,
    hiring_trend REAL, -- 0 to 1
    budget_moment BOOLEAN DEFAULT 0,
    description TEXT
  );
`);

// Migration: Add missing columns if they don't exist
const tableInfoUsers = db.prepare("PRAGMA table_info(users)").all() as any[];
const columnsToAdd = [
  { name: 'base_currency', type: "TEXT DEFAULT 'EUR'" },
  { name: 'linkedin_id', type: 'TEXT' },
  { name: 'linkedin_name', type: 'TEXT' },
  { name: 'linkedin_headline', type: 'TEXT' },
  { name: 'linkedin_summary', type: 'TEXT' },
  { name: 'linkedin_profile_url', type: 'TEXT' },
  { name: 'linkedin_access_token', type: 'TEXT' },
  { name: 'linkedin_refresh_token', type: 'TEXT' }
];

columnsToAdd.forEach(col => {
  if (!tableInfoUsers.find(c => c.name === col.name)) {
    db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
  }
});

const tableInfoInvoices = db.prepare("PRAGMA table_info(invoices)").all() as any[];
if (!tableInfoInvoices.find(col => col.name === 'expected_cash_date')) {
  db.exec("ALTER TABLE invoices ADD COLUMN expected_cash_date TEXT");
}

export default db;
