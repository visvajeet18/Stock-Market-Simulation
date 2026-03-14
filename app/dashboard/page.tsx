"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Chart as ChartJS, ArcElement, Tooltip, Legend,
    CategoryScale, LinearScale, PointElement, LineElement, Filler
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import MarketTicker from '@/app/components/MarketTicker';
import StockAnalyst from '@/app/components/StockAnalyst';
import WhalePodium from '@/app/components/WhalePodium';
import GlobalAlerts from '@/app/components/GlobalAlerts';
import { INITIAL_BALANCE } from '@/lib/constants';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler);

// Helper: get qty and avgCost from portfolio entry (supports both old number and new object)
function getHolding(portfolio: any, symbol: string): { qty: number; avgCost: number } {
    const h = portfolio?.[symbol];
    if (!h) return { qty: 0, avgCost: 0 };
    if (typeof h === 'number') return { qty: h, avgCost: 0 };
    return { qty: h.qty ?? 0, avgCost: h.avgCost ?? 0 };
}

export default function Dashboard() {
    const [user, setUser] = useState<any>(null);
    const [stocks, setStocks] = useState<any[]>([]);
    const [loans, setLoans] = useState<any[]>([]);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tradeForm, setTradeForm] = useState({ symbol: '', action: 'BUY', quantity: 1 });
    const [message, setMessage] = useState({ text: '', type: '' });
    const [selectedChartStock, setSelectedChartStock] = useState('^BSESN');
    const [analystStock, setAnalystStock] = useState<any>(null);
    const [showNews, setShowNews] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [isMobile, setIsMobile] = useState(false);

    // Advanced Orders & History State
    const [orders, setOrders] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [orderForm, setOrderForm] = useState({ symbol: '', action: 'LIMIT_BUY', quantity: 1, targetPrice: 0 });
    const [tradeTab, setTradeTab] = useState<'MARKET' | 'LIMIT'>('MARKET');

    // Gamification & Weather State
    const [marketWeather, setMarketWeather] = useState('normal');
    const [tradeEffect, setTradeEffect] = useState<{ type: 'win' | 'lose'; amount: number } | null>(null);
    const [supportMsg, setSupportMsg] = useState('');
    const [sendingSupport, setSendingSupport] = useState(false);

    // Derived persistent event for continuous banner
    const breakingNews = announcements.find((a: any) => a.type === 'event');

    const router = useRouter();

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);

        const storedTheme = localStorage.getItem('theme') as 'dark' | 'light';
        if (storedTheme) {
            setTheme(storedTheme);
            document.body.classList.toggle('light-theme', storedTheme === 'light');
        }

        const storedUser = localStorage.getItem('user');
        if (!storedUser) { router.push('/login'); return; }
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser.role === 'admin') { router.push('/admin'); return; }
        setUser(parsedUser);
        fetchStocks();
        fetchLoans(parsedUser.id);
        fetchUser(parsedUser.id);
        const interval = setInterval(() => {
            fetchStocks();
            fetchLoans(parsedUser.id);
            fetchUser(parsedUser.id);
            fetchAnnouncements();
            fetchMarketState();
            fetchOrders(parsedUser.id);
        }, 30000); // 30s polling for non-admin to save quota
        
        fetchAnnouncements();
        fetchMarketState();
        fetchOrders(parsedUser.id);
        
        return () => clearInterval(interval);
    }, [router]);

    const fetchAnnouncements = async () => {
        try {
            const res = await fetch('/api/announcements', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setAnnouncements(data);
            }
        } catch { /* silent */ }
    };

    const fetchMarketState = async () => {
        try {
            const res = await fetch('/api/market-state', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                const newSentiment = data.sentiment || 'normal';
                if (newSentiment !== marketWeather) {
                    console.log(`[Dashboard] Sentiment changed: ${newSentiment}`);
                    setMarketWeather(newSentiment);
                }
            }
        } catch { /* silent */ }
    };

    const fetchUser = async (userId: string) => {
        try {
            const res = await fetch(`/api/users/me?userId=${userId}`, { cache: 'no-store' });
            if (res.status === 403) {
                // Suspended
                setUser((prev: any) => ({ ...prev, suspended: true }));
                return;
            }
            if (res.ok) {
                const data = await res.json();
                if (data.suspended) {
                    setUser(data);
                    return;
                }
                setUser(data);
                localStorage.setItem('user', JSON.stringify(data));
            }
        } catch { /* silent */ }
    };

    const fetchStocks = async () => {
        try {
            const res = await fetch('/api/stocks');
            const data = await res.json();
            if (Array.isArray(data)) setStocks(data);
        } catch { /* silent */ }
        finally { setLoading(false); }
    };

    const fetchLoans = async (userId: string) => {
        try {
            const res = await fetch(`/api/loans?userId=${userId}`);
            const data = await res.json();
            if (res.ok) setLoans(data);
        } catch { /* silent */ }
    };

    const fetchOrders = async (userId: string) => {
        try {
            const [ordersRes, historyRes] = await Promise.all([
                fetch(`/api/trade/order?userId=${userId}`),
                fetch(`/api/trade/history?userId=${userId}`)
            ]);
            if (ordersRes.ok) {
                const od = await ordersRes.json();
                setOrders(Array.isArray(od) ? od : []);
            }
            if (historyRes.ok) {
                const hd = await historyRes.json();
                setHistory(Array.isArray(hd) ? hd : []);
            }
        } catch { /* silent */ }
    };

    // Audio Helper
    const playSound = (type: 'buy' | 'profit' | 'loss' | 'coins') => {
        const sounds = {
            buy: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
            profit: 'https://assets.mixkit.co/active_storage/sfx/1000/1000-preview.mp3', // Win/Coin
            loss: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3', // Alert
            coins: 'https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3'
        };
        const audio = new Audio(sounds[type]);
        audio.play().catch(() => console.warn('Audio play blocked or failed'));
    };

    const handleTrade = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });
        try {
            // Predict Realized P&L for gamification before the backend update
            let pnl = 0;
            if (tradeForm.action === 'SELL' && user.portfolio) {
                const { avgCost } = getHolding(user.portfolio, tradeForm.symbol);
                const sellPrice = stocks.find(s => s.symbol === tradeForm.symbol)?.price || 0;
                if (avgCost > 0 && sellPrice > 0) {
                    pnl = (sellPrice - avgCost) * Number(tradeForm.quantity);
                }
            }

            const res = await fetch('/api/trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    symbol: tradeForm.symbol,
                    quantity: Number(tradeForm.quantity),
                    action: tradeForm.action
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Trade failed');

            // Play Sound
            if (tradeForm.action === 'BUY') {
                playSound('buy');
            } else if (tradeForm.action === 'SELL') {
                if (pnl > 0) playSound('profit');
                else playSound('loss');
            }

            // Trigger Gamification Confetti/Rekt for ANY P&L
            if (pnl > 0) {
                setTradeEffect({ type: 'win', amount: pnl });
                setTimeout(() => setTradeEffect(null), 3500);
            } else if (pnl < 0) {
                setTradeEffect({ type: 'lose', amount: Math.abs(pnl) });
                setTimeout(() => setTradeEffect(null), 3500);
            }

            const updatedUser = { ...user, balance: data.balance, portfolio: data.portfolio };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setMessage({ text: `✓ ${tradeForm.action === 'BUY' ? 'Bought' : 'Sold'} ${tradeForm.quantity} × ${tradeForm.symbol} @ ₹${stocks.find(s => s.symbol === tradeForm.symbol)?.price?.toFixed(2)}`, type: 'success' });
            setTradeForm({ ...tradeForm, quantity: 1 });
            fetchStocks();
        } catch (err: any) {
            setMessage({ text: err.message, type: 'error' });
        }
    };

    const handleSupportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supportMsg.trim()) return;
        setSendingSupport(true);
        try {
            const res = await fetch('/api/support', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, username: user.username, message: supportMsg })
            });
            if (res.ok) {
                setMessage({ text: '✓ Message sent to Administrator.', type: 'success' });
                setSupportMsg('');
            }
        } catch { /* silent */ }
        finally { setSendingSupport(false); }
    };

    const handleLimitOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });
        try {
            const res = await fetch('/api/trade/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    symbol: orderForm.symbol,
                    quantity: Number(orderForm.quantity),
                    targetPrice: Number(orderForm.targetPrice),
                    action: orderForm.action
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to place order');

            setMessage({ text: `✓ Placed ${orderForm.action.replace('_', ' ')} for ${orderForm.quantity} × ${orderForm.symbol} @ ₹${orderForm.targetPrice}`, type: 'success' });
            setOrderForm({ ...orderForm, quantity: 1, targetPrice: 0 });

            // Re-fetch to update balances and orders
            if (user && user.id) {
                fetchUser(user.id);
                fetchOrders(user.id);
            }
        } catch (err: any) {
            setMessage({ text: err.message, type: 'error' });
        }
    };

    const cancelOrder = async (orderId: string) => {
        try {
            const res = await fetch('/api/trade/order', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId })
            });
            if (res.ok) {
                setMessage({ text: '✓ Order Cancelled successfully. Funds/Stocks refunded.', type: 'success' });
                if (user && user.id) {
                    fetchUser(user.id);
                    fetchOrders(user.id);
                }
            }
        } catch (err: any) {
            setMessage({ text: err.message, type: 'error' });
        }
    };

    const scrollToTrade = () => {
        const el = document.getElementById('trade-terminal');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    // ── Portfolio Computations ──
    const currentPortfolioValue = useMemo(() => {
        if (!user || stocks.length === 0) return 0;
        return Object.keys(user.portfolio || {}).reduce((total, symbol) => {
            const { qty } = getHolding(user.portfolio, symbol);
            const stock = stocks.find((s: any) => s.symbol === symbol);
            return total + qty * (stock?.price || 0);
        }, 0);
    }, [user, stocks]);

    const filteredStocks = useMemo(() => {
        return (stocks || [])
            .filter(s => 
                s.symbol.toLowerCase().includes(searchTerm.toLowerCase()) || 
                (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.sector || '').toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => a.symbol.localeCompare(b.symbol));
    }, [stocks, searchTerm]);

    const stocks_list = stocks || [];
    const loans_list = loans || [];
    const orders_list = orders || [];
    const history_list = history || [];

    const activeInvestments = loans
        .filter(l => l.lenderId === user?.id && l.status === 'ACTIVE')
        .reduce((sum, l) => sum + l.amount * (1 + l.interestRate / 100), 0);

    const activeDebt = loans
        .filter(l => l.borrowerId === user?.id && l.status === 'ACTIVE')
        .reduce((sum, l) => sum + l.amount * (1 + l.interestRate / 100), 0);

    const totalValue = (user?.balance || 0) + currentPortfolioValue + activeInvestments - activeDebt;
    const initialBalance = INITIAL_BALANCE;
    const profit = totalValue - initialBalance;
    const profitRate = (profit / initialBalance) * 100;

    // ── Advanced Portfolio Analytics ──
    const analytics = useMemo(() => {
        if (!user || stocks.length === 0) return null;
        const holdings = Object.entries(user.portfolio || {});
        if (holdings.length === 0) return null;

        // Best/Worst performer
        let bestPnl = -Infinity, worstPnl = Infinity;
        let bestSym = '', worstSym = '';

        holdings.forEach(([sym]) => {
            const { qty, avgCost } = getHolding(user.portfolio, sym);
            if (qty <= 0 || avgCost === 0) return;
            const stock = stocks.find((s: any) => s.symbol === sym);
            if (!stock) return;
            const pnlPct = ((stock.price - avgCost) / avgCost) * 100;
            if (pnlPct > bestPnl) { bestPnl = pnlPct; bestSym = sym; }
            if (pnlPct < worstPnl) { worstPnl = pnlPct; worstSym = sym; }
        });

        // Diversification (Herfindahl index — lower = more diversified)
        const weights = holdings.map(([sym]) => {
            const { qty } = getHolding(user.portfolio, sym);
            const stock = stocks.find((s: any) => s.symbol === sym);
            return qty * (stock?.price || 0);
        });
        const total = weights.reduce((a, b) => a + b, 0);
        const hhi = total > 0 ? weights.reduce((sum, w) => sum + Math.pow(w / total, 2), 0) : 1;
        const diversificationScore = ((1 - hhi) * 100).toFixed(0);

        // Portfolio weighted Beta
        let weightedBeta = 0;
        holdings.forEach(([sym]) => {
            const { qty } = getHolding(user.portfolio, sym);
            const stock = stocks.find((s: any) => s.symbol === sym);
            if (!stock || total === 0) return;
            const w = (qty * (stock.price || 0)) / total;
            weightedBeta += w * (stock.beta ?? 1);
        });

        // Simple Sharpe approximation: profit_rate / std_dev of holdings returns
        const returns = holdings.map(([sym]) => {
            const { qty, avgCost } = getHolding(user.portfolio, sym);
            const stock = stocks.find((s: any) => s.symbol === sym);
            if (!stock || avgCost === 0 || qty <= 0) return 0;
            return ((stock.price - avgCost) / avgCost) * 100;
        }).filter(r => r !== 0);
        const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
        const stdDev = returns.length > 1
            ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length)
            : 1;
        const sharpe = stdDev !== 0 ? ((avgReturn - 0.5) / stdDev).toFixed(2) : 'N/A';

        return {
            diversificationScore,
            weightedBeta: weightedBeta.toFixed(2),
            sharpe,
            bestSym, bestPnl: bestPnl === -Infinity ? null : bestPnl,
            worstSym, worstPnl: worstPnl === Infinity ? null : worstPnl,
        };
    }, [user, stocks]);

    const donutMetrics = [
        { label: 'Profit', value: Math.max(0, profit), color: 'rgba(34,197,94,0.8)' },
        { label: 'Loss', value: Math.abs(Math.min(0, profit)), color: 'rgba(239,68,68,0.8)' },
        { label: 'Invested', value: currentPortfolioValue, color: 'rgba(56,189,248,0.8)' },
        { label: 'Debt', value: activeDebt, color: 'rgba(245,158,11,0.8)' },
    ].filter(m => m.value > 0);

    if (loading || !user) {
        return <div className="auth-container"><h2 className="title-glow">Loading Market Data...</h2></div>;
    }

    if (user.suspended) {
        return (
            <div className="auth-container" style={{ background: '#000', flexDirection: 'column', textAlign: 'center' }}>
                <h1 style={{ fontSize: '4rem', color: '#ef4444', marginBottom: '1rem' }}>⛔</h1>
                <h2 className="title-glow" style={{ color: '#ef4444' }}>ACCOUNT SUSPENDED</h2>
                <p style={{ color: '#94a3b8', maxWidth: '400px', margin: '0 auto 2rem' }}>
                    Your access to the StockX platform has been revoked due to suspicious activity or malpractice.
                </p>
                <button className="nav-btn" onClick={() => { localStorage.removeItem('user'); router.push('/'); }}>
                    Return to Home
                </button>
            </div>
        );
    }

    const selectedStock = stocks.find(s => s.symbol === selectedChartStock);

    return (
        <main className={`weather-${marketWeather}`}>
            <div className="sentiment-bg" />
            <nav className="navbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div className="nav-brand">Stock<span style={{ color: 'var(--accent)' }}>X</span></div>
                    <div className={`badge ${marketWeather === 'bull' ? 'badge-success' : marketWeather === 'bear' ? 'badge-danger' : 'badge-primary'}`} style={{ textTransform: 'uppercase', letterSpacing: '1px', padding: '0.4rem 0.8rem', fontSize: '0.7rem' }}>
                        {marketWeather === 'bull' ? '🟢 Bull Market' : marketWeather === 'bear' ? '🔴 Bear Market' : marketWeather === 'volatile' ? '⚡ Volatile' : '⚪ Normal Market'}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <a href="/dashboard" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Trading Hub</a>
                    <a href="/dashboard/loans" style={{ color: '#94a3b8', textDecoration: 'none' }}>P2P Bank</a>
                </div>
                <div className="nav-links">
                    <span style={{ color: user.suspended ? '#ef4444' : '#e2e8f0', marginRight: '1rem', fontWeight: user.suspended ? 800 : 400 }}>
                        {user.name} {user.suspended && '(SUSPENDED)'}
                    </span>
                    <button className="nav-btn" onClick={() => { 
                        const newTheme = theme === 'dark' ? 'light' : 'dark';
                        setTheme(newTheme);
                        localStorage.setItem('theme', newTheme);
                        document.body.classList.toggle('light-theme', newTheme === 'light');
                    }} style={{ background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '1.2rem', padding: '0.4rem' }}>
                        {theme === 'dark' ? '🌙' : '☀️'}
                    </button>
                    <button className="nav-btn" onClick={() => { localStorage.removeItem('user'); router.push('/'); }}>Logout</button>
                </div>
            </nav>

            {/* Live Market Ticker */}
            <MarketTicker stocks={stocks} />

            {/* Live News Feed */}
            {announcements.length > 0 && (
                <div style={{ background: 'rgba(10,15,30,0.9)', borderBottom: '1px solid rgba(239,68,68,0.3)' }}>
                    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '0.1rem 0.4rem', borderRadius: '3px', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>MARKET NEWS</span>
                            <div style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', paddingBottom: '2px' }}>
                                {announcements.slice(0, 5).map((a: any) => (
                                    <span key={a.id} style={{ fontSize: '0.85rem', color: a.type === 'event' ? '#fca5a5' : a.type === 'sentiment' ? '#fde68a' : '#c4b5fd', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                        {a.title} {a.body ? `— ${a.body}` : ''}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Gamification Overlays */}
            {tradeEffect?.type === 'win' && (
                <div className="win-confetti">
                    <div className="win-text" style={{ textAlign: 'center' }}>
                        +₹{tradeEffect.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}<br />
                        <span style={{ fontSize: '2rem', color: '#fff', textShadow: '0 0 10px #10b981' }}>MASSIVE PROFIT!</span>
                    </div>
                </div>
            )}
            {tradeEffect?.type === 'lose' && (
                <div className="rekt-flash">
                    <div className="rekt-text" style={{ textAlign: 'center' }}>
                        -₹{tradeEffect.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}<br />
                        <span style={{ fontSize: '2.5rem', color: '#fff', textShadow: '0 0 10px #ef4444' }}>REKT.</span>
                    </div>
                </div>
            )}

            <GlobalAlerts announcements={announcements} loans={loans} tradeEffect={tradeEffect} marketWeather={marketWeather} />

            <div className="dashboard-page-wrapper" style={{ minHeight: '100vh' }}>
                <div className="dashboard-container">
                    {/* Persistent Event Banner */}
                    {breakingNews && (
                        <div style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.15) 0%, rgba(15,23,42,0) 100%)', borderLeft: '4px solid #ef4444', padding: '1rem', marginBottom: '1.5rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ fontSize: '1.5rem', animation: 'pulse 2s infinite' }}>🚨</div>
                            <div>
                                <div style={{ fontWeight: 800, color: '#ef4444', letterSpacing: '1px', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Persistent Market Condition</div>
                                <div style={{ color: '#f8fafc', fontWeight: 500, fontSize: '0.95rem' }}>{breakingNews.title} {breakingNews.body ? `— ${breakingNews.body}` : ''}</div>
                            </div>
                        </div>
                    )}

                {/* ── Row 1: Portfolio + Trade Terminal ── */}
                <div className="grid-2">


                    {/* Portfolio Card */}
                    <div className="card">
                        <div className="card-header">Your Portfolio</div>
                        <div style={{ padding: '1rem 0' }}>
                            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Total Wealth</p>
                            <h2 style={{ fontSize: '2.5rem', margin: '0.5rem 0' }}>
                                ₹{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </h2>
                            <div style={{ display: 'flex', gap: '2rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                                <div>
                                    <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Cash Balance</p>
                                    <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>₹{user.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                                <div>
                                    <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Total P&L</p>
                                    <p className={profit >= 0 ? 'stat-up' : 'stat-down'} style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                        {profit >= 0 ? '+' : ''}₹{profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        <span style={{ fontSize: '0.875rem', marginLeft: '0.5rem' }}>({profitRate > 0 ? '+' : ''}{profitRate.toFixed(2)}%)</span>
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                                <div>
                                    <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Equity Value</p>
                                    <p style={{ fontSize: '1rem', fontWeight: 600, color: '#38bdf8' }}>₹{currentPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                                <div>
                                    <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Lending</p>
                                    <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--success)' }}>+₹{activeInvestments.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                                <div>
                                    <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Debt</p>
                                    <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--danger)' }}>-₹{activeDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                </div>
                            </div>
                        </div>

                        {/* Donut */}
                        {donutMetrics.length > 0 && (
                            <>
                                <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', fontSize: '1rem', color: '#cbd5e1' }}>Financial Breakdown</h3>
                                <div style={{ maxWidth: '260px', margin: '0 auto' }}>
                                    <Doughnut
                                        data={{ labels: donutMetrics.map(m => m.label), datasets: [{ data: donutMetrics.map(m => m.value), backgroundColor: donutMetrics.map(m => m.color), borderColor: 'rgba(15,23,42,1)', borderWidth: 2 }] }}
                                        options={{ plugins: { legend: { position: 'bottom', labels: { color: '#e2e8f0', font: { size: 11 } } } } }}
                                    />
                                </div>
                            </>
                        )}

                        {/* Portfolio Analytics */}
                        {analytics && (
                            <>
                                <h3 style={{ marginTop: '1.5rem', marginBottom: '0.25rem', fontSize: '1rem', color: '#cbd5e1' }}>Portfolio Analytics</h3>
                                <div className="analytics-grid">
                                    <div className="analytics-card">
                                        <div className="analytics-label">Sharpe Ratio</div>
                                        <div className="analytics-value" style={{ color: Number(analytics.sharpe) >= 1 ? '#10b981' : Number(analytics.sharpe) < 0 ? '#ef4444' : '#f59e0b' }}>
                                            {analytics.sharpe}
                                        </div>
                                    </div>
                                    <div className="analytics-card">
                                        <div className="analytics-label">Port. Beta</div>
                                        <div className="analytics-value">{analytics.weightedBeta}</div>
                                    </div>
                                    <div className="analytics-card">
                                        <div className="analytics-label">Diversification</div>
                                        <div className="analytics-value" style={{ color: Number(analytics.diversificationScore) >= 60 ? '#10b981' : '#f59e0b' }}>
                                            {analytics.diversificationScore}%
                                        </div>
                                    </div>
                                    {analytics.bestSym && analytics.bestPnl !== null && (
                                        <div className="analytics-card">
                                            <div className="analytics-label">Best Performer</div>
                                            <div className="analytics-value" style={{ fontSize: '0.85rem', color: '#10b981' }}>
                                                {analytics.bestSym}<br /><span style={{ fontSize: '0.75rem' }}>+{(analytics.bestPnl as number).toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    )}
                                    {analytics.worstSym && analytics.worstPnl !== null && (
                                        <div className="analytics-card">
                                            <div className="analytics-label">Worst Performer</div>
                                            <div className="analytics-value" style={{ fontSize: '0.85rem', color: '#ef4444' }}>
                                                {analytics.worstSym}<br /><span style={{ fontSize: '0.75rem' }}>{(analytics.worstPnl as number).toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        <WhalePodium />

                        {/* Support Form */}
                        <div className="card" style={{ marginTop: '2rem' }}>
                            <div className="card-header" style={{ fontSize: '1rem' }}>🎧 Need Help?</div>
                            <form onSubmit={handleSupportSubmit} style={{ marginTop: '1rem' }}>
                                <textarea 
                                    value={supportMsg}
                                    onChange={e => setSupportMsg(e.target.value)}
                                    placeholder="Send a message to site admin..."
                                    style={{ width: '100%', minHeight: '80px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', color: 'white', marginBottom: '0.75rem', fontSize: '0.85rem' }}
                                />
                                <button type="submit" disabled={sendingSupport || !supportMsg.trim()} className="nav-btn" style={{ width: '100%', opacity: (sendingSupport || !supportMsg.trim()) ? 0.5 : 1 }}>
                                    {sendingSupport ? 'Sending...' : 'Send Message'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Trade Terminal */}
                    <div className="card" id="trade-terminal">
                        <div className="card-header" style={{ paddingBottom: 0, borderBottom: 'none' }}>
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <button onClick={() => setTradeTab('MARKET')} style={{ background: 'none', border: 'none', padding: '0 0 1rem 0', color: tradeTab === 'MARKET' ? 'var(--primary)' : '#94a3b8', borderBottom: tradeTab === 'MARKET' ? '2px solid var(--primary)' : '2px solid transparent', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>Market Execution</button>
                                <button onClick={() => setTradeTab('LIMIT')} style={{ background: 'none', border: 'none', padding: '0 0 1rem 0', color: tradeTab === 'LIMIT' ? '#c084fc' : '#94a3b8', borderBottom: tradeTab === 'LIMIT' ? '2px solid #c084fc' : '2px solid transparent', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>Advanced Limit</button>
                            </div>
                        </div>

                        {message.text && (
                            <div style={{ padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', marginTop: '1rem', fontSize: '0.875rem', background: message.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: message.type === 'success' ? 'var(--success)' : 'var(--danger)', border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                                {message.text}
                            </div>
                        )}

                        {tradeTab === 'MARKET' ? (
                            <form onSubmit={handleTrade} style={{ marginTop: '1.5rem' }}>
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                    <div className="input-group" style={{ flex: 1, minWidth: '120px', marginBottom: 0 }}>
                                        <label>Action</label>
                                        <select value={tradeForm.action} onChange={e => setTradeForm({ ...tradeForm, action: e.target.value })}
                                            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', color: 'white', outline: 'none' }}>
                                            <option value="BUY">🟢 Buy</option>
                                            <option value="SELL">🔴 Sell</option>
                                        </select>
                                    </div>
                                    <div className="input-group" style={{ flex: 1, minWidth: '120px', marginBottom: 0 }}>
                                        <label>Stock</label>
                                        <select required value={tradeForm.symbol} onChange={e => setTradeForm({ ...tradeForm, symbol: e.target.value })}
                                            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', color: 'white', outline: 'none' }}>
                                            <option value="" disabled>Select Stock</option>
                                            {filteredStocks.map(s => <option key={s.symbol} value={s.symbol}>{s.symbol} — ₹{s.price?.toFixed(2)}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label>Quantity</label>
                                    <input type="number" min="1" required value={tradeForm.quantity} onChange={e => setTradeForm({ ...tradeForm, quantity: Number(e.target.value) })} />
                                    {tradeForm.symbol && tradeForm.quantity > 0 && (() => {
                                        const s = stocks.find(s => s.symbol === tradeForm.symbol);
                                        const { qty: holdQty, avgCost } = getHolding(user.portfolio, tradeForm.symbol);
                                        const total = (s?.price || 0) * tradeForm.quantity;
                                        const pnlOnSell = tradeForm.action === 'SELL' && avgCost > 0 ? (s?.price - avgCost) * tradeForm.quantity : null;
                                        return (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: tradeForm.action === 'SELL' ? 'var(--success)' : '#94a3b8' }}>
                                                    <span>{tradeForm.action === 'SELL' ? 'Receive:' : 'Total Cost:'}</span>
                                                    <span style={{ fontWeight: 600 }}>₹{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                </div>
                                                {tradeForm.action === 'BUY' && (
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                                                        <span>Remaining Cash:</span>
                                                        <span>₹{(user.balance - total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                    </div>
                                                )}
                                                {pnlOnSell !== null && (
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: pnlOnSell >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                                        <span>Realised P&L:</span>
                                                        <span>{pnlOnSell >= 0 ? '+' : ''}₹{pnlOnSell.toFixed(2)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>

                                <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem' }}>
                                    {tradeForm.action === 'BUY' ? '🟢 Execute Buy' : '🔴 Execute Sell'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleLimitOrder} style={{ marginTop: '1.5rem' }}>
                                <div style={{ padding: '0.75rem', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.8rem', color: '#d8b4fe' }}>
                                    <strong>Limit Orders:</strong> Funds/stocks are locked when the order is placed. The system will auto-execute when the market hits your target price. Cancelling refunds you instantly.
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                    <div className="input-group" style={{ flex: 1, minWidth: '120px', marginBottom: 0 }}>
                                        <label>Action</label>
                                        <select value={orderForm.action} onChange={e => setOrderForm({ ...orderForm, action: e.target.value })}
                                            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', color: 'white', outline: 'none' }}>
                                            <option value="LIMIT_BUY">🟢 Target Buy</option>
                                            <option value="LIMIT_SELL">🔴 Target Sell</option>
                                        </select>
                                    </div>
                                    <div className="input-group" style={{ flex: 1, minWidth: '120px', marginBottom: 0 }}>
                                        <label>Stock</label>
                                        <select required value={orderForm.symbol} onChange={e => setOrderForm({ ...orderForm, symbol: e.target.value })}
                                            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', color: 'white', outline: 'none' }}>
                                            <option value="" disabled>Select Stock</option>
                                            {filteredStocks.map(s => <option key={s.symbol} value={s.symbol}>{s.symbol} — ₹{s.price?.toFixed(2)}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    <div className="input-group" style={{ flex: 1 }}>
                                        <label>Quantity</label>
                                        <input type="number" min="1" required value={orderForm.quantity} onChange={e => setOrderForm({ ...orderForm, quantity: Number(e.target.value) })} />
                                    </div>
                                    <div className="input-group" style={{ flex: 1 }}>
                                        <label>Target Price (₹)</label>
                                        <input type="number" min="0.01" step="0.01" required value={orderForm.targetPrice} onChange={e => setOrderForm({ ...orderForm, targetPrice: Number(e.target.value) })} />
                                    </div>
                                </div>

                                {orderForm.symbol && orderForm.quantity > 0 && orderForm.targetPrice > 0 && (
                                    <div style={{ marginTop: '0.2rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Value Locked:</span>
                                        <span style={{ fontWeight: 600 }}>₹{(orderForm.quantity * orderForm.targetPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                )}

                                <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)' }}>
                                    {orderForm.action === 'LIMIT_BUY' ? '🟢 Place Limit Buy' : '🔴 Place Limit Sell'}
                                </button>
                            </form>
                        )}

                        {/* Holdings Table */}
                        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                            <h3 style={{ fontSize: '1rem', color: '#e2e8f0', marginBottom: '1rem' }}>Your Holdings</h3>
                            {(!user?.portfolio || Object.keys(user.portfolio).filter(sym => getHolding(user.portfolio, sym).qty > 0).length === 0) ? (
                                <div style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0', background: 'rgba(15,23,42,0.4)', borderRadius: '8px' }}>
                                    No positions held. Click any stock card below to analyse &amp; trade.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    {Object.entries(user.portfolio).map(([sym]) => {
                                        const { qty, avgCost } = getHolding(user.portfolio, sym);
                                        if (qty <= 0) return null;
                                        const stock = stocks.find(s => s.symbol === sym);
                                        const currentPrice = stock?.price || 0;
                                        const value = currentPrice * qty;
                                        const pnl = avgCost > 0 ? (currentPrice - avgCost) * qty : 0;
                                        const pnlPct = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;
                                        const isUp = pnl >= 0;
                                        return (
                                            <div key={sym} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(15,23,42,0.4)', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer' }}
                                                onClick={() => { const st = stocks.find(s => s.symbol === sym); if (st) setAnalystStock(st); }}>
                                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                    {stock?.logoUrl && <img src={stock.logoUrl} className="stock-logo" alt="" onError={(e: any) => e.target.style.display = 'none'} />}
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>{sym}</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{qty} shares • Avg ₹{avgCost.toFixed(2)}</div>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 600 }}>₹{value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                                    <div style={{ fontSize: '0.72rem', color: isUp ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                                        {isUp ? '+' : ''}₹{pnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                                                    </div>
                                                </div>
                                                <button onClick={e => { e.stopPropagation(); setTradeTab('MARKET'); setTradeForm({ symbol: sym, action: 'SELL', quantity: qty }); scrollToTrade(); }}
                                                    style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid currentColor', padding: '0.25rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                                                    SELL
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Orders & History Section */}
                        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1rem', color: '#e2e8f0' }}>Orders & History</h3>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {/* Active Limit Orders */}
                                <div>
                                    <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Pending Limits</h4>
                                    {orders.filter((o: any) => o.status === 'PENDING').length === 0 ? (
                                        <div style={{ color: '#64748b', fontSize: '0.8rem', padding: '1rem', background: 'rgba(15,23,42,0.4)', borderRadius: '8px', textAlign: 'center' }}>
                                            No active limit orders
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                            {orders.filter((o: any) => o.status === 'PENDING').map((order: any) => (
                                                <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(139,92,246,0.05)', borderRadius: '8px', border: '1px dashed rgba(139,92,246,0.4)' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: order.action === 'LIMIT_BUY' ? '#10b981' : '#ef4444' }}>
                                                            {order.action === 'LIMIT_BUY' ? 'BUY' : 'SELL'} {order.quantity} {order.symbol}
                                                        </div>
                                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Target: ₹{order.targetPrice.toFixed(2)}</div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Locked: ₹{(order.targetPrice * order.quantity).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                                        <button onClick={() => cancelOrder(order.id)}
                                                            style={{ marginTop: '0.25rem', background: 'transparent', color: '#94a3b8', border: 'none', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.7rem' }}>
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Recent Transactions */}
                                <div>
                                    <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Recent Activity</h4>
                                    {(!Array.isArray(history) || history.length === 0) ? (
                                        <div style={{ color: '#64748b', fontSize: '0.8rem', padding: '1rem', background: 'rgba(15,23,42,0.4)', borderRadius: '8px', textAlign: 'center' }}>
                                            No recent transactions
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                            {history.slice(0, 50).map((tx: any) => (
                                                <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(15,23,42,0.6)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: tx.type === 'BUY' ? '#10b981' : '#ef4444' }}>
                                                            {tx.type} {tx.quantity} {tx.symbol}
                                                        </div>
                                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                            {new Date(tx.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            {tx.isLimitOrder ? ' • LIMIT' : ' • MARKET'}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right', fontWeight: 600 }}>
                                                        ₹{tx.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Live Market Grid ── */}
                <div className="card" style={{ marginTop: '2rem' }}>
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>Live Market</span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>Click any stock for full analysis →</span>
                        </div>
                        <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.25rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: isMobile ? '100%' : '250px' }}>
                            <span style={{ fontSize: '0.9rem' }}>🔍</span>
                            <input 
                                type="text" 
                                placeholder="Search Symbol, Name..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: 'white', padding: '0.4rem', outline: 'none', fontSize: '0.85rem', width: '100%' }}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                        {filteredStocks.map(stock => {
                            const prev = stock.previousPrice || stock.price;
                            const diff = stock.price - prev;
                            const pct = prev !== 0 ? (diff / prev) * 100 : 0;
                            const isUp = diff >= 0;
                            const color = diff === 0 ? '#94a3b8' : isUp ? 'var(--success)' : 'var(--danger)';
                            const isSelected = selectedChartStock === stock.symbol;

                            return (
                                <div key={stock.symbol}
                                    onClick={() => { setSelectedChartStock(stock.symbol); setAnalystStock(stock); setTradeForm({ ...tradeForm, symbol: stock.symbol }); scrollToTrade(); }}
                                    style={{ cursor: 'pointer', padding: '1rem', border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '8px', background: isSelected ? 'rgba(59,130,246,0.1)' : 'rgba(15,23,42,0.4)', transition: 'all 0.2s ease' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                            {stock.logoUrl && <img src={stock.logoUrl} className="stock-logo" alt="" onError={(e: any) => e.target.style.display = 'none'} />}
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{stock.symbol}</div>
                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{stock.name}</div>
                                                {stock.sector && <div style={{ fontSize: '0.65rem', color: '#c084fc', marginTop: '0.15rem' }}>{stock.sector}</div>}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 700, fontSize: '1.1rem', color }}> ₹{stock.price.toFixed(2)}</div>
                                            <div style={{ fontSize: '0.78rem', color, fontWeight: 600 }}>
                                                {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
                                            </div>
                                            {stock.pe && <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.1rem' }}>P/E {stock.pe}</div>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Market Chart ── */}
                <div className="card" style={{ marginTop: '2rem' }}>
                    <div className="card-header">
                        Price Chart: <span style={{ color: 'var(--primary)', marginLeft: '0.5rem' }}>{selectedChartStock}</span>
                        {selectedStock && (
                            <button onClick={() => setAnalystStock(selectedStock)}
                                style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', background: 'rgba(139,92,246,0.2)', color: '#c084fc', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '6px', cursor: 'pointer' }}>
                                Full Analysis →
                            </button>
                        )}
                    </div>
                    <div style={{ width: '100%', height: '350px', marginTop: '1rem' }}>
                        {selectedStock?.history ? (
                            <Line
                                data={{
                                    labels: selectedStock.history.map((_: any, i: number) => i),
                                    datasets: [{
                                        label: 'Price (₹)',
                                        data: selectedStock.history,
                                        borderColor: 'rgba(139,92,246,1)',
                                        backgroundColor: 'rgba(139,92,246,0.12)',
                                        borderWidth: 2, tension: 0.4, pointRadius: 0, fill: true,
                                    }]
                                }}
                                options={{
                                    responsive: true, maintainAspectRatio: false,
                                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `₹${ctx.raw.toFixed(2)}` } } },
                                    interaction: { intersect: false, mode: 'index' },
                                    scales: {
                                        x: { display: false },
                                        y: { ticks: { color: '#94a3b8', callback: (v: any) => `₹${v.toFixed(0)}` }, grid: { color: 'rgba(255,255,255,0.06)' } }
                                    }
                                }}
                            />
                        ) : (
                            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                Awaiting market data...
                            </div>
                        )}
                    </div>
                </div>

            {analystStock && (
                <StockAnalyst
                    stock={analystStock}
                    userHolding={(() => {
                        const { qty, avgCost } = getHolding(user.portfolio, analystStock.symbol);
                        return qty > 0 ? { qty, avgCost } : null;
                    })()}
                    onClose={() => setAnalystStock(null)}
                    onTrade={(symbol, action) => setTradeForm({ symbol, action, quantity: 1 })}
                />
            )}

                </div> {/* Close dashboard-container */}
            </div> {/* Close dashboard-page-wrapper */}
        </main>
    );
}
