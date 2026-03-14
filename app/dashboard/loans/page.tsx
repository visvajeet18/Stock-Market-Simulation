"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoansDashboard() {
    const [user, setUser] = useState<any>(null);
    const [loans, setLoans] = useState<any[]>([]);
    const [availableUsers, setAvailableUsers] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ text: '', type: '' });

    // For borrowers
    const [requestForm, setRequestForm] = useState({ lenderId: '', amount: '', description: '' });

    // For lenders responding to requests (keyed by loanId)
    const [proposeRates, setProposeRates] = useState<Record<string, string>>({});
    const [recalling, setRecalling] = useState<string | null>(null);

    const playSound = (type: 'coins') => {
        const sounds = {
            coins: 'https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3'
        };
        const audio = new Audio(sounds[type]);
        audio.play().catch(() => console.warn('Audio play blocked or failed'));
    };

    const router = useRouter();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
            router.push('/login');
            return;
        }
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);

        // Initial fetch
        fetchLoans(parsedUser.id);
        fetchUsersList(parsedUser.id);
        fetchUser(parsedUser.id);

        const interval = setInterval(() => {
            fetchLoans(parsedUser.id);
            fetchUser(parsedUser.id);
        }, 5000);
        return () => clearInterval(interval);
    }, [router]);

    const fetchUser = async (userId: string) => {
        try {
            const res = await fetch(`/api/users/me?userId=${userId}`, { cache: 'no-store' });
            if (res.status === 403) {
                setUser((prev: any) => ({ ...prev, suspended: true }));
                return;
            }
            if (res.ok) {
                const data = await res.json();
                setUser(data);
                localStorage.setItem('user', JSON.stringify(data));
            }
        } catch (err) {
            console.error('Failed to fetch user');
        }
    };

    const fetchLoans = async (userId: string) => {
        try {
            const res = await fetch(`/api/loans?userId=${userId}`);
            const data = await res.json();
            if (res.ok) {
                setLoans(data);
            }
        } catch (err) {
            console.error('Failed to fetch loans');
        }
    };

    const fetchUsersList = async (userId: string) => {
        try {
            const res = await fetch(`/api/users/list?userId=${userId}`);
            const data = await res.json();
            if (res.ok) {
                setAvailableUsers(data);
            }
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch users');
            setLoading(false);
        }
    };

    const handleCreateRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ text: '', type: '' });

        try {
            const res = await fetch('/api/loans/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    borrowerId: user.id,
                    lenderId: requestForm.lenderId,
                    amount: requestForm.amount,
                    description: requestForm.description
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setMessage({ text: 'Loan request sent to ' + availableUsers.find(u => u.id === requestForm.lenderId)?.username + '!', type: 'success' });
            setRequestForm({ lenderId: '', amount: '', description: '' });
            fetchLoans(user.id);
        } catch (err: any) {
            setMessage({ text: err.message, type: 'error' });
        }
    };

    const handleProposeInterest = async (loanId: string) => {
        const rate = proposeRates[loanId];
        if (!rate) {
            alert('Please enter an interest rate to propose.');
            return;
        }

        try {
            const res = await fetch('/api/loans/propose-interest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lenderId: user.id, loanId, interestRate: rate })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            alert('Interest rate proposed to borrower!');
            fetchLoans(user.id);
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleAcceptProposal = async (loanId: string) => {
        try {
            const res = await fetch('/api/loans/accept-proposal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ borrowerId: user.id, loanId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Refresh user to get new balance
            const newBalance = user.balance + data.loan.amount;
            const updatedUser = { ...user, balance: newBalance };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));

            fetchLoans(user.id);
            playSound('coins');
            alert('Proposal accepted! Funds have been transferred to your account.');
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleDeclineProposal = async (loanId: string) => {
        if (!confirm('Are you sure you want to decline this loan proposal?')) return;
        try {
            const res = await fetch('/api/loans/decline-proposal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ borrowerId: user.id, loanId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            fetchLoans(user.id);
            alert('Proposal declined.');
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleRepayLoan = async (loanId: string, totalNeeded: number) => {
        if (user.balance < totalNeeded) {
            alert(`You need ₹${totalNeeded.toFixed(2)} to repay this loan.`);
            return;
        }

        if (!confirm(`Confirm repayment of ₹${totalNeeded.toFixed(2)}?`)) return;

        try {
            const res = await fetch('/api/loans/repay', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ borrowerId: user.id, loanId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const newBalance = user.balance - totalNeeded;
            const updatedUser = { ...user, balance: newBalance };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));

            fetchLoans(user.id);
            playSound('coins');
            alert('Successfully repaid the loan!');
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleForceRecall = async (loanId: string) => {
        if (!confirm('Recalling money instantly will cancel future interest but return the principal. Continue?')) return;
        setRecalling(loanId);
        try {
            const res = await fetch('/api/loans/force-return', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lenderId: user.id, loanId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            playSound('coins');
            alert('Loan principal recalled successfully!');
            fetchLoans(user.id);
            fetchUser(user.id);
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        } finally {
            setRecalling(null);
        }
    };

    if (loading || !user) {
        return <div className="auth-container"><h2 className="title-glow">Loading Banking Portal...</h2></div>;
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

    const myDebt = loans.filter(l => l.borrowerId === user.id);
    const myInvestments = loans.filter(l => l.lenderId === user.id);

    return (
        <>
            <nav className="navbar" style={{ background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid var(--accent)' }}>
                <div className="nav-brand">
                    Stock<span style={{ color: 'var(--accent)' }}>X</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <a href="/dashboard" style={{ color: '#94a3b8', textDecoration: 'none' }} className="nav-link-hover">Trading Hub</a>
                    <a href="/dashboard/loans" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>P2P Bank</a>
                </div>
                <div className="nav-links">
                    <span style={{ color: '#e2e8f0', marginRight: '1rem' }}>{user.name}</span>
                    <button className="nav-btn" onClick={() => { localStorage.removeItem('user'); router.push('/login'); }}>
                        Logout
                    </button>
                </div>
            </nav>

            <div className="dashboard-container">
                <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 className="title-glow" style={{ fontSize: '2rem', margin: '0 0 0.5rem 0' }}>Peer-to-Peer Lending</h1>
                        <p style={{ color: '#94a3b8', margin: 0 }}>Borrow from friends or lend cash to earn fixed interest.</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>Available Cash</p>
                        <h2 style={{ fontSize: '2rem', margin: 0 }}>₹{user.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                    </div>
                </div>

                {message.text && (
                    <div className={`message bg-${message.type}`} style={{ marginBottom: '2rem' }}>
                        {message.text}
                    </div>
                )}

                <div className="grid-2">
                    {/* LEFTSIDE: Create Request & My Debt */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        <div className="card">
                            <div className="card-header">Request a Loan</div>
                            <form onSubmit={handleCreateRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label className="label">Select Lender</label>
                                        <select
                                            className="input"
                                            required
                                            value={requestForm.lenderId}
                                            onChange={e => setRequestForm({ ...requestForm, lenderId: e.target.value })}
                                            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border)', color: 'white' }}
                                        >
                                            <option value="" disabled>Choose a student...</option>
                                            {availableUsers.map(u => (
                                                <option key={u.id} value={u.id}>@{u.username} ({u.name})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label className="label">Amount (₹)</label>
                                        <input type="number" className="input" min="100" required value={requestForm.amount} onChange={e => setRequestForm({ ...requestForm, amount: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label className="label">Reason (Optional)</label>
                                    <input type="text" className="input" placeholder="e.g. Buying the AAPL dip" value={requestForm.description} onChange={e => setRequestForm({ ...requestForm, description: e.target.value })} />
                                </div>
                                <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem' }}>Send Request</button>
                            </form>
                        </div>

                        <div className="card" style={{ flex: 1 }}>
                            <div className="card-header">My Borrowing</div>
                            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {myDebt.length === 0 ? (
                                    <p style={{ color: '#94a3b8' }}>You have no active loans or requests.</p>
                                ) : (
                                    myDebt.map(loan => {
                                        return (
                                            <div key={loan.id} style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '1.25rem' }}>₹{loan.amount.toLocaleString()}</span>
                                                    <span className={`badge ${loan.status === 'ACTIVE' ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.75rem' }}>
                                                        {loan.status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                                    Target: @{loan.lenderUsername} • {loan.description || 'No reason provided'}
                                                </p>

                                                {/* State: Pending Lender */}
                                                {loan.status === 'PENDING_LENDER' && (
                                                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
                                                        Waiting for @{loan.lenderUsername} to review and propose an interest rate...
                                                    </p>
                                                )}

                                                {/* State: Pending Borrower Acceptance */}
                                                {loan.status === 'PENDING_BORROWER' && (
                                                    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                                                        <p style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '0.5rem' }}>
                                                            @{loan.lenderUsername} proposed {loan.interestRate}% interest.
                                                        </p>
                                                        <div style={{ display: 'flex', gap: '1rem' }}>
                                                            <button
                                                                className="btn-primary"
                                                                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', flex: 1 }}
                                                                onClick={() => handleAcceptProposal(loan.id)}
                                                            >
                                                                Accept & Fund
                                                            </button>
                                                            <button
                                                                className="btn-primary"
                                                                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', flex: 1, background: 'var(--danger)', borderColor: 'var(--danger)' }}
                                                                onClick={() => handleDeclineProposal(loan.id)}
                                                            >
                                                                Decline Offer
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* State: Active */}
                                                {loan.status === 'ACTIVE' && (
                                                    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Interest Rate: {loan.interestRate}%</span><br />
                                                            <span style={{ fontWeight: 600 }}>Total Repayment: ₹{(loan.amount * (1 + (loan.interestRate / 100))).toFixed(2)}</span>
                                                        </div>
                                                        <button
                                                            className="btn-primary"
                                                            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                                            onClick={() => handleRepayLoan(loan.id, loan.amount * (1 + (loan.interestRate / 100)))}
                                                        >
                                                            Repay Now
                                                        </button>
                                                    </div>
                                                )}

                                                {/* State: Completed */}
                                                {loan.status === 'COMPLETED' && (
                                                    <p style={{ color: 'var(--success)', fontSize: '0.875rem', marginTop: '0.5rem' }}>Repaid on {new Date(loan.repaidAt).toLocaleDateString()}</p>
                                                )}
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>

                    </div>

                    {/* RIGHTSIDE: Incoming Requests & My Investments */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                        <div className="card" style={{ flex: 1 }}>
                            <div className="card-header">Lending Hub</div>
                            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1rem' }}>Review requests and track your investments.</p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {myInvestments.length === 0 ? (
                                    <p style={{ color: '#94a3b8' }}>No one has requested money from you yet.</p>
                                ) : (
                                    myInvestments.map(loan => {
                                        return (
                                            <div key={loan.id} style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Borrower: @{loan.borrowerUsername}</span>
                                                        <br />
                                                        <span style={{ fontWeight: 600, fontSize: '1.25rem' }}>₹{loan.amount.toLocaleString()}</span>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <span className={`badge ${loan.status === 'COMPLETED' ? 'badge-success' : loan.status === 'DECLINED' ? 'badge-danger' : 'badge-danger'}`} style={{ fontSize: '0.75rem' }}>
                                                            {loan.status.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                </div>
                                                <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem', marginBottom: 0 }}>
                                                    {loan.description ? `"${loan.description}"` : 'No reason provided'}
                                                </p>

                                                {/* Lender Action: Needs to Propose Interest */}
                                                {loan.status === 'PENDING_LENDER' && (
                                                    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                min="0"
                                                                placeholder="Interest Rate %"
                                                                className="input"
                                                                style={{ flex: 1, padding: '0.5rem', fontSize: '0.875rem' }}
                                                                value={proposeRates[loan.id] || ''}
                                                                onChange={(e) => setProposeRates({ ...proposeRates, [loan.id]: e.target.value })}
                                                            />
                                                            <button
                                                                className="btn-primary"
                                                                style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
                                                                onClick={() => handleProposeInterest(loan.id)}
                                                            >
                                                                Propose
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Lender Waiting: pending borrower */}
                                                {loan.status === 'PENDING_BORROWER' && (
                                                    <p style={{ color: 'var(--accent)', fontSize: '0.875rem', marginTop: '1rem', fontStyle: 'italic' }}>
                                                        Waiting for @{loan.borrowerUsername} to accept your {loan.interestRate}% interest proposal...
                                                    </p>
                                                )}

                                                {(loan.status === 'ACTIVE' || loan.status === 'COMPLETED') && (
                                                    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Interest Rate: {loan.interestRate}%</span><br />
                                                            <span style={{ fontSize: '0.875rem', color: 'var(--success)', fontWeight: 600 }}>
                                                                Return: ₹{(loan.amount * (1 + (loan.interestRate / 100))).toFixed(2)}
                                                            </span>
                                                        </div>
                                                        {loan.status === 'ACTIVE' && (
                                                            <button 
                                                                className="btn-primary" 
                                                                style={{ padding: '0.5rem 0.8rem', fontSize: '0.75rem', background: 'var(--danger)', borderColor: 'var(--danger)' }}
                                                                onClick={() => handleForceRecall(loan.id)}
                                                                disabled={recalling === loan.id}
                                                            >
                                                                {recalling === loan.id ? 'Recalling...' : 'Force Money Back'}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </>
    );
}
