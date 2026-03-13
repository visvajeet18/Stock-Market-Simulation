import Link from 'next/link';
import Image from 'next/image';
import DesignerCredit from './components/DesignerCredit';
import './globals.css';

export default function Home() {
  return (
    <div className="auth-container">
      <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '600px' }}>
        {/* Club Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <Image
            src="/finovate-logo.png"
            alt="Club Logo"
            width={200}
            height={200}
            style={{
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 18px rgba(16, 185, 129, 0.3))',
              borderRadius: '50%',
            }}
            priority
          />
        </div>

        <h1 className="title-glow" style={{ fontSize: '3rem', marginBottom: '1rem' }}>
          StockX Simulation
        </h1>
        <p style={{ color: '#cbd5e1', marginBottom: '2.5rem', fontSize: '1.125rem' }}>
          Welcome to the ultimate stock market simulation. Learn to trade, manage your portfolio, and compete with other students on the leaderboard.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link href="/register" style={{ width: '45%' }}>
            <button className="btn-primary" style={{ padding: '1rem' }}>
              Student Registration
            </button>
          </Link>
          <Link href="/login" style={{ width: '45%' }}>
            <button
              className="btn-primary"
              style={{
                padding: '1rem',
                background: 'transparent',
                border: '1px solid var(--primary)',
                boxShadow: 'none'
              }}
            >
              Sign In
            </button>
          </Link>
        </div>

        <div style={{ marginTop: '2rem', padding: '1rem', borderTop: '1px solid var(--border)' }}>
          <Link href="/login?admin=true">
            <span style={{ color: '#94a3b8', fontSize: '0.875rem', textDecoration: 'underline', cursor: 'pointer' }}>
              Admin Portal
            </span>
          </Link>
        </div>
      </div>

      {/* Designer Credit — bottom-right */}
      <DesignerCredit />
    </div>
  );
}
