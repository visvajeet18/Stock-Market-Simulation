"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminSupport() {
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) { router.push('/login?admin=true'); return; }
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser.role !== 'admin') { router.push('/dashboard'); return; }

        fetchMessages();
        const interval = setInterval(fetchMessages, 10000);
        return () => clearInterval(interval);
    }, [router]);

    const fetchMessages = async () => {
        try {
            const res = await fetch('/api/support?adminId=admin-001');
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="auth-container"><h2 className="title-glow">Loading Support Desk...</h2></div>;

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="title-glow" style={{ margin: 0 }}>🎧 Support Desk</h1>
                <button onClick={() => router.push('/admin')} className="nav-btn">Back to Dashboard</button>
            </div>

            <div className="card">
                <div className="card-header">User Messages ({messages.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                    {messages.length === 0 ? (
                        <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No messages from users yet.</p>
                    ) : (
                        messages.map((m) => (
                            <div key={m.id} className="market-stat" style={{ padding: '1.5rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', borderLeft: '4px solid var(--primary)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ fontWeight: 800, color: 'var(--primary)' }}>@{m.username}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(m.timestamp).toLocaleString()}</span>
                                </div>
                                <p style={{ margin: 0, color: '#e2e8f0', fontSize: '1rem', lineHeight: '1.5' }}>{m.message}</p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
