import { NextResponse } from 'next/server';
import { readDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const users = await readDB('users.json');
        const stocks = await readDB('stocks.json');

        const stockPrices: Record<string, number> = {};
        stocks.forEach((s: any) => stockPrices[s.symbol] = s.price);

        const leaderboard = users
            .filter((u: any) => u.role === 'student')
            .map((user: any) => {
                let portfolioValue = 0;
                if (user.portfolio) {
                    Object.keys(user.portfolio).forEach(symbol => {
                        const holding = user.portfolio[symbol];
                        const qty = typeof holding === 'number' ? holding : (holding?.qty ?? 0);
                        if (qty > 0 && stockPrices[symbol]) {
                            portfolioValue += qty * stockPrices[symbol];
                        }
                    });
                }
                const totalValue = user.balance + portfolioValue; // Fast summary calculation
                return {
                    id: user.id,
                    name: user.name,
                    username: user.username,
                    totalValue
                };
            })
            .sort((a: any, b: any) => b.totalValue - a.totalValue)
            .slice(0, 3); // Get Top 3 Whales

        return NextResponse.json(leaderboard);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
