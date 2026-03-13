"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginContent() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const isAdmin = searchParams.get('admin') === 'true';

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Save user to local storage for session management
            localStorage.setItem('user', JSON.stringify(data.user));

            if (data.user.role === 'admin') {
                router.push('/admin');
            } else {
                router.push('/dashboard');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="glass-panel">
                <h1 className="title-glow">{isAdmin ? 'Admin Portal' : 'Student Login'}</h1>

                {error && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center', fontWeight: '500' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                        />
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>

                {!isAdmin && (
                    <div style={{ marginTop: '2rem', textAlign: 'center', color: '#cbd5e1' }}>
                        Don't have an account?{' '}
                        <Link href="/register" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                            Register Here
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Login() {
    return (
        <Suspense fallback={
            <div className="auth-container">
                <div className="glass-panel">
                    <div style={{ textAlign: 'center', color: '#cbd5e1', padding: '2rem' }}>Loading...</div>
                </div>
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
