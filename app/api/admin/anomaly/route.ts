export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const adminId = searchParams.get('adminId');

        if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const transactions = await readDB('transactions.json');
        const state = await readDB('market_state.json');
        const users = await readDB('users.json');

        const lastEvent = state.lastEvent;
        const anomalies: any[] = [];

        // We are looking for people who bought heavily right BEFORE a major positive event
        // Or sold heavily right BEFORE a major negative event.
        // For simulation, we'll just check if trades happened within 60 seconds prior to the event fired time.

        if (lastEvent && lastEvent.firedAt) {
            const eventTime = new Date(lastEvent.firedAt).getTime();
            const isPositive = lastEvent.impact > 0;
            const thresholdTime = eventTime - (60 * 1000); // 1 minute before

            const suspiciousTrades = transactions.filter((tx: any) => {
                const txTime = new Date(tx.timestamp).getTime();
                if (txTime >= thresholdTime && txTime <= eventTime) {
                    // If it's a positive event and they bought the affected stock
                    if (isPositive && tx.type === 'BUY' && (lastEvent.symbols?.includes(tx.symbol) || tx.symbol === '^BSESN')) return true;
                    // If it's a negative event and they sold the affected stock
                    if (!isPositive && tx.type === 'SELL' && (lastEvent.symbols?.includes(tx.symbol) || tx.symbol === '^BSESN')) return true;
                }
                return false;
            });

            // Group by user
            const suspectMap: Record<string, any> = {};
            suspiciousTrades.forEach((tx: any) => {
                if (!suspectMap[tx.userId]) {
                    const u = users.find((us: any) => us.id === tx.userId);
                    suspectMap[tx.userId] = {
                        user: u ? `${u.name} (@${u.username})` : tx.userId,
                        tradesCount: 0,
                        totalVolume: 0,
                        eventRef: lastEvent.description
                    };
                }
                suspectMap[tx.userId].tradesCount += 1;
                suspectMap[tx.userId].totalVolume += tx.total;
            });

            Object.keys(suspectMap).forEach(uid => {
                anomalies.push({
                    userId: uid,
                    ...suspectMap[uid],
                    severity: suspectMap[uid].totalVolume > 50000 ? 'HIGH' : 'MEDIUM'
                });
            });
        }

        return NextResponse.json({ anomalies, lastScannedEvent: lastEvent?.description || 'None' });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

