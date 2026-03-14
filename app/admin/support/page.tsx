"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminSupport() {
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<any[]>([]);
    const [selectedStudent, setSelectedStudent] = useState('');
    const [privateMsg, setPrivateMsg] = useState('');
    const [sending, setSending] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) { router.push('/login?admin=true'); return; }
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser.role !== 'admin') { router.push('/dashboard'); return; }

        fetchMessages();
        fetchStudents();
        const interval = setInterval(() => {
            fetchMessages();
        }, 10000);
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

    const fetchStudents = async () => {
        try {
            const res = await fetch('/api/admin/stats');
            if (res.ok) {
                const data = await res.json();
                setStudents(data.leaderboard || []);
            }
        } catch (err) { console.error(err); }
    };

    const sendPrivateMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudent || !privateMsg.trim()) return;
        setSending(true);
        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminId: 'admin-001', targetUserId: selectedStudent, message: privateMsg })
            });
            if (res.ok) {
                alert('✓ Private message sent!');
                setPrivateMsg('');
            }
        } catch (err) { alert('Failed to send message'); }
        setSending(false);
    };

    if (loading) return <div className="auth-container"><h2 className="title-glow">Loading Support Desk...</h2></div>;

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="title-glow" style={{ margin: 0 }}>🎧 Support Desk</h1>
                <button onClick={() => router.push('/admin')} className="nav-btn">Back to Dashboard</button>
            </div>

            <div className="grid-2">
                <div className="card">
                    <div className="card-header">✉️ Send Message to Student</div>
                    <form onSubmit={sendPrivateMessage} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.4rem' }}>Select Student</label>
                            <select 
                                value={selectedStudent} 
                                onChange={e => setSelectedStudent(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', color: 'white' }}
                                required
                            >
                                <option value="">-- Choose a Student --</option>
                                {students.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} (@{s.username})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.4rem' }}>Message</label>
                            <textarea 
                                value={privateMsg} 
                                onChange={e => setPrivateMsg(e.target.value)}
                                placeholder="Type your message here..."
                                rows={4}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border)', color: 'white', resize: 'vertical' }}
                                required
                            />
                        </div>
                        <button type="submit" className="btn-primary" disabled={sending} style={{ background: 'var(--accent)', color: '#0f172a' }}>
                            {sending ? 'Sending...' : '📤 Send Private Message'}
                        </button>
                    </form>
                </div>

                <div className="card">
                    <div className="card-header">User Messages ({messages.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', maxHeight: '500px', overflowY: 'auto' }}>
                        {messages.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No messages from users yet.</p>
                        ) : (
                            messages.map((m: any) => (
                                <div key={m.id} className="market-stat" style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', borderLeft: '4px solid var(--primary)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.85rem' }}>@{m.username}</span>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{new Date(m.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.9rem', lineHeight: '1.4' }}>{m.message}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
