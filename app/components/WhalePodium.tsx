'use client';

import React, { useEffect, useState } from 'react';

export default function WhalePodium() {
    const [leaders, setLeaders] = useState<any[]>([]);

    useEffect(() => {
        const fetchLeaders = async () => {
            try {
                const res = await fetch('/api/leaderboard/top');
                if (res.ok) setLeaders(await res.json());
            } catch { /* silent */ }
        };
        fetchLeaders();
        const interval = setInterval(fetchLeaders, 5000);
        return () => clearInterval(interval);
    }, []);

    if (leaders.length < 3) return null;

    // Podium order: 2, 1, 3
    const podiumData = [
        { rank: 2, user: leaders[1] },
        { rank: 1, user: leaders[0] },
        { rank: 3, user: leaders[2] }
    ];

    return (
        <div style={{ marginTop: '2rem' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.2rem', color: '#e2e8f0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                🏆 Top Whales 🏆
            </h3>
            <div className="podium-container">
                {podiumData.map((slot) => (
                    <div key={slot.rank} className={`podium-step podium-${slot.rank}`}>
                        <div className="podium-rank">{slot.rank}</div>
                        <div className="podium-name">{slot.user.username || slot.user.name}</div>
                        <div className="podium-value">₹{(slot.user.totalValue / 1000).toFixed(1)}k</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
