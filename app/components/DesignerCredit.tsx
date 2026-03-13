'use client';

import Image from 'next/image';

export default function DesignerCredit() {
    return (
        <a
            href="https://visvajeet-raj.web.app/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
                position: 'fixed',
                bottom: '1.5rem',
                right: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '50px',
                padding: '0.5rem 1rem 0.5rem 0.5rem',
                textDecoration: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                zIndex: 1000,
            }}
            onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-3px)';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 32px rgba(16,185,129,0.25)';
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 24px rgba(0,0,0,0.4)';
            }}
        >
            <Image
                src="/visvajeet.png"
                alt="Visvajeet"
                width={40}
                height={40}
                style={{
                    borderRadius: '50%',
                    objectFit: 'cover',
                    objectPosition: 'top',
                    border: '2px solid rgba(16,185,129,0.6)',
                }}
            />
            <div style={{ lineHeight: 1.3 }}>
                <p style={{ margin: 0, fontSize: '0.65rem', color: '#94a3b8', letterSpacing: '0.05em' }}>
                    Designed by
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#d4af37', letterSpacing: '0.08em' }}>
                    VISVAJEET
                </p>
            </div>
        </a>
    );
}
