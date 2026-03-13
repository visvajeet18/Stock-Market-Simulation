"use client";

import { useEffect, useState } from 'react';
import { sound } from '@/lib/audio';

interface GlobalAlertsProps {
    announcements: any[];
    loans: any[];
    tradeEffect: { type: 'win' | 'lose'; amount: number } | null;
    marketWeather: string;
}

export default function GlobalAlerts({ announcements, loans, tradeEffect, marketWeather }: GlobalAlertsProps) {
    const [lastAnnId, setLastAnnId] = useState<string | null>(null);
    const [lastLoanCount, setLastLoanCount] = useState<number | null>(null);
    const [lastWeather, setLastWeather] = useState<string | null>(null);
    const [showEventWarning, setShowEventWarning] = useState<string | null>(null);
    const [showSiren, setShowSiren] = useState(false);

    // Watch for new announcements
    useEffect(() => {
        if (announcements.length > 0) {
            const latest = announcements[announcements.length - 1];
            if (latest.id !== lastAnnId) {
                const isFirstLoad = lastAnnId === null;
                setLastAnnId(latest.id);
                
                // Only play sound and show alert if not initial load
                if (!isFirstLoad) {
                    sound.playAnnouncement();
                    
                    // Show warning for events OR admin announcements
                    if (latest.type === 'event' || latest.type === 'admin') {
                        setShowEventWarning(latest.title);
                        if (latest.type === 'event') {
                            setShowSiren(true);
                            sound.playSiren();
                        }
                        setTimeout(() => {
                            setShowEventWarning(null);
                            setShowSiren(false);
                        }, 5000);
                    }
                }
            }
        }
    }, [announcements, lastAnnId]);

    // Watch for new loans (borrow/lend)
    useEffect(() => {
        if (lastLoanCount === null) {
            if (loans.length > 0) setLastLoanCount(loans.length);
            else setLastLoanCount(0);
            return;
        }

        if (loans.length > lastLoanCount) {
            sound.playBeep();
            const latest = loans[loans.length - 1];
            if (latest) {
                const label = latest.borrowerId ? 'LOAN ACTIVITY' : 'NOTIFICATION';
                setShowEventWarning(`${label}: ₹${latest.amount || 'Update'}`);
            }
            setLastLoanCount(loans.length);
            setTimeout(() => {
                setShowEventWarning(null);
            }, 3000);
        }
    }, [loans, lastLoanCount]);

    // Handle trade sounds
    useEffect(() => {
        if (tradeEffect) {
            if (tradeEffect.type === 'win') sound.playProfit();
            else {
                sound.playLoss();
                sound.playSiren();
            }
        }
    }, [tradeEffect]);

    // Watch for market weather changes
    useEffect(() => {
        if (lastWeather === null) {
            setLastWeather(marketWeather);
            return;
        }

        if (marketWeather !== lastWeather) {
            sound.playAnnouncement();
            setShowEventWarning(`MARKET SHIFT: ${marketWeather.toUpperCase()} MODE`);
            setLastWeather(marketWeather);
            setTimeout(() => {
                setShowEventWarning(null);
            }, 3000);
        }
    }, [marketWeather, lastWeather]);

    return (
        <>
            {/* Market Event Flash */}
            {showSiren && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    pointerEvents: 'none', zIndex: 9999,
                    animation: 'siren-flash 0.5s infinite alternate',
                    border: '20px solid rgba(239, 68, 68, 0.4)'
                }} />
            )}

            {/* Big Single Time Warning */}
            {showEventWarning && (
                <div style={{
                    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    background: 'rgba(239, 68, 68, 0.95)', color: 'white', padding: '3rem 5rem',
                    borderRadius: '20px', textAlign: 'center', zIndex: 10000,
                    boxShadow: '0 0 50px rgba(0,0,0,0.5)', border: '5px solid white',
                    animation: 'zoom-in-out 1s infinite'
                }}>
                    <h1 style={{ fontSize: '4rem', margin: 0, fontWeight: 900 }}>⚠️ WARNING</h1>
                    <p style={{ fontSize: '1.5rem', marginTop: '1rem', fontWeight: 600 }}>{showEventWarning}</p>
                </div>
            )}

            <style jsx global>{`
                @keyframes siren-flash {
                    from { background: rgba(239, 68, 68, 0.05); }
                    to { background: rgba(239, 68, 68, 0.2); }
                }
                @keyframes zoom-in-out {
                    0% { transform: translate(-50%, -50%) scale(1); }
                    50% { transform: translate(-50%, -50%) scale(1.1); }
                    100% { transform: translate(-50%, -50%) scale(1); }
                }
            `}</style>
        </>
    );
}
