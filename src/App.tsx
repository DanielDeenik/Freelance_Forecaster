import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
  LineChart, Line, ReferenceDot
} from 'recharts';
import { 
  TrendingUp, Wallet, Calendar, Users, Shield, 
  ArrowUpRight, ArrowDownRight, Zap, Briefcase,
  Search, MessageSquare, ExternalLink, RefreshCw, Settings, X, Save,
  ArrowLeftRight, Globe, Lock, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface FinanceSummary {
  cashPaid: number;
  cashPending: number;
  cashPendingRaw: number;
  monthlyBurn: number;
  taxRate: number;
  escrowAmount: number;
  baseCurrency: string;
  conversionRate: number;
  hedgingActive: boolean;
  runwayMonths: number;
  dutchTaxDetails?: {
    annualProfitEUR: number;
    taxableIncome: number;
    taxDebt: number;
    zvwContribution: number;
    totalTaxReserveEUR: number;
  };
}

interface ForecastItem {
  month: string;
  intensity: number;
  budgetMoment: boolean;
  description: string;
}

interface Lead {
  id: number;
  company: string;
  role: string;
  status: string;
  scouted_at: string;
  linkedin_url?: string;
}

interface WiseAccount {
  id: number;
  currency: string;
  balance: number;
  is_jar: boolean;
  label: string;
}

interface Advice {
  type: 'growth' | 'liquidity' | 'info';
  title: string;
  message: string;
}

interface LinkedInProfile {
  linkedin_name: string;
  linkedin_headline: string;
  linkedin_summary: string;
  linkedin_profile_url: string;
}

interface Project {
  id: number;
  title: string;
  company: string;
  description: string;
  status: string;
  source: string;
  external_url: string;
  created_at: string;
}

interface PendingInvoice {
  id: number;
  amount: number;
  currency: string;
  status: string;
  issued_date: string;
  expected_cash_date: string;
}

// --- Components ---

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm ${className}`}>
    {children}
  </div>
);

const Stat = ({ label, value, subValue, icon: Icon, trend, currency = "$" }: any) => (
  <Card>
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-zinc-50 rounded-lg">
        <Icon className="w-5 h-5 text-zinc-600" />
      </div>
      {trend && (
        <span className={`flex items-center text-xs font-medium ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {trend > 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <div className="space-y-1">
      <p className="text-sm text-zinc-500 font-medium">{label}</p>
      <h3 className="text-2xl font-bold tracking-tight text-zinc-900">
        {currency}{value}
      </h3>
      {subValue && <p className="text-xs text-zinc-400">{subValue}</p>}
    </div>
  </Card>
);

export default function App() {
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [forecast, setForecast] = useState<ForecastItem[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [burnHistory, setBurnHistory] = useState<any[]>([]);
  const [wiseAccounts, setWiseAccounts] = useState<WiseAccount[]>([]);
  const [advice, setAdvice] = useState<Advice[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);
  const [linkedinProfile, setLinkedinProfile] = useState<LinkedInProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDataMgmtOpen, setIsDataMgmtOpen] = useState(false);
  const [tempBurnRate, setTempBurnRate] = useState<string>('');
  const [tempBaseCurrency, setTempBaseCurrency] = useState<string>('USD');
  const [converter, setConverter] = useState({ from: 'USD', to: 'EUR', amount: '1000', result: 0 });
  const [hedgingContracts, setHedgingContracts] = useState<any[]>([]);
  const [newHedge, setNewHedge] = useState({ pair: 'USD/EUR', lockedRate: '0.92', amount: '5000', expiryDate: '2026-06-01' });
  const [cadToUsd, setCadToUsd] = useState({ amount: '1000', result: 0, rate: 0 });
  const [newInvoice, setNewInvoice] = useState({ amount: '', currency: 'CAD', status: 'pending', issuedDate: '', expectedCashDate: '' });
  const [newLead, setNewLead] = useState({ company: '', role: '', status: 'scouted', linkedinUrl: '' });
  const [newAccount, setNewAccount] = useState({ currency: 'EUR', balance: '', label: '', isJar: false });

  const fetchData = async () => {
    try {
      const [finRes, foreRes, leadRes, hedgeRes, burnRes, wiseRes, adviceRes, invRes, profileRes, projectRes] = await Promise.all([
        fetch('/api/finance/summary'),
        fetch('/api/forecast/seasonality'),
        fetch('/api/leads'),
        fetch('/api/hedging/contracts'),
        fetch('/api/finance/burn-history'),
        fetch('/api/wise/accounts'),
        fetch('/api/strategic/advice'),
        fetch('/api/invoices/pending'),
        fetch('/api/user/profile'),
        fetch('/api/projects')
      ]);
      
      const finData = await finRes.json();
      const foreData = await foreRes.json();
      const leadData = await leadRes.json();
      const hedgeData = await hedgeRes.json();
      const burnData = await burnRes.json();
      const wiseData = await wiseRes.json();
      const adviceData = await adviceRes.json();
      const invData = await invRes.json();
      const profileData = await profileRes.json();
      const projectData = await projectRes.json();

      setFinance(finData);
      setForecast(foreData);
      setLeads(leadData);
      setBurnHistory(burnData);
      setHedgingContracts(hedgeData);
      setWiseAccounts(wiseData);
      setAdvice(adviceData);
      setPendingInvoices(invData);
      setLinkedinProfile(profileData);
      setProjects(projectData);
      setTempBurnRate((finData.monthlyBurn / finData.conversionRate).toString());
      setTempBaseCurrency(finData.baseCurrency);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const seedData = async () => {
    await fetch('/api/seed', { method: 'POST' });
    fetchData();
  };

  const saveSettings = async () => {
    try {
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          monthlyBurn: parseFloat(tempBurnRate),
          baseCurrency: tempBaseCurrency
        })
      });
      if (response.ok) {
        setIsSettingsOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConvert = async () => {
    const res = await fetch(`/api/currency/convert?from=${converter.from}&to=${converter.to}&amount=${converter.amount}`);
    const data = await res.json();
    setConverter(prev => ({ ...prev, result: data.converted }));
  };

  const handleCadToUsdConvert = async (amount: string) => {
    const res = await fetch(`/api/currency/convert?from=CAD&to=USD&amount=${amount}`);
    const data = await res.json();
    setCadToUsd({ amount, result: data.converted, rate: data.rate });
  };

  useEffect(() => {
    handleCadToUsdConvert('1000');
  }, []);

  const addHedge = async () => {
    await fetch('/api/hedging/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pair: newHedge.pair,
        lockedRate: parseFloat(newHedge.lockedRate),
        amount: parseFloat(newHedge.amount),
        expiryDate: newHedge.expiryDate
      })
    });
    fetchData();
  };

  const deleteHedge = async (id: number) => {
    await fetch(`/api/hedging/contracts/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const addInvoice = async () => {
    await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newInvoice)
    });
    fetchData();
  };

  const deleteInvoice = async (id: number) => {
    await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const addLead = async () => {
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newLead, scoutedAt: new Date().toISOString() })
    });
    fetchData();
  };

  const deleteLead = async (id: number) => {
    await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const addAccount = async () => {
    await fetch('/api/wise/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAccount)
    });
    fetchData();
  };

  const deleteAccount = async (id: number) => {
    await fetch(`/api/wise/accounts/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleLinkedInConnect = async () => {
    try {
      const res = await fetch('/api/auth/linkedin/url');
      const { url } = await res.json();
      const authWindow = window.open(url, 'linkedin_auth', 'width=600,height=700');
      
      if (!authWindow) {
        alert('Please allow popups for LinkedIn connection.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'LINKEDIN_AUTH_SUCCESS') {
        fetchData();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleLinkedInDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect LinkedIn?')) {
      await fetch('/api/auth/linkedin', { method: 'DELETE' });
      fetchData();
    }
  };

  const searchLinkedInProjects = () => {
    const query = encodeURIComponent(`freelance ${finance?.industry || 'software engineering'} projects`);
    window.open(`https://www.linkedin.com/jobs/search/?keywords=${query}`, '_blank');
  };

  const addProject = async (project: Partial<Project>) => {
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    });
    fetchData();
  };

  const deleteProject = async (id: number) => {
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getCurrencySymbol = (code: string) => {
    switch (code) {
      case 'EUR': return '€';
      case 'GBP': return '£';
      case 'JPY': return '¥';
      case 'CAD': return 'C$';
      default: return '$';
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <RefreshCw className="w-8 h-8 text-zinc-400 animate-spin" />
        <p className="text-zinc-500 font-medium">Initializing Nexus Engine...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-zinc-200">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-bottom border-zinc-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">NEXUS</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsDataMgmtOpen(true)}
              className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all flex items-center gap-2"
              title="Data Management"
            >
              <Save className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider hidden md:block">Data Entry</span>
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={seedData}
              className="text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              Reset Simulation
            </button>
            <div className="w-8 h-8 rounded-full bg-zinc-200 border border-zinc-300" />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Command Center</h1>
            <p className="text-zinc-500 mt-1">Autonomous business operations and liquidity management.</p>
            {linkedinProfile?.linkedin_name && (
              <div className="mt-4 flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl max-w-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-900">{linkedinProfile.linkedin_name}</p>
                    <p className="text-[10px] text-blue-700 font-medium uppercase tracking-wider">{linkedinProfile.linkedin_headline}</p>
                  </div>
                </div>
                <button 
                  onClick={handleLinkedInDisconnect}
                  className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                  title="Disconnect LinkedIn"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!linkedinProfile?.linkedin_name && (
              <button 
                onClick={handleLinkedInConnect}
                className="px-4 py-2 bg-[#0A66C2] text-white rounded-full flex items-center gap-2 text-xs font-bold hover:bg-[#004182] transition-colors"
              >
                <Globe className="w-4 h-4" />
                Connect LinkedIn
              </button>
            )}
            <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Agent Active: OpenClaw Scout</span>
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Stat 
            label="Actual Cash" 
            value={finance?.cashPaid.toLocaleString()} 
            subValue="Cleared & Available"
            icon={Wallet}
            trend={12}
            currency={getCurrencySymbol(finance?.baseCurrency || 'USD')}
          />
          <Stat 
            label="Pending Revenue" 
            value={finance?.cashPending.toLocaleString()} 
            subValue={finance?.hedgingActive ? "Hedged Forecast" : "Market Forecast"}
            icon={TrendingUp}
            trend={-5}
            currency={getCurrencySymbol(finance?.baseCurrency || 'USD')}
          />
          <Stat 
            label="Tax Escrow" 
            value={finance?.escrowAmount.toLocaleString()} 
            subValue="2026 Dutch Tax Reserve"
            icon={Shield}
            currency={getCurrencySymbol(finance?.baseCurrency || 'USD')}
          />
          <Stat 
            label="Runway" 
            value={`${finance?.runwayMonths.toFixed(1)} Months`} 
            subValue={`Incl. Pending Revenue`}
            icon={Calendar}
            currency=""
          />
        </div>

        {/* Strategic Advice Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {advice.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`p-4 rounded-2xl border flex gap-4 ${
                item.type === 'growth' ? 'bg-emerald-50 border-emerald-100' : 
                item.type === 'liquidity' ? 'bg-rose-50 border-rose-100' : 
                'bg-zinc-50 border-zinc-100'
              }`}
            >
              <div className={`p-2 rounded-lg h-fit ${
                item.type === 'growth' ? 'bg-emerald-100 text-emerald-700' : 
                item.type === 'liquidity' ? 'bg-rose-100 text-rose-700' : 
                'bg-zinc-200 text-zinc-700'
              }`}>
                {item.type === 'growth' ? <TrendingUp className="w-4 h-4" /> : 
                 item.type === 'liquidity' ? <Shield className="w-4 h-4" /> : 
                 <Zap className="w-4 h-4" />}
              </div>
              <div>
                <h4 className={`text-sm font-bold ${
                  item.type === 'growth' ? 'text-emerald-900' : 
                  item.type === 'liquidity' ? 'text-rose-900' : 
                  'text-zinc-900'
                }`}>{item.title}</h4>
                <p className={`text-xs mt-1 leading-relaxed ${
                  item.type === 'growth' ? 'text-emerald-700' : 
                  item.type === 'liquidity' ? 'text-rose-700' : 
                  'text-zinc-600'
                }`}>{item.message}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Liquidity Heatmap */}
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold tracking-tight">Seasonality & Hiring Trends</h3>
                <p className="text-sm text-zinc-500">ML-driven hiring intensity & budget moments (LinkedIn/Jobboard data).</p>
              </div>
              <div className="flex gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-zinc-900 rounded-full" />
                  <span>Hiring Intensity</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <span>Budget Moment</span>
                </div>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast}>
                  <defs>
                    <linearGradient id="colorIntensity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#18181b" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#18181b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 12, fill: '#71717a'}}
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-4 border border-zinc-100 rounded-2xl shadow-xl space-y-2">
                            <p className="text-sm font-bold text-zinc-900">{label}</p>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-zinc-900 rounded-full" />
                              <p className="text-xs text-zinc-600">Hiring: {(data.intensity * 100).toFixed(0)}%</p>
                            </div>
                            {data.budgetMoment && (
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Budget Moment</p>
                              </div>
                            )}
                            <p className="text-[10px] text-zinc-400 italic max-w-[150px]">{data.description}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="intensity" 
                    stroke="#18181b" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorIntensity)" 
                  />
                  {/* Budget Moment Markers */}
                  {forecast.map((entry, index) => entry.budgetMoment ? (
                    <ReferenceDot 
                      key={index}
                      x={entry.month} 
                      y={entry.intensity} 
                      r={4} 
                      fill="#10b981" 
                      stroke="none" 
                    />
                  ) : null)}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Burn History */}
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold tracking-tight">Monthly Burn History</h3>
                <p className="text-sm text-zinc-500">Last 12 months of operational expenses.</p>
              </div>
              <div className="flex gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-zinc-900 rounded-full" />
                  <span>Burn Rate</span>
                </div>
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={burnHistory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#71717a'}}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#71717a'}}
                    tickFormatter={(value) => `${getCurrencySymbol(finance?.baseCurrency || 'USD')}${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [`${getCurrencySymbol(finance?.baseCurrency || 'USD')}${value.toLocaleString()}`, 'Burn']}
                  />
                  <Bar 
                    dataKey="amount" 
                    fill="#18181b" 
                    radius={[4, 4, 0, 0]} 
                    barSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Wise Accounts & Jars */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold tracking-tight">Wise Treasury</h3>
              <Globe className="w-5 h-5 text-zinc-400" />
            </div>
            <div className="space-y-4">
              {wiseAccounts.map((account) => (
                <div key={account.id} className={`p-4 rounded-xl border ${account.is_jar ? 'bg-indigo-50/30 border-indigo-100' : 'bg-zinc-50 border-zinc-100'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      {account.is_jar ? <Lock className="w-3 h-3 text-indigo-600" /> : <Wallet className="w-3 h-3 text-zinc-400" />}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{account.label}</span>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-400">{account.currency}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold">{getCurrencySymbol(account.currency)}{account.balance.toLocaleString()}</span>
                  </div>
                </div>
              ))}
              <div className="p-3 bg-zinc-900 rounded-xl flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Auto-Convert Active</span>
                <div className="w-8 h-4 bg-emerald-500 rounded-full relative">
                  <div className="absolute right-1 top-1 w-2 h-2 bg-white rounded-full" />
                </div>
              </div>
            </div>
          </Card>

          {/* Pending Invoices (Moneybird Mock) */}
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold tracking-tight">Moneybird: Pending Invoices</h3>
                <p className="text-sm text-zinc-500">Tracking the 45-day payment lag.</p>
              </div>
              <div className="p-2 bg-zinc-100 rounded-lg">
                <Calendar className="w-5 h-5 text-zinc-600" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="pb-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Invoice Date</th>
                    <th className="pb-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Expected Cash</th>
                    <th className="pb-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Amount</th>
                    <th className="pb-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {pendingInvoices.map((inv) => (
                    <tr key={inv.id} className="group hover:bg-zinc-50/50 transition-colors">
                      <td className="py-4 text-xs font-medium text-zinc-500">{new Date(inv.issued_date).toLocaleDateString()}</td>
                      <td className="py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-zinc-900">{new Date(inv.expected_cash_date).toLocaleDateString()}</span>
                          <span className="text-[10px] text-rose-500 font-medium">45-day lag</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="text-xs font-bold">{getCurrencySymbol(inv.currency)}{inv.amount.toLocaleString()}</span>
                      </td>
                      <td className="py-4">
                        <span className="px-2 py-1 bg-zinc-100 text-zinc-600 rounded text-[10px] font-bold uppercase tracking-widest">
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Market Sentiment */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold tracking-tight">Market Sentiment</h3>
              <Globe className="w-5 h-5 text-zinc-400" />
            </div>
            <div className="space-y-6">
              <div className="p-4 bg-zinc-900 rounded-2xl text-white relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Current Trend</p>
                  <h4 className="text-lg font-bold">
                    {forecast.find(f => f.month === new Date().toLocaleString('en-US', { month: 'short' }))?.description || 'Stable Market'}
                  </h4>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(forecast.find(f => f.month === new Date().toLocaleString('en-US', { month: 'short' }))?.intensity || 0.5) * 100}%` }}
                        className="h-full bg-emerald-500"
                      />
                    </div>
                    <span className="text-xs font-bold text-emerald-400">
                      {((forecast.find(f => f.month === new Date().toLocaleString('en-US', { month: 'short' }))?.intensity || 0.5) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Jobboard Signals</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">LinkedIn Postings</span>
                  <span className="text-emerald-600 font-bold">+14% vs LW</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Average Day Rate</span>
                  <span className="text-zinc-900 font-bold">€850 - €1,100</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">Budget Availability</span>
                  <span className="text-emerald-600 font-bold">High (Q1 Release)</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Agent Activity */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold tracking-tight">Agent Activity</h3>
              <Users className="w-5 h-5 text-zinc-400" />
            </div>
            <div className="space-y-6">
              {leads.map((lead, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={lead.id} 
                  className="flex items-start gap-4"
                >
                  <div className={`mt-1 w-2 h-2 rounded-full ${
                    lead.status === 'contacted' ? 'bg-emerald-500' : 'bg-zinc-300'
                  }`} />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-zinc-900">{lead.company}</p>
                        {lead.linkedin_url && (
                          <a href={lead.linkedin_url} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-blue-600 transition-colors">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        {new Date(lead.scouted_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">{lead.role}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                        lead.status === 'contacted' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {lead.status}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
              <button className="w-full py-3 border border-dashed border-zinc-300 rounded-xl text-xs font-bold text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 transition-all flex items-center justify-center gap-2">
                <Search className="w-3 h-3" />
                Trigger Manual Scout
              </button>
            </div>
          </Card>
        </div>

        {/* Hedging Contracts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold tracking-tight">Active Hedging Contracts</h3>
                <p className="text-sm text-zinc-500">Locked exchange rates for future revenue protection.</p>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg">
                <Shield className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="pb-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Currency Pair</th>
                    <th className="pb-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Locked Rate</th>
                    <th className="pb-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Amount</th>
                    <th className="pb-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Expiry Date</th>
                    <th className="pb-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {hedgingContracts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-zinc-400 italic">No active hedging contracts.</td>
                    </tr>
                  ) : (
                    hedgingContracts.map((contract) => (
                      <tr key={contract.id} className="group hover:bg-zinc-50/50 transition-colors">
                        <td className="py-4 text-xs font-bold text-zinc-900">{contract.pair}</td>
                        <td className="py-4 text-xs font-medium text-zinc-600">{contract.locked_rate}</td>
                        <td className="py-4 text-xs font-bold text-zinc-900">
                          {getCurrencySymbol(contract.pair.split('/')[0])}{contract.amount.toLocaleString()}
                        </td>
                        <td className="py-4 text-xs font-medium text-zinc-500">{contract.expiry_date}</td>
                        <td className="py-4 text-right">
                          <button 
                            onClick={() => deleteHedge(contract.id)}
                            className="p-1.5 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            title="Delete Contract"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-6">Add New Hedge</h4>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Currency Pair</label>
                <input 
                  type="text" 
                  value={newHedge.pair} 
                  onChange={e => setNewHedge(prev => ({ ...prev, pair: e.target.value }))}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all"
                  placeholder="CAD/EUR"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Locked Rate</label>
                <input 
                  type="number" 
                  step="0.0001"
                  value={newHedge.lockedRate} 
                  onChange={e => setNewHedge(prev => ({ ...prev, lockedRate: e.target.value }))}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Amount (Foreign)</label>
                <input 
                  type="number" 
                  value={newHedge.amount} 
                  onChange={e => setNewHedge(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Expiry Date</label>
                <input 
                  type="date" 
                  value={newHedge.expiryDate} 
                  onChange={e => setNewHedge(prev => ({ ...prev, expiryDate: e.target.value }))}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all"
                />
              </div>
              <button 
                onClick={addHedge}
                className="w-full py-3 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 mt-2"
              >
                <Lock className="w-3 h-3" />
                Lock Rate Contract
              </button>
              <div className="p-3 bg-emerald-50 rounded-xl flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-600 mt-0.5" />
                <p className="text-[10px] text-emerald-800 leading-relaxed">
                  Locked rates will be used to calculate your "Pending Revenue" instead of current market rates.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* LinkedIn Project Management */}
          <Card className="md:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold tracking-tight">LinkedIn Project Manager</h3>
              </div>
              <button 
                onClick={searchLinkedInProjects}
                className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all flex items-center gap-2"
              >
                <Search className="w-3 h-3" />
                Search LinkedIn
              </button>
            </div>
            
            <div className="space-y-4">
              {projects.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-zinc-100 rounded-2xl">
                  <p className="text-sm text-zinc-400 italic">No projects tracked yet. Search LinkedIn to find opportunities.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map(project => (
                    <div key={project.id} className="p-4 border border-zinc-100 rounded-2xl hover:border-blue-200 transition-all group">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
                          project.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                        }`}>
                          {project.status}
                        </span>
                        <button 
                          onClick={() => deleteProject(project.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-300 hover:text-rose-500 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <h4 className="text-sm font-bold text-zinc-900">{project.title}</h4>
                      <p className="text-xs text-zinc-500 mb-3">{project.company}</p>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-[10px] text-zinc-400 font-medium">Source: {project.source}</span>
                        {project.external_url && (
                          <a href={project.external_url} target="_blank" rel="noreferrer" className="text-blue-600 text-[10px] font-bold flex items-center gap-1 hover:underline">
                            View on LinkedIn <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* CAD to USD Quick Convert */}
          <Card className="md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <RefreshCw className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold tracking-tight">CAD → USD Quick Convert</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Amount in CAD</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-bold">C$</div>
                  <input 
                    type="number" 
                    value={cadToUsd.amount} 
                    onChange={e => handleCadToUsdConvert(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-center py-2">
                <div className="h-px flex-1 bg-zinc-100" />
                <div className="px-3 text-[10px] font-bold text-zinc-300 uppercase tracking-tighter">Wise Mid-Market Rate</div>
                <div className="h-px flex-1 bg-zinc-100" />
              </div>

              <div className="p-4 bg-zinc-900 rounded-xl text-white relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Estimated USD</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">${cadToUsd.result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-xs text-zinc-500 font-medium">USD</span>
                  </div>
                  <p className="text-[10px] text-emerald-400 font-medium mt-2 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Rate: 1 CAD = {cadToUsd.rate.toFixed(4)} USD
                  </p>
                </div>
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
              </div>
              
              <p className="text-[10px] text-zinc-400 italic text-center">
                Real-time conversion based on Wise mid-market rates.
              </p>
            </div>
          </Card>

          {/* Currency Converter */}
          <Card className="md:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-zinc-100 rounded-lg">
                <ArrowLeftRight className="w-5 h-5 text-zinc-600" />
              </div>
              <h3 className="text-lg font-bold tracking-tight">Currency Converter</h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <select 
                  value={converter.from} 
                  onChange={e => setConverter(prev => ({ ...prev, from: e.target.value }))}
                  className="bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-sm"
                >
                  <option>USD</option><option>EUR</option><option>GBP</option><option>JPY</option>
                </select>
                <select 
                  value={converter.to} 
                  onChange={e => setConverter(prev => ({ ...prev, to: e.target.value }))}
                  className="bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-sm"
                >
                  <option>USD</option><option>EUR</option><option>GBP</option><option>JPY</option>
                </select>
              </div>
              <input 
                type="number" 
                value={converter.amount} 
                onChange={e => setConverter(prev => ({ ...prev, amount: e.target.value }))}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-sm"
              />
              <button 
                onClick={handleConvert}
                className="w-full py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold"
              >
                Convert
              </button>
              {converter.result > 0 && (
                <div className="p-3 bg-zinc-50 rounded-lg text-center">
                  <p className="text-xs text-zinc-500">Result</p>
                  <p className="text-lg font-bold">{converter.result.toFixed(2)} {converter.to}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Availability Beacon */}
          <Card className="bg-zinc-900 text-white border-none overflow-hidden relative md:col-span-1">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold tracking-tight">Availability Beacon</h3>
              </div>
              <div className="space-y-4">
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Your public profile is currently signaling availability for <span className="text-white font-medium">August 2026</span>. 
                  OpenClaw is prioritizing leads with start dates in this window.
                </p>
                <div className="flex items-center gap-4">
                  <button className="px-4 py-2 bg-white text-zinc-900 rounded-lg text-xs font-bold hover:bg-zinc-100 transition-colors">
                    Update Beacon
                  </button>
                  <button className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors">
                    View Public Page <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
            {/* Decorative element */}
            <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
          </Card>

          {/* Cowork Analysis */}
          <Card>
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold tracking-tight">Dutch Tax Breakdown (2026)</h3>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-indigo-900 font-medium">Annual Profit (Est.)</span>
                  <span className="text-indigo-900 font-bold">€{finance?.dutchTaxDetails?.annualProfitEUR.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-indigo-700">Taxable Income</span>
                  <span className="text-indigo-700">€{finance?.dutchTaxDetails?.taxableIncome.toLocaleString()}</span>
                </div>
                <div className="h-px bg-indigo-100 my-2" />
                <div className="flex justify-between text-xs">
                  <span className="text-indigo-700">Income Tax (Box 1)</span>
                  <span className="text-indigo-700">€{finance?.dutchTaxDetails?.taxDebt.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-indigo-700">ZVW Contribution (4.85%)</span>
                  <span className="text-indigo-700">€{finance?.dutchTaxDetails?.zvwContribution.toLocaleString()}</span>
                </div>
                <div className="h-px bg-indigo-200 my-2" />
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-indigo-900">Total Reserve</span>
                  <span className="text-indigo-900">€{finance?.dutchTaxDetails?.totalTaxReserveEUR.toLocaleString()}</span>
                </div>
              </div>
              <div className="p-3 bg-zinc-50 rounded-xl text-[10px] text-zinc-500 leading-relaxed">
                Includes Zelfstandigenaftrek (€1,200) and MKB-winstvrijstelling (12.7%).
              </div>
            </div>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-zinc-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Zap className="w-4 h-4" />
            <span className="text-xs font-bold tracking-widest uppercase">Nexus OS v2.4.0</span>
          </div>
          <div className="flex gap-8 text-xs font-bold text-zinc-400 uppercase tracking-widest">
            <a href="#" className="hover:text-zinc-900 transition-colors">Privacy</a>
            <a href="#" className="hover:text-zinc-900 transition-colors">Security</a>
            <a href="#" className="hover:text-zinc-900 transition-colors">API Docs</a>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <h3 className="text-xl font-bold tracking-tight">User Settings</h3>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-500 uppercase tracking-wider">
                    Base Currency
                  </label>
                  <select 
                    value={tempBaseCurrency}
                    onChange={(e) => setTempBaseCurrency(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all font-medium"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="JPY">JPY - Japanese Yen</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                  </select>
                  {finance && finance.baseCurrency !== 'USD' && (
                    <p className="text-[10px] text-zinc-400 font-medium">
                      Current Rate: 1 USD = {finance.conversionRate} {finance.baseCurrency}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-500 uppercase tracking-wider">
                    Monthly Burn Rate (USD)
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-medium">$</div>
                    <input 
                      type="number" 
                      value={tempBurnRate}
                      onChange={(e) => setTempBurnRate(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all font-medium"
                      placeholder="5000"
                    />
                  </div>
                  <p className="text-xs text-zinc-400">
                    Input your burn rate in USD. It will be converted to your base currency automatically.
                  </p>
                </div>
              </div>
              <div className="p-6 bg-zinc-50 flex gap-3">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="flex-1 py-3 text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveSettings}
                  className="flex-1 py-3 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Data Management Modal */}
      <AnimatePresence>
        {isDataMgmtOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDataMgmtOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">Data Management</h3>
                  <p className="text-xs text-zinc-500">Parameterize your business operations.</p>
                </div>
                <button 
                  onClick={() => setIsDataMgmtOpen(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-12">
                {/* Invoices Section */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-widest">Invoices (Moneybird)</h4>
                    <div className="flex gap-2">
                      <input type="number" placeholder="Amt" className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs w-20" value={newInvoice.amount} onChange={e => setNewInvoice({...newInvoice, amount: e.target.value})} />
                      <select className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs" value={newInvoice.currency} onChange={e => setNewInvoice({...newInvoice, currency: e.target.value})}>
                        <option>CAD</option><option>EUR</option><option>USD</option>
                      </select>
                      <input type="date" className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs" value={newInvoice.expectedCashDate} onChange={e => setNewInvoice({...newInvoice, expectedCashDate: e.target.value})} />
                      <button onClick={addInvoice} className="px-4 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-bold">Add</button>
                    </div>
                  </div>
                  <div className="border border-zinc-100 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-50 text-zinc-500 font-bold uppercase tracking-widest">
                        <tr>
                          <th className="p-3">Date</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {pendingInvoices.map(inv => (
                          <tr key={inv.id}>
                            <td className="p-3">{inv.expected_cash_date}</td>
                            <td className="p-3 font-bold">{getCurrencySymbol(inv.currency)}{inv.amount}</td>
                            <td className="p-3 uppercase">{inv.status}</td>
                            <td className="p-3 text-right">
                              <button onClick={() => deleteInvoice(inv.id)} className="text-rose-500 hover:underline">Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Leads Section */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-widest">Leads (LinkedIn)</h4>
                    <div className="flex gap-2">
                      <input placeholder="Company" className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs" value={newLead.company} onChange={e => setNewLead({...newLead, company: e.target.value})} />
                      <input placeholder="LinkedIn URL" className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs" value={newLead.linkedinUrl} onChange={e => setNewLead({...newLead, linkedinUrl: e.target.value})} />
                      <button onClick={addLead} className="px-4 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-bold">Add</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {leads.map(lead => (
                      <div key={lead.id} className="p-4 bg-zinc-50 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold">{lead.company}</p>
                          <p className="text-[10px] text-zinc-500">{lead.role}</p>
                        </div>
                        <button onClick={() => deleteLead(lead.id)} className="text-rose-500 text-xs hover:underline">Delete</button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Wise Accounts Section */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-widest">Wise Accounts</h4>
                    <div className="flex gap-2">
                      <input placeholder="Label" className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs" value={newAccount.label} onChange={e => setNewAccount({...newAccount, label: e.target.value})} />
                      <input type="number" placeholder="Bal" className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs w-20" value={newAccount.balance} onChange={e => setNewAccount({...newAccount, balance: e.target.value})} />
                      <button onClick={addAccount} className="px-4 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-bold">Add</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {wiseAccounts.map(acc => (
                      <div key={acc.id} className="p-4 border border-zinc-100 rounded-xl flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">{acc.currency}</span>
                          <button onClick={() => deleteAccount(acc.id)} className="text-rose-500 text-[10px] hover:underline">Delete</button>
                        </div>
                        <p className="text-xs font-bold text-zinc-900">{acc.label}</p>
                        <p className="text-lg font-bold">{getCurrencySymbol(acc.currency)}{acc.balance.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              
              <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex justify-end">
                <button 
                  onClick={() => setIsDataMgmtOpen(false)}
                  className="px-6 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
