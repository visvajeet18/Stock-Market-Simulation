'use client';
import { useEffect, useRef } from 'react';

interface Stock {
    symbol: string;
    price: number;
    previousPrice?: number;
}

export default function MarketTicker({ stocks }: { stocks: Stock[] }) {
    if (!stocks || stocks.length === 0) return null;

    const items = [...stocks, ...stocks]; // duplicate for seamless loop

    return (
        <div style={{
            width: '100%',
            background: 'rgba(10, 15, 30, 0.95)',
            borderBottom: '1px solid rgba(59,130,246,0.3)',
            overflow: 'hidden',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
        }}>
            <div className="ticker-track">
                {items.map((stock, i) => {
                    const prev = stock.previousPrice ?? stock.price;
                    const diff = stock.price - prev;
                    const pct = prev !== 0 ? (diff / prev) * 100 : 0;
                    const isUp = diff >= 0;
                    const color = diff === 0 ? '#94a3b8' : isUp ? '#10b981' : '#ef4444';
                    const arrow = diff === 0 ? '●' : isUp ? '▲' : '▼';

                    return (
                        <span key={`${stock.symbol}-${i}`} className="ticker-item">
                            <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.78rem' }}>
                                {stock.symbol}
                            </span>
                            <span style={{ color, fontWeight: 500, fontSize: '0.78rem', marginLeft: '0.4rem' }}>
                                ₹{stock.price.toFixed(2)}
                            </span>
                            <span style={{ color, fontSize: '0.7rem', marginLeft: '0.25rem' }}>
                                {arrow} {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                            </span>
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
