"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { PRESET_EVENTS } from '@/lib/marketEvents';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

type Tab = 'overview' | 'market' | 'corporate' | 'events' | 'students' | 'risk' | 'activity' | 'security';

const SENTIMENT_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
    bull: { label: '🟢 BULL', color: '#10b981', desc: 'Strong upward bias (+0.45% drift/tick)' },
    bear: { label: '🔴 BEAR', color: '#ef4444', desc: 'Downward pressure (-0.35% drift/tick)' },
    volatile: { label: '⚡ VOLATILE', color: '#f59e0b', desc: '2× amplitude, neutral drift (high chaos)' },
    normal: { label: '⚪ NORMAL', color: '#94a3b8', desc: 'Standard GBM with +0.12% upward bias' },
};

export default function AdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [risk, setRisk] = useState<any[]>([]);
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('overview');
    const [selectedUserForActivity, setSelectedUserForActivity] = useState<any>(null);
    const [selectedChartStock, setSelectedChartStock] = useState('^BSESN');
    const [flashMap, setFlashMap] = useState<Record<string, 'up' | 'down' | null>>({});
    const [annForm, setAnnForm] = useState({ title: '', body: '' });
    const [eventFeedback, setEventFeedback] = useState('');

    // Admin Control Forms State
    const [corpActionForm, setCorpActionForm] = useState({ symbol: '', action: 'DIVIDEND', amount: '' });
    const [ipoForm, setIpoForm] = useState({ symbol: '', name: '', sector: '', initialPrice: '', shares: '', logoUrl: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');

    // Security 
    const [anomalies, setAnomalies] = useState<any[]>([]);
    const [lastScannedEvent, setLastScannedEvent] = useState('');
    const prevPrices = useRef<Record<string, number>>({});
    const router = useRouter();

    useEffect(() => {
        const storedTheme = localStorage.getItem('theme') as 'dark' | 'light';
        if (storedTheme) {
            setTheme(storedTheme);
            document.body.classList.toggle('light-theme', storedTheme === 'light');
        }

        const storedUser = localStorage.getItem('user');
        if (!storedUser) { router.push('/login?admin=true'); return; }
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser.role !== 'admin') { router.push('/dashboard'); return; }

        fetchAll();
        const ti = setInterval(fetchSnapshot, 15000); // Poll every 15s instead of 2s to save Firestore quota
        return () => clearInterval(ti);
    }, [router]);

    const fetchSnapshot = async () => {
        // Just fetch stats, don't trigger a tick automatically to save quota
        fetchAll();
    };

    const triggerManualTick = async () => {
        setLoading(true);
        await fetch('/api/admin/stocks/tick', { method: 'POST' });
        await fetchAll();
        setLoading(false);
    };

    const fetchAll = async () => {
        try {
            const [statsRes, riskRes, annRes, anomalyRes] = await Promise.all([
                fetch('/api/admin/stats'),
                fetch('/api/admin/risk'),
                fetch('/api/announcements'),
                fetch('/api/admin/anomaly?adminId=admin-001'),
            ]);
            const statsData = await statsRes.json();
            const riskData = await riskRes.json();
            const annData = await annRes.json();
            const anomalyData = await anomalyRes.json();

            if (statsData.defaultStockPrices) {
                const newFlash: Record<string, 'up' | 'down' | null> = {};
                Object.entries(statsData.defaultStockPrices as Record<string, number>).forEach(([sym, price]) => {
                    const prev = prevPrices.current[sym];
                    if (prev !== undefined && price !== prev) newFlash[sym] = price > prev ? 'up' : 'down';
                });
                prevPrices.current = { ...statsData.defaultStockPrices };
                setFlashMap(newFlash);
                if (Object.keys(newFlash).length > 0) setTimeout(() => setFlashMap({}), 900);
            }

            setStats(statsData);
            setRisk(Array.isArray(riskData) ? riskData : []);
            setAnnouncements(Array.isArray(annData) ? annData : []);

            if (anomalyData && anomalyData.anomalies) {
                setAnomalies(anomalyData.anomalies);
                setLastScannedEvent(anomalyData.lastScannedEvent || 'None');
            }

            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    // ── API helpers ──────────────────────────────────────────────────────────
    const setSentiment = async (sentiment: string) => {
        await fetch('/api/admin/market/sentiment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: 'admin-001', sentiment }),
        });
        setEventFeedback(`✅ Market sentiment set to ${sentiment.toUpperCase()}`);
        fetchAll();
    };

    const triggerEvent = async (eventId: string) => {
        const res = await fetch('/api/admin/market/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: 'admin-001', eventId }),
        });
        const data = await res.json();
        setEventFeedback(data.success ? `🚀 Event queued: ${data.event}` : `❌ ${data.error}`);
        setTimeout(() => setEventFeedback(''), 6000);
        fetchAll();
    };

    const postAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!annForm.title.trim()) return;
        await fetch('/api/announcements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: 'admin-001', ...annForm }),
        });
        setAnnForm({ title: '', body: '' });
        fetchAll();
    };

    const clearAnnouncements = async () => {
        await fetch('/api/announcements', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: 'admin-001' }),
        });
        fetchAll();
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Delete this user permanently?')) return;
        const res = await fetch('/api/admin/users/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: 'admin-001', userIdToDelete: userId }),
        });
        if (res.ok) fetchAll();
    };

    const handleSuspendUser = async (userId: string, suspend: boolean) => {
        const res = await fetch('/api/admin/users/suspend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: 'admin-001', userId, suspend }),
        });
        if (res.ok) fetchAll();
    };

    const handleDeleteStock = async (symbol: string) => {
        if (!confirm(`Delete ${symbol} permanently?`)) return;
        const res = await fetch('/api/admin/stocks/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: 'admin-001', symbol }),
        });
        if (res.ok) fetchAll();
    };

    const handleStockUpdate = async (symbol: string, action: string, value?: number | boolean) => {
        await fetch('/api/admin/stocks/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: 'admin-001', symbol, action, value }),
        });
        fetchAll();
    };

    const handleCorporateAction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!corpActionForm.symbol) return;

        const isDividend = corpActionForm.action === 'DIVIDEND';
        if (isDividend && (!corpActionForm.amount || isNaN(Number(corpActionForm.amount)))) return;

        if (!confirm(`Are you sure you want to execute ${isDividend ? `a ₹${corpActionForm.amount} Dividend` : 'a 2-for-1 Split'} for ${corpActionForm.symbol}?`)) return;

        await fetch('/api/admin/corporate-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminId: 'admin-001',
                symbol: corpActionForm.symbol,
                action: corpActionForm.action,
                amount: isDividend ? Number(corpActionForm.amount) : undefined
            }),
        });

        setCorpActionForm({ symbol: '', action: 'DIVIDEND', amount: '' });
        fetchAll();
        setTab('events'); // Navigate to see announcement
    };

    const handleLaunchIPO = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ipoForm.symbol || !ipoForm.name || !ipoForm.sector || !ipoForm.initialPrice) return;

        const res = await fetch('/api/admin/ipo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminId: 'admin-001',
                symbol: ipoForm.symbol,
                name: ipoForm.name,
                sector: ipoForm.sector,
                initialPrice: Number(ipoForm.initialPrice),
                shares: Number(ipoForm.shares),
                logoUrl: ipoForm.logoUrl
            }),
        });

        const data = await res.json();
        if (res.ok) {
            setIpoForm({ symbol: '', name: '', sector: '', initialPrice: '', shares: '' });
            fetchAll();
            setTab('market'); // Jump to see the new stock
        } else {
            alert(`IPO Failed: ${data.error}`);
        }
    };

    if (loading || !stats) return <div className="auth-container"><h2 className="title-glow">Loading Admin Portal...</h2></div>;
    if (!stats.leaderboard) stats.leaderboard = [];
    if (!stats.recentTransactions) stats.recentTransactions = [];
    if (!stats.defaultStockPrices) stats.defaultStockPrices = {};
    if (!stats.loans) stats.loans = [];
    if (!stats.stockAutoUpdates) stats.stockAutoUpdates = {};

    const sentiment: string = stats.marketState?.sentiment ?? 'normal';
    const sentCfg = SENTIMENT_CONFIG[sentiment] ?? SENTIMENT_CONFIG.normal;
    const totalMarketCap = Object.values(stats.defaultStockPrices as Record<string, number>).reduce((a, b) => a + b, 0);
    const totalTrades = stats.recentTransactions.length;
    const highRiskCount = risk.filter((r: any) => r.riskLevel === 'HIGH').length;

    const filteredStocks = useMemo(() => {
        if (!stats.defaultStockPrices) return [];
        return Object.keys(stats.defaultStockPrices)
            .filter(symbol => 
                symbol.toLowerCase().includes(searchTerm.toLowerCase()) || 
                (stats.stockMeta?.[symbol]?.sector || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (stats.stockMeta?.[symbol]?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => a.localeCompare(b));
    }, [stats.defaultStockPrices, stats.stockMeta, searchTerm]);

    const TABS: { id: Tab; label: string; icon: string }[] = [
        { id: 'overview', label: 'Overview', icon: '📊' },
        { id: 'market', label: 'Live Market', icon: '📈' },
        { id: 'corporate', label: 'Corp Actions & IPO', icon: '🏢' },
        { id: 'events', label: 'Market Events', icon: '⚡' },
        { id: 'students', label: 'Students', icon: '🎓' },
        { id: 'risk', label: `Risk Monitor${highRiskCount > 0 ? ` 🔴${highRiskCount}` : ''}`, icon: '🛡' },
        { id: 'activity', label: 'Activity', icon: '🔄' },
        { id: 'security', label: `Security Desk${anomalies.length > 0 ? ` 🚨${anomalies.length}` : ''}`, icon: '🕵️' },
        { id: 'support' as any, label: 'Support Desk', icon: '🎧' },
    ];

    return (
        <>
            {/* ── Navbar ── */}
            <nav className="navbar" style={{ background: 'rgba(10,15,30,0.97)', borderBottom: '1px solid var(--accent)' }}>
                <div className="nav-brand">
                    Stock<span style={{ color: 'var(--accent)' }}>X</span>
                    <span style={{ fontSize: '0.75rem', marginLeft: '0.5rem', background: 'rgba(139,92,246,0.2)', color: 'var(--accent)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>ADMIN</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.75rem', background: `${sentCfg.color}18`, border: `1px solid ${sentCfg.color}55`, borderRadius: '6px', fontSize: '0.8rem' }}>
                        <span style={{ color: sentCfg.color, fontWeight: 700 }}>{sentCfg.label}</span>
                    </div>
                    {stats.marketState?.lastEvent && (
                        <span style={{ fontSize: '0.75rem', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Last: {stats.marketState.lastEvent.description}
                        </span>
                    )}
                </div>
                <div className="nav-links">
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Administrator</span>
                    <button className="nav-btn" onClick={triggerManualTick} style={{ background: 'var(--accent)', color: '#0f172a' }} disabled={loading}>
                        {loading ? '⏳ Updating...' : '⚡ Force Market Tick'}
                    </button>
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

            {/* ── Tab Bar ── */}
            <div style={{ background: 'rgba(10,15,30,0.9)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 0, overflowX: 'auto' }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                        padding: '0.75rem 1.25rem', background: 'transparent', border: 'none', borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                        color: tab === t.id ? 'var(--accent)' : '#94a3b8', cursor: 'pointer', fontWeight: tab === t.id ? 700 : 400, fontSize: '0.85rem', whiteSpace: 'nowrap', transition: 'all 0.2s',
                    }}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {tab === 'support' as any && (
                <div className="dashboard-container">
                   <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
                        <h2 className="title-glow">Support Desk is Active</h2>
                        <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>All user messages are being tracked in the specialized Support Portal.</p>
                        <button onClick={() => router.push('/admin/support')} className="nav-btn">Open Support Portal →</button>
                   </div>
                </div>
            )}

            <div className="dashboard-container">

                {/* ══════════════════ OVERVIEW TAB ══════════════════ */}
                {tab === 'overview' && (
                    <>
                        {/* Stat cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                            {[
                                { label: 'Total Students', value: stats.leaderboard.length, icon: '🎓', color: '#3b82f6' },
                                { label: 'Total Trades', value: totalTrades, icon: '🔄', color: '#10b981' },
                                { label: 'Active Loans', value: stats.loans.filter((l: any) => l.status === 'ACTIVE').length, icon: '💰', color: '#f59e0b' },
                                { label: 'High-Risk Students', value: highRiskCount, icon: '⚠️', color: '#ef4444' },
                                { label: 'Market Sentiment', value: sentiment.toUpperCase(), icon: '📡', color: sentCfg.color },
                                { label: 'Pending Announcements', value: announcements.length, icon: '📢', color: '#8b5cf6' },
                            ].map((m) => (
                                <div key={m.label} style={{ background: 'var(--secondary)', border: `1px solid ${m.color}33`, borderRadius: '12px', padding: '1.2rem 1.5rem' }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>{m.icon}</div>
                                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: m.color }}>{m.value}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{m.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Leaderboard + Announcements */}
                        <div className="grid-2">
                            <div className="card">
                                <div className="card-header" style={{ borderBottomColor: 'var(--accent)' }}>🏆 Leaderboard</div>
                                <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                                    <table className="table">
                                        <thead>
                                            <tr><th>Rank</th><th>Student</th><th>Wealth</th><th>P&L</th><th>Holdings</th></tr>
                                        </thead>
                                        <tbody>
                                            {stats.leaderboard.map((s: any, i: number) => (
                                                <tr key={s.id} className="table-row-hover" style={{ cursor: 'pointer' }} onClick={() => { setSelectedUserForActivity(s); setTab('activity'); }}>
                                                    <td style={{ fontWeight: 700, color: i === 0 ? '#fbbf24' : i === 1 ? '#e2e8f0' : i === 2 ? '#cd7f32' : 'inherit' }}>
                                                        #{i + 1} {i === 0 && '🏆'}
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>@{s.username}</div>
                                                    </td>
                                                    <td style={{ fontWeight: 600 }}>₹{s.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                                    <td className={s.profit >= 0 ? 'stat-up' : 'stat-down'} style={{ fontWeight: 600 }}>
                                                        {s.profit >= 0 ? '+' : ''}{s.profitRate.toFixed(2)}%
                                                    </td>
                                                    <td style={{ color: '#94a3b8' }}>{s.holdingsCount} stocks</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header" style={{ borderBottomColor: 'var(--accent)' }}>
                                    📢 Announcements Board
                                    <button onClick={clearAnnouncements} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '4px', cursor: 'pointer' }}>Clear All</button>
                                </div>

                                <form onSubmit={postAnnouncement} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <input placeholder="Headline..." value={annForm.title} onChange={e => setAnnForm({ ...annForm, title: e.target.value })}
                                        style={{ padding: '0.5rem', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', fontSize: '0.85rem' }} />
                                    <textarea placeholder="Message body (optional)..." value={annForm.body} onChange={e => setAnnForm({ ...annForm, body: e.target.value })} rows={2}
                                        style={{ padding: '0.5rem', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', borderRadius: '6px', color: 'white', fontSize: '0.85rem', resize: 'vertical' }} />
                                    <button type="submit" style={{ padding: '0.5rem', background: 'rgba(139,92,246,0.25)', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                                        📢 Post Announcement
                                    </button>
                                </form>

                                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '300px', overflowY: 'auto' }}>
                                    {announcements.length === 0 ? (
                                        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No announcements yet.</p>
                                    ) : announcements.map((a: any) => (
                                        <div key={a.id} style={{ position: 'relative', padding: '0.75rem', background: a.type === 'event' ? 'rgba(239,68,68,0.07)' : a.type === 'sentiment' ? 'rgba(245,158,11,0.07)' : 'rgba(139,92,246,0.07)', borderRadius: '8px', border: `1px solid ${a.type === 'event' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                                            <button onClick={async () => { await fetch('/api/announcements', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId: 'admin-001', id: a.id }) }); fetchAll(); }} style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                                            <div style={{ fontWeight: 600, fontSize: '0.82rem', paddingRight: '1rem' }}>{a.title}</div>
                                            {a.body && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>{a.body}</div>}
                                            <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '0.3rem' }}>{new Date(a.timestamp).toLocaleTimeString()}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* ══════════════════ LIVE MARKET TAB ══════════════════ */}
                {tab === 'market' && (
                    <>
                        <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '1.2rem' }}>🔍</span>
                                <input 
                                    type="text" 
                                    placeholder="Search by Symbol, Name or Sector..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', padding: '0.5rem', outline: 'none', fontSize: '1rem' }}
                                />
                                {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>}
                            </div>
                        </div>
                        <div className="grid-2" style={{ marginBottom: '2rem' }}>
                            {/* Chart */}
                            <div className="card">
                                <div className="card-header">📈 {selectedChartStock} — Price Chart</div>
                                <div style={{ height: '350px', marginTop: '1rem' }}>
                                    {stats.historicalData?.[selectedChartStock] ? (
                                        <Line
                                            data={{
                                                labels: stats.historicalData[selectedChartStock].map((_: any, i: number) => i),
                                                datasets: [{
                                                    data: stats.historicalData[selectedChartStock],
                                                    borderColor: 'rgba(139,92,246,1)', backgroundColor: 'rgba(139,92,246,0.1)',
                                                    borderWidth: 2, tension: 0.4, pointRadius: 0, fill: true,
                                                }]
                                            }}
                                            options={{
                                                responsive: true, maintainAspectRatio: false,
                                                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `₹${ctx.raw.toFixed(2)}` } } },
                                                scales: { x: { display: false }, y: { ticks: { color: '#94a3b8', callback: (v: any) => `₹${v.toFixed(0)}` }, grid: { color: 'rgba(255,255,255,0.05)' } } }
                                            }}
                                        />
                                    ) : <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Accumulating data...</div>}
                                </div>
                            </div>

                            {/* Live fluctuations */}
                            <div className="card">
                                <div className="card-header">⚡ Live Fluctuations <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 400 }}>(GBM · 2s tick)</span></div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', maxHeight: '380px', overflowY: 'auto' }}>
                                    {filteredStocks.map(symbol => {
                                        const history = stats.historicalData?.[symbol] || [];
                                        const cur = history.length > 0 ? history[history.length - 1] : stats.defaultStockPrices[symbol];
                                        const prv = history.length > 1 ? history[history.length - 2] : cur;
                                        const diff = cur - prv;
                                        const pct = prv !== 0 ? (diff / prv) * 100 : 0;
                                        const isUp = diff > 0;
                                        const meta = stats.stockMeta?.[symbol] ?? {};
                                        return (
                                            <div key={symbol} onClick={() => setSelectedChartStock(symbol)}
                                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', background: selectedChartStock === symbol ? 'rgba(59,130,246,0.1)' : 'rgba(15,23,42,0.4)', borderRadius: '8px', border: flashMap[symbol] ? `1px solid ${flashMap[symbol] === 'up' ? 'var(--success)' : 'var(--danger)'}` : '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s' }}>
                                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                    {meta.logoUrl && <img src={meta.logoUrl} className="stock-logo" alt="" onError={(e: any) => e.target.style.display = 'none'} />}
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{symbol}</div>
                                                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{meta.sector}</div>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div className={flashMap[symbol] === 'up' ? 'price-flash-up' : flashMap[symbol] === 'down' ? 'price-flash-down' : ''} style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                                        ₹{cur.toFixed(2)}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: isUp ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                                                        {isUp ? '▲' : '▼'} {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Stock Control Center */}
                        <div className="card">
                            <div className="card-header">🎛️ Market Control Center</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                                {filteredStocks.map(symbol => {
                                    const meta = stats.stockMeta?.[symbol] ?? {};
                                    const isAuto = stats.stockAutoUpdates[symbol] !== false;
                                    const halted = stats.marketState?.haltedStocks?.includes(symbol);
                                    return (
                                        <div key={symbol} style={{ padding: '1rem', background: 'rgba(15,23,42,0.5)', borderRadius: '10px', border: halted ? '1px solid #f59e0b' : '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                    {meta.logoUrl && <img src={meta.logoUrl} className="stock-logo" alt="" onError={(e: any) => e.target.style.display = 'none'} />}
                                                    <div>
                                                        <div style={{ fontWeight: 700 }}>{symbol}</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{meta.sector}</div>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>₹{stats.defaultStockPrices[symbol].toFixed(2)}</div>
                                                    {halted && <span style={{ fontSize: '0.65rem', color: '#f59e0b' }}>⏸ HALTED</span>}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                {halted ? (
                                                    <button onClick={() => handleStockUpdate(symbol, 'UNHALT')}
                                                        style={{ flex: 1, minWidth: '70px', padding: '0.35rem 0.4rem', fontSize: '0.7rem', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid #f59e0b', borderRadius: '4px', cursor: 'pointer' }}>
                                                        ▶ Unhalt
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleStockUpdate(symbol, 'HALT')}
                                                        style={{ flex: 1, minWidth: '70px', padding: '0.35rem 0.4rem', fontSize: '0.7rem', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.5)', borderRadius: '4px', cursor: 'pointer' }}>
                                                        ⏸ Halt
                                                    </button>
                                                )}
                                                <button onClick={() => handleStockUpdate(symbol, 'TOGGLE_AUTO', !isAuto)}
                                                    style={{ flex: 1, minWidth: '70px', padding: '0.35rem 0.4rem', fontSize: '0.7rem', background: isAuto ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)', color: isAuto ? 'var(--success)' : '#94a3b8', border: `1px solid ${isAuto ? 'var(--success)' : '#475569'}`, borderRadius: '4px', cursor: 'pointer' }}>
                                                    {isAuto ? '✓ Auto' : '✗ Manual'}
                                                </button>
                                                <button onClick={() => handleStockUpdate(symbol, 'HIKE', 5)}
                                                    style={{ flex: 1, minWidth: '55px', padding: '0.35rem 0.4rem', fontSize: '0.7rem', background: 'rgba(16,185,129,0.15)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: '4px', cursor: 'pointer' }}>
                                                    +5%
                                                </button>
                                                <button onClick={() => handleStockUpdate(symbol, 'DROP', 5)}
                                                    style={{ flex: 1, minWidth: '55px', padding: '0.35rem 0.4rem', fontSize: '0.7rem', background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '4px', cursor: 'pointer' }}>
                                                    -5%
                                                </button>
                                                <button onClick={() => { const v = prompt(`Set exact price for ${symbol}:`); if (v && !isNaN(Number(v))) handleStockUpdate(symbol, 'SET_PRICE', Number(v)); }}
                                                    style={{ flex: 1, minWidth: '60px', padding: '0.35rem 0.4rem', fontSize: '0.7rem', background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid #38bdf8', borderRadius: '4px', cursor: 'pointer' }}>
                                                    Set ₹
                                                </button>
                                                <button onClick={() => handleDeleteStock(symbol)}
                                                    style={{ flex: 1, minWidth: '60px', padding: '0.35rem 0.4rem', fontSize: '0.7rem', background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '4px', cursor: 'pointer' }}>
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {/* ══════════════════ CORPORATE & IPO TAB ══════════════════ */}
                {tab === 'corporate' as Tab && (
                    <div className="grid-2" style={{ marginBottom: '2rem' }}>

                        {/* Corporate Actions Block */}
                        <div className="card">
                            <div className="card-header">🏦 Execute Corporate Event</div>
                            <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                                Issue cash dividends directly to shareholders, or execute a 2-for-1 stock split to double shares and halve the price to increase liquidity.
                            </p>

                            <form onSubmit={handleCorporateAction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label>Action Type</label>
                                    <select value={corpActionForm.action} onChange={e => setCorpActionForm({ ...corpActionForm, action: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', color: 'white', outline: 'none' }}>
                                        <option value="DIVIDEND">💰 Cash Dividend</option>
                                        <option value="SPLIT_2_FOR_1">✂️ 2-for-1 Stock Split</option>
                                    </select>
                                </div>

                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label>Target Stock</label>
                                    <select required value={corpActionForm.symbol} onChange={e => setCorpActionForm({ ...corpActionForm, symbol: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', color: 'white', outline: 'none' }}>
                                        <option value="" disabled>Select Stock</option>
                                        {Object.keys(stats.defaultStockPrices).map(sym => (
                                            <option key={sym} value={sym}>{sym} — ₹{stats.defaultStockPrices[sym].toFixed(2)}</option>
                                        ))}
                                    </select>
                                </div>

                                {corpActionForm.action === 'DIVIDEND' && (
                                    <div className="input-group" style={{ marginBottom: 0 }}>
                                        <label>Dividend Amount (₹ per share)</label>
                                        <input type="number" min="0.01" step="0.01" required value={corpActionForm.amount} onChange={e => setCorpActionForm({ ...corpActionForm, amount: e.target.value })} placeholder="e.g. 5.50" />
                                    </div>
                                )}

                                <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', background: corpActionForm.action === 'DIVIDEND' ? 'var(--success)' : '#8b5cf6', borderColor: 'transparent' }}>
                                    {corpActionForm.action === 'DIVIDEND' ? 'Issue Dividend Payout' : 'Execute 2-for-1 Split'}
                                </button>
                            </form>
                        </div>

                        {/* IPO Engine Block */}
                        <div className="card">
                            <div className="card-header">🚀 Dynamic IPO Engine</div>
                            <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                                List a brand-new company on the simulated exchange mid-game. It will instantly appear for all users to trade with high initial volatility.
                            </p>

                            <form onSubmit={handleLaunchIPO} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label>Company/Stock Symbol</label>
                                        <input type="text" required placeholder="e.g. NVDA" value={ipoForm.symbol} onChange={e => setIpoForm({ ...ipoForm, symbol: e.target.value.toUpperCase().replace(/\s/g, '') })} maxLength={8} />
                                    </div>
                                    <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label>Full Company Name</label>
                                        <input type="text" required placeholder="e.g. Nvidia Corp" value={ipoForm.name} onChange={e => setIpoForm({ ...ipoForm, name: e.target.value })} />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label>Sector / Category</label>
                                        <input type="text" required placeholder="e.g. tech, banking, indices..." value={ipoForm.sector} onChange={e => setIpoForm({ ...ipoForm, sector: e.target.value.toLowerCase() })} />
                                    </div>
                                    <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label>Listing Price (₹)</label>
                                        <input type="number" min="1" required step="1" placeholder="e.g. 500" value={ipoForm.initialPrice} onChange={e => setIpoForm({ ...ipoForm, initialPrice: e.target.value })} />
                                    </div>
                                    <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label>Total Shares</label>
                                        <input type="number" min="1" required step="1" placeholder="e.g. 10000" value={ipoForm.shares} onChange={e => setIpoForm({ ...ipoForm, shares: e.target.value })} />
                                    </div>
                                    <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                                        <label>Logo URL (optional)</label>
                                        <input type="text" placeholder="https://..." value={ipoForm.logoUrl} onChange={e => setIpoForm({ ...ipoForm, logoUrl: e.target.value })} />
                                    </div>
                                </div>

                                <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem', background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)', boxShadow: '0 4px 14px rgba(251, 191, 36, 0.4)', color: '#0f172a' }}>
                                    🔔 Ring Bell & Launch IPO
                                </button>
                            </form>
                        </div>

                    </div>
                )}

                {/* ══════════════════ EVENTS TAB ══════════════════ */}
                {tab === 'events' && (
                    <>
                        {/* Sentiment Control */}
                        <div className="card" style={{ marginBottom: '2rem' }}>
                            <div className="card-header">📡 Market Sentiment Control</div>
                            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.75rem', marginBottom: '1rem' }}>
                                Sentiment changes the GBM drift and volatility amplitude for ALL stocks in real time.
                                Current: <strong style={{ color: sentCfg.color }}>{sentCfg.label}</strong> — {sentCfg.desc}
                            </p>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                {Object.entries(SENTIMENT_CONFIG).map(([key, cfg]) => (
                                    <button key={key} onClick={() => setSentiment(key)}
                                        style={{ flex: 1, minWidth: '140px', padding: '0.85rem', background: sentiment === key ? `${cfg.color}28` : 'rgba(15,23,42,0.4)', color: sentiment === key ? cfg.color : '#94a3b8', border: `2px solid ${sentiment === key ? cfg.color : 'var(--border)'}`, borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', transition: 'all 0.2s' }}>
                                        <div>{cfg.label}</div>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 400, marginTop: '0.25rem', color: sentiment === key ? cfg.color : '#475569' }}>{cfg.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Event feedback */}
                        {eventFeedback && (
                            <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '8px', color: '#c084fc', fontWeight: 600 }}>
                                {eventFeedback}
                            </div>
                        )}

                        {/* Preset Events */}
                        <div className="card">
                            <div className="card-header">⚡ Market Events — Fire Instantly</div>
                            <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
                                Events are queued and applied on the next market tick (within 2 seconds). They trigger realistic price impacts with sector spillover.
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.75rem' }}>
                                {PRESET_EVENTS.map((ev: any) => {
                                    const isPositive = ev.impact >= 0;
                                    return (
                                        <div key={ev.id} style={{ padding: '0.85rem 1rem', background: isPositive ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${isPositive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.25rem' }}>{ev.label}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: 1.4 }}>{ev.description}</div>
                                            </div>
                                            <button onClick={() => triggerEvent(ev.id)}
                                                style={{ padding: '0.5rem 0.85rem', background: isPositive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: isPositive ? 'var(--success)' : 'var(--danger)', border: `1px solid ${isPositive ? 'var(--success)' : 'var(--danger)'}`, borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                {isPositive ? '+' : ''}{ev.impact}% 🚀
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {/* ══════════════════ STUDENTS TAB ══════════════════ */}
                {tab === 'students' && (
                    <div className="card">
                        <div className="card-header" style={{ borderBottomColor: 'var(--accent)' }}>🎓 Student Management</div>
                        <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Rank</th><th>Name</th><th>Total Wealth</th><th>Cash</th><th>Equity</th><th>Debt</th><th>P&L</th><th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.leaderboard.map((s: any, i: number) => (
                                        <tr key={s.id} className="table-row-hover">
                                            <td style={{ fontWeight: 700, color: i === 0 ? '#fbbf24' : i === 1 ? '#e2e8f0' : i === 2 ? '#cd7f32' : 'inherit' }}>#{i + 1}</td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{s.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>@{s.username}</div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>₹{s.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                            <td>₹{s.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                            <td style={{ color: '#38bdf8' }}>₹{s.portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                            <td style={{ color: s.activeDebt > 0 ? 'var(--danger)' : '#64748b' }}>
                                                {s.activeDebt > 0 ? `-₹${s.activeDebt.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                                            </td>
                                            <td className={s.profit >= 0 ? 'stat-up' : 'stat-down'} style={{ fontWeight: 600 }}>
                                                {s.profit >= 0 ? '+' : ''}{s.profitRate.toFixed(2)}%
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                    {s.suspended ? (
                                                        <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 800 }}>⛔ SUSPENDED</span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                    <button onClick={() => { setSelectedUserForActivity(s); setTab('activity'); }}
                                                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem', background: 'rgba(59,130,246,0.2)', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '4px', cursor: 'pointer' }}>
                                                        Activity
                                                    </button>
                                                    <button onClick={() => handleSuspendUser(s.id, !s.suspended)}
                                                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem', background: s.suspended ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)', color: s.suspended ? 'var(--success)' : '#f59e0b', border: `1px solid ${s.suspended ? 'var(--success)' : '#f59e0b'}`, borderRadius: '4px', cursor: 'pointer' }}>
                                                        {s.suspended ? 'Unsuspend' : 'Suspend'}
                                                    </button>
                                                    <button onClick={() => handleDeleteUser(s.id)}
                                                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem', background: 'rgba(239,68,68,0.2)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '4px', cursor: 'pointer' }}>
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ══════════════════ RISK MONITOR TAB ══════════════════ */}
                {tab === 'risk' && (
                    <div className="card">
                        <div className="card-header">🛡 Real-Time Risk Monitor</div>
                        <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
                            Risk score based on: portfolio concentration (largest single position %), leverage ratio (debt/wealth), and low-cash warnings.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {risk.length === 0 ? <p style={{ color: '#64748b' }}>No student data available.</p> : risk.map((r: any) => {
                                const riskColor = r.riskLevel === 'HIGH' ? '#ef4444' : r.riskLevel === 'MEDIUM' ? '#f59e0b' : '#10b981';
                                return (
                                    <div key={r.id} style={{ padding: '1rem', background: r.riskLevel === 'HIGH' ? 'rgba(239,68,68,0.06)' : 'rgba(15,23,42,0.4)', borderRadius: '10px', border: `1px solid ${r.riskLevel === 'HIGH' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                            <div>
                                                <span style={{ fontWeight: 700 }}>{r.name}</span>
                                                <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.5rem' }}>@{r.username}</span>
                                            </div>
                                            <span className="analyst-badge" style={{ background: `${riskColor}20`, color: riskColor, border: `1px solid ${riskColor}60` }}>
                                                {r.riskLevel} RISK
                                            </span>
                                        </div>

                                        {/* Risk score bar */}
                                        <div style={{ marginBottom: '0.75rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>
                                                <span>Risk Score</span><span style={{ color: riskColor, fontWeight: 700 }}>{r.riskScore}/100</span>
                                            </div>
                                            <div className="rsi-track">
                                                <div style={{ height: '100%', width: `${r.riskScore}%`, background: `${riskColor}`, borderRadius: '4px', transition: 'width 0.6s' }} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', fontSize: '0.75rem' }}>
                                            <div className="metric-card">
                                                <div className="metric-label">Total Wealth</div>
                                                <div className="metric-value" style={{ fontSize: '0.82rem' }}>₹{(r.totalWealth / 1000).toFixed(0)}K</div>
                                            </div>
                                            <div className="metric-card">
                                                <div className="metric-label">Concentration</div>
                                                <div className="metric-value" style={{ fontSize: '0.82rem', color: r.concentration > 70 ? '#ef4444' : '#e2e8f0' }}>
                                                    {r.concentration}% — {r.largestPos}
                                                </div>
                                            </div>
                                            <div className="metric-card">
                                                <div className="metric-label">Leverage</div>
                                                <div className="metric-value" style={{ fontSize: '0.82rem', color: r.leverageRatio > 40 ? '#ef4444' : '#e2e8f0' }}>
                                                    {r.leverageRatio}%
                                                </div>
                                            </div>
                                            <div className="metric-card">
                                                <div className="metric-label">Cash</div>
                                                <div className="metric-value" style={{ fontSize: '0.82rem', color: r.cash < 10000 ? '#f59e0b' : '#10b981' }}>
                                                    ₹{(r.cash / 1000).toFixed(0)}K
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ══════════════════ ACTIVITY TAB ══════════════════ */}
                {tab === 'activity' && (
                    <div className="grid-2">
                        <div className="card">
                            <div className="card-header">🔄 Global Activity Feed</div>
                            <div style={{ maxHeight: '600px', overflowY: 'auto', marginTop: '1rem' }}>
                                {stats.recentTransactions.length === 0 ? <p style={{ color: '#64748b' }}>No trades yet.</p> : stats.recentTransactions.map((tx: any, idx: number) => {
                                    const student = stats.leaderboard.find((u: any) => u.id === tx.userId);
                                    return (
                                        <div key={idx} style={{ padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <span style={{ color: tx.type === 'BUY' ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{tx.type}</span>
                                                <span style={{ marginLeft: '0.4rem', fontWeight: 600 }}>{tx.quantity}× {tx.symbol}</span>
                                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                    {student?.name ?? 'Unknown'} (@{student?.username ?? tx.userId}) • @₹{tx.price.toFixed(2)}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                                                <div style={{ fontWeight: 600 }}>₹{tx.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                                <div style={{ color: '#475569' }}>{new Date(tx.timestamp).toLocaleTimeString()}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>👤 {selectedUserForActivity ? `Trades: @${selectedUserForActivity.username}` : 'Activity Viewer'}</span>
                                <select
                                    value={selectedUserForActivity?.id || ''}
                                    onChange={(e) => {
                                        const user = stats.leaderboard.find((u: any) => u.id === e.target.value);
                                        setSelectedUserForActivity(user || null);
                                    }}
                                    style={{ padding: '0.3rem', fontSize: '0.8rem', background: 'rgba(15,23,42,0.8)', color: 'white', border: '1px solid var(--border)', borderRadius: '4px' }}
                                >
                                    <option value="">-- Select a Student --</option>
                                    {stats.leaderboard.map((u: any) => (
                                        <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
                                    ))}
                                </select>
                            </div>
                            {!selectedUserForActivity ? (
                                <div style={{ padding: '2rem 0', textAlign: 'center', color: '#64748b' }}>
                                    Select a student from the dropdown or Leaderboard to view their trades here.
                                </div>
                            ) : (
                                <div style={{ maxHeight: '600px', overflowY: 'auto', marginTop: '1rem' }}>
                                    <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(59,130,246,0.08)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.2)' }}>
                                        <div style={{ fontWeight: 600 }}>{selectedUserForActivity.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                            Wealth: ₹{selectedUserForActivity.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} •
                                            P&L: <span className={selectedUserForActivity.profit >= 0 ? 'stat-up' : 'stat-down'}>
                                                {selectedUserForActivity.profitRate.toFixed(2)}%
                                            </span>
                                        </div>
                                    </div>
                                    {stats.recentTransactions.filter((tx: any) => tx.userId === selectedUserForActivity.id).length === 0 ? (
                                        <p style={{ color: '#64748b' }}>No trades recorded.</p>
                                    ) : stats.recentTransactions.filter((tx: any) => tx.userId === selectedUserForActivity.id).map((tx: any, idx: number) => (
                                        <div key={idx} style={{ padding: '0.75rem', marginBottom: '0.5rem', background: 'rgba(15,23,42,0.4)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>
                                                    <span style={{ color: tx.type === 'BUY' ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{tx.type}</span>
                                                    <span style={{ marginLeft: '0.5rem', fontWeight: 600 }}>{tx.quantity}×{tx.symbol}</span>
                                                </span>
                                                <span style={{ fontWeight: 600 }}>₹{tx.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem' }}>
                                                @ ₹{tx.price.toFixed(2)} • {new Date(tx.timestamp).toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ══════════════════ SECURITY DESK TAB ══════════════════ */}
                {tab === 'security' as Tab && (
                    <div className="card">
                        <div className="card-header" style={{ color: 'var(--danger)', borderBottomColor: 'var(--danger)' }}>
                            🕵️ Insider Trading & Anomaly Detection
                        </div>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '1rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                            The Security Desk correlates student trading activity with <strong>Admin-Triggered Market Events</strong>.
                            It flags users who execute suspiciously large trades on affected stocks exactly within the 60 seconds <em>before</em> an event is fired.
                            <br /><br />
                            Last Scanned Event: <strong style={{ color: '#e2e8f0' }}>{lastScannedEvent}</strong>
                        </p>

                        {anomalies.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#10b981', background: 'rgba(16,185,129,0.05)', borderRadius: '10px', border: '1px dashed rgba(16,185,129,0.3)' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                                <div style={{ fontWeight: 700 }}>No Insider Activity Detected</div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>All trading preceding the last event appears normal.</div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                                {anomalies.map((a: any, idx: number) => (
                                    <div key={idx} style={{ padding: '1.25rem', background: a.severity === 'HIGH' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', borderRadius: '12px', border: `1px solid ${a.severity === 'HIGH' ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{a.user}</div>
                                            <div style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, background: a.severity === 'HIGH' ? 'var(--danger)' : '#f59e0b', color: '#fff' }}>
                                                {a.severity} SUSPICION
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                                            <div style={{ background: 'rgba(15,23,42,0.4)', padding: '0.75rem', borderRadius: '6px' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Suspicious Trades</div>
                                                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{a.tradesCount}</div>
                                            </div>
                                            <div style={{ background: 'rgba(15,23,42,0.4)', padding: '0.75rem', borderRadius: '6px' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Volume Pre-Event</div>
                                                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#38bdf8' }}>₹{a.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                            </div>
                                        </div>

                                        <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                                            Identified trading heavily right before: <strong>"{a.eventRef}"</strong>
                                        </div>

                                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => { setSelectedUserForActivity({ id: a.userId, username: a.user, name: a.user }); setTab('activity' as Tab); }}
                                                style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '6px', cursor: 'pointer' }}>
                                                Review Logs
                                            </button>
                                            <button onClick={() => handleDeleteUser(a.userId)}
                                                style={{ flex: 1, padding: '0.5rem', fontSize: '0.75rem', background: 'rgba(239,68,68,0.2)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '6px', cursor: 'pointer' }}>
                                                Expel Student
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* P2P Loans (always at bottom) */}
                {tab === 'students' && (
                    <div className="card" style={{ marginTop: '2rem' }}>
                        <div className="card-header">💰 P2P Loan Market</div>
                        {stats.loans.length === 0 ? <p style={{ color: '#64748b', marginTop: '1rem' }}>No loans yet.</p> : (
                            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                                <table className="table">
                                    <thead><tr><th>Date</th><th>Borrower</th><th>Lender</th><th>Amount</th><th>Rate</th><th>Status</th></tr></thead>
                                    <tbody>
                                        {stats.loans.slice().reverse().map((l: any) => (
                                            <tr key={l.id} className="table-row-hover">
                                                <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(l.createdAt).toLocaleDateString()}</td>
                                                <td>@{l.borrowerUsername}</td>
                                                <td>@{l.lenderUsername}</td>
                                                <td style={{ fontWeight: 600 }}>₹{l.amount.toLocaleString()}</td>
                                                <td style={{ color: 'var(--accent)' }}>{l.interestRate != null ? `${l.interestRate}%` : '—'}</td>
                                                <td><span className={`badge ${l.status === 'ACTIVE' ? 'badge-danger' : l.status === 'COMPLETED' ? 'badge-success' : ''}`} style={{ fontSize: '0.7rem' }}>{l.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </>
    );
}
