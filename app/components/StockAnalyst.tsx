'use client';
import { useMemo } from 'react';
import { rsi, macd, bollingerBands, sma, analystSignal } from '@/lib/indicators';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement,
    LineElement, Filler, Tooltip
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

interface StockAnalystProps {
    stock: any;
    userHolding?: { qty: number; avgCost: number } | null;
    onClose: () => void;
    onTrade: (symbol: string, action: 'BUY' | 'SELL') => void;
}

const recColor: Record<string, string> = {
    'STRONG BUY': '#10b981',
    'BUY': '#34d399',
    'HOLD': '#f59e0b',
    'SELL': '#f87171',
    'STRONG SELL': '#ef4444',
};

export default function StockAnalyst({ stock, userHolding, onClose, onTrade }: StockAnalystProps) {
    const history: number[] = stock.history ?? [stock.price];
    const currentPrice: number = stock.price;
    const prevPrice: number = stock.previousPrice ?? stock.price;

    const rsiVal = useMemo(() => rsi(history), [history]);
    const macdData = useMemo(() => macd(history), [history]);
    const bbData = useMemo(() => bollingerBands(history), [history]);
    const sma20 = useMemo(() => sma(history, 20), [history]);
    const sma50 = useMemo(() => sma(history, 50), [history]);
    const signal = useMemo(() => analystSignal(history), [history]);

    const priceChange = currentPrice - prevPrice;
    const priceChangePct = prevPrice !== 0 ? (priceChange / prevPrice) * 100 : 0;
    const isUp = priceChange >= 0;

    // 52-week range position
    const rangeMin = stock.weekLow52 ?? Math.min(...history);
    const rangeMax = stock.weekHigh52 ?? Math.max(...history);
    const rangePct = rangeMax > rangeMin
        ? ((currentPrice - rangeMin) / (rangeMax - rangeMin)) * 100
        : 50;

    // Holding P&L
    const holdingQty = userHolding?.qty ?? 0;
    const holdingAvgCost = userHolding?.avgCost ?? 0;
    const unrealisedPnl = holdingQty > 0 ? (currentPrice - holdingAvgCost) * holdingQty : 0;
    const unrealisedPct = holdingAvgCost > 0 ? ((currentPrice - holdingAvgCost) / holdingAvgCost) * 100 : 0;

    const chartData = {
        labels: history.map((_, i) => i),
        datasets: [{
            data: history,
            borderColor: isUp ? '#10b981' : '#ef4444',
            backgroundColor: isUp ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            fill: true,
        }],
    };

    const chartOptions: any = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `₹${ctx.raw.toFixed(2)}` } } },
        scales: {
            x: { display: false },
            y: { ticks: { color: '#94a3b8', callback: (v: any) => `₹${v.toFixed(0)}` }, grid: { color: 'rgba(255,255,255,0.06)' } }
        },
    };

    const rsiColor = rsiVal >= 70 ? '#ef4444' : rsiVal <= 30 ? '#10b981' : '#f59e0b';
    const recCol = recColor[signal.recommendation] ?? '#94a3b8';

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content analyst-modal" onClick={e => e.stopPropagation()}>

                {/* ── Header ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>{stock.symbol}</h2>
                            <span className="sector-tag">{stock.sector ?? 'Equity'}</span>
                        </div>
                        <p style={{ color: '#94a3b8', margin: '0.2rem 0 0 0', fontSize: '0.9rem' }}>{stock.name}</p>
                    </div>
                    <button className="modal-close" onClick={onClose} style={{ fontSize: '1.8rem' }}>×</button>
                </div>

                {/* ── Price & Change ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
                    <div>
                        <div style={{ fontSize: '2.2rem', fontWeight: 700, color: isUp ? '#10b981' : '#ef4444' }}>
                            ₹{currentPrice.toFixed(2)}
                        </div>
                        <div style={{ color: isUp ? '#10b981' : '#ef4444', fontSize: '0.95rem', fontWeight: 500 }}>
                            {isUp ? '▲' : '▼'} {Math.abs(priceChange).toFixed(2)} ({priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%)
                            <span style={{ color: '#64748b', marginLeft: '0.5rem', fontSize: '0.8rem' }}>vs prev close</span>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#64748b' }}>
                        <div>Open: ₹{(stock.openPrice ?? prevPrice).toFixed(2)}</div>
                        <div>SMA20: ₹{sma20.toFixed(2)}</div>
                        <div>SMA50: ₹{sma50.toFixed(2)}</div>
                    </div>
                </div>

                {/* ── Mini Chart ── */}
                <div style={{ height: '130px', marginBottom: '1.25rem', borderRadius: '8px', overflow: 'hidden', background: 'rgba(10,15,30,0.5)', padding: '0.5rem' }}>
                    <Line data={chartData} options={chartOptions} />
                </div>

                {/* ── 52-Week Range ── */}
                <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                        <span>52W Low ₹{rangeMin.toLocaleString()}</span>
                        <span style={{ fontWeight: 600, color: '#e2e8f0' }}>52-Week Range</span>
                        <span>52W High ₹{rangeMax.toLocaleString()}</span>
                    </div>
                    <div className="range-bar-track">
                        <div className="range-bar-fill" style={{ width: `${Math.min(100, Math.max(0, rangePct))}%` }} />
                        <div className="range-bar-thumb" style={{ left: `${Math.min(100, Math.max(0, rangePct))}%` }} />
                    </div>
                </div>

                {/* ── Key Metrics Grid ── */}
                <div className="metric-grid" style={{ marginBottom: '1.25rem' }}>
                    {[
                        { label: 'P/E Ratio', value: stock.pe ? stock.pe.toFixed(1) : 'N/A' },
                        { label: 'EPS', value: stock.eps ? `₹${stock.eps}` : 'N/A' },
                        { label: 'Market Cap', value: stock.marketCap > 0 ? `₹${(stock.marketCap / 1000).toFixed(0)}B` : 'Index' },
                        { label: 'Beta', value: stock.beta ? stock.beta.toFixed(2) : 'N/A', note: stock.beta > 1.5 ? '⚡ High Risk' : stock.beta < 0.8 ? '🛡 Defensive' : '' },
                        { label: 'Div. Yield', value: stock.dividendYield > 0 ? `${stock.dividendYield}%` : 'None' },
                        { label: 'Avg Volume', value: stock.avgVolume > 0 ? `${(stock.avgVolume / 1e6).toFixed(1)}M` : 'N/A' },
                        { label: 'BB Upper', value: `₹${bbData.upper}` },
                        { label: 'BB Lower', value: `₹${bbData.lower}` },
                    ].map(m => (
                        <div key={m.label} className="metric-card">
                            <div className="metric-label">{m.label}</div>
                            <div className="metric-value">{m.value}</div>
                            {m.note && <div style={{ fontSize: '0.65rem', color: '#f59e0b', marginTop: '0.1rem' }}>{m.note}</div>}
                        </div>
                    ))}
                </div>

                {/* ── Technical Analysis ── */}
                <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(10,15,30,0.6)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem', color: '#cbd5e1' }}>📊 Technical Analysis</div>

                    {/* RSI */}
                    <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                            <span>RSI (14)</span>
                            <span style={{ color: rsiColor, fontWeight: 700 }}>
                                {rsiVal} — {rsiVal >= 70 ? 'Overbought' : rsiVal <= 30 ? 'Oversold' : 'Neutral'}
                            </span>
                        </div>
                        <div className="rsi-track">
                            <div className="rsi-fill" style={{ width: `${rsiVal}%`, background: rsiColor }} />
                            <div style={{ position: 'absolute', left: '30%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.3)' }} />
                            <div style={{ position: 'absolute', left: '70%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.3)' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#475569', marginTop: '0.15rem' }}>
                            <span>0 — Oversold</span><span>Neutral</span><span>Overbought — 100</span>
                        </div>
                    </div>

                    {/* MACD */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                        <span style={{ color: '#94a3b8' }}>MACD Signal</span>
                        <span style={{ color: macdData.trend === 'bullish' ? '#10b981' : macdData.trend === 'bearish' ? '#ef4444' : '#94a3b8', fontWeight: 600 }}>
                            {macdData.trend === 'bullish' ? '▲ Bullish Crossover' : macdData.trend === 'bearish' ? '▼ Bearish Crossover' : '● Neutral'} ({macdData.histogram > 0 ? '+' : ''}{macdData.histogram})
                        </span>
                    </div>

                    {/* Bollinger */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                        <span style={{ color: '#94a3b8' }}>Bollinger Position</span>
                        <span style={{ color: bbData.signal === 'overbought' ? '#ef4444' : bbData.signal === 'oversold' ? '#10b981' : '#94a3b8', fontWeight: 600 }}>
                            {bbData.signal === 'overbought' ? '⚠ Near Upper Band' : bbData.signal === 'oversold' ? '✓ Near Lower Band (Bounce?)' : '● Within Bands'} ({(bbData.position * 100).toFixed(0)}%)
                        </span>
                    </div>

                    {/* SMA crossover */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                        <span style={{ color: '#94a3b8' }}>SMA Trend</span>
                        <span style={{ color: sma20 > sma50 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                            {sma20 > sma50 ? '✨ Golden Cross (Bullish)' : '☠ Death Cross (Bearish)'}
                        </span>
                    </div>
                </div>

                {/* ── Analyst Recommendation ── */}
                <div style={{ marginBottom: '1.25rem', padding: '0.85rem 1rem', background: `${recCol}14`, border: `1px solid ${recCol}55`, borderRadius: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>Analyst Verdict</span>
                        <span className="analyst-badge" style={{ background: `${recCol}28`, color: recCol, border: `1px solid ${recCol}80` }}>
                            {signal.recommendation}
                        </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {signal.reasons.map((r, i) => <span key={i}>• {r}</span>)}
                    </div>
                    {/* Score bar */}
                    <div style={{ marginTop: '0.6rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#475569', marginBottom: '0.2rem' }}>
                            <span>Bearish</span><span>Confidence Score: {signal.score}/100</span><span>Bullish</span>
                        </div>
                        <div className="rsi-track">
                            <div style={{ height: '100%', borderRadius: '4px', width: `${signal.score}%`, background: `linear-gradient(to right, #ef4444, #f59e0b, #10b981)`, transition: 'width 0.6s ease' }} />
                        </div>
                    </div>
                </div>

                {/* ── Your Position ── */}
                {holdingQty > 0 && (
                    <div style={{ marginBottom: '1.25rem', padding: '0.85rem 1rem', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '10px' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem', color: '#93c5fd' }}>Your Position</div>
                        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem' }}>
                            <div>
                                <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Shares</div>
                                <div style={{ fontWeight: 600 }}>{holdingQty}</div>
                            </div>
                            <div>
                                <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Avg Cost</div>
                                <div style={{ fontWeight: 600 }}>₹{holdingAvgCost.toFixed(2)}</div>
                            </div>
                            <div>
                                <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Market Value</div>
                                <div style={{ fontWeight: 600 }}>₹{(currentPrice * holdingQty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                            <div>
                                <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Unrealised P&L</div>
                                <div style={{ fontWeight: 700, color: unrealisedPnl >= 0 ? '#10b981' : '#ef4444' }}>
                                    {unrealisedPnl >= 0 ? '+' : ''}₹{unrealisedPnl.toFixed(2)} ({unrealisedPct >= 0 ? '+' : ''}{unrealisedPct.toFixed(2)}%)
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Description ── */}
                {stock.description && (
                    <p style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.6, marginBottom: '1.25rem', padding: '0.75rem', background: 'rgba(10,15,30,0.4)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {stock.description}
                    </p>
                )}

                {/* ── Quick Trade ── */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={() => { onTrade(stock.symbol, 'BUY'); onClose(); }}
                        style={{ flex: 1, padding: '0.75rem', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', transition: 'opacity 0.2s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                    >
                        BUY {stock.symbol}
                    </button>
                    {holdingQty > 0 && (
                        <button
                            onClick={() => { onTrade(stock.symbol, 'SELL'); onClose(); }}
                            style={{ flex: 1, padding: '0.75rem', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', transition: 'opacity 0.2s' }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                        >
                            SELL {stock.symbol}
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
}
