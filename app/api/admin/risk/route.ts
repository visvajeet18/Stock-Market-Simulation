export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB } from '@/lib/db';

// Risk monitoring: returns per-user risk metrics for admin
export async function GET() {
    try {
        const users = await readDB('users.json');
        const stocks = await readDB('stocks.json');
        const loans = await readDB('loans.json');

        const stockPriceMap: Record<string, number> = {};
        stocks.forEach((s: any) => { stockPriceMap[s.symbol] = s.price; });

        const riskProfiles = users
            .filter((u: any) => u.role === 'student')
            .map((u: any) => {
                // Total equity value
                let portfolioValue = 0;
                const holdings: { symbol: string; value: number; pct: number }[] = [];
                for (const sym of Object.keys(u.portfolio ?? {})) {
                    const h = u.portfolio[sym];
                    const qty = typeof h === 'number' ? h : (h?.qty ?? 0);
                    const val = qty * (stockPriceMap[sym] ?? 0);
                    portfolioValue += val;
                    if (val > 0) holdings.push({ symbol: sym, value: val, pct: 0 });
                }
                holdings.forEach(h => { h.pct = portfolioValue > 0 ? (h.value / portfolioValue) * 100 : 0; });
                holdings.sort((a, b) => b.pct - a.pct);

                // Largest single position (concentration risk)
                const concentration = holdings[0]?.pct ?? 0;
                const largestPos = holdings[0]?.symbol ?? 'none';

                // Debt & Lending
                const activeDebt = loans
                    .filter((l: any) => l.borrowerId === u.id && l.status === 'ACTIVE')
                    .reduce((sum: number, l: any) => sum + l.amount * (1 + l.interestRate / 100), 0);

                const activeLending = loans
                    .filter((l: any) => l.lenderId === u.id && l.status === 'ACTIVE')
                    .reduce((sum: number, l: any) => sum + l.amount * (1 + l.interestRate / 100), 0);

                const totalWealth = u.balance + portfolioValue + activeLending - activeDebt;
                const grossAssets = u.balance + portfolioValue + activeLending;
                const leverageRatio = grossAssets > 0 ? (activeDebt / grossAssets) * 100 : 0;

                const initialBalance = 1000000;
                const profitRate = ((totalWealth - initialBalance) / initialBalance) * 100;

                // Risk score: 0-100
                let riskScore = 0;
                if (concentration > 70) riskScore += 30;
                else if (concentration > 40) riskScore += 15;

                if (leverageRatio > 40) riskScore += 40;
                else if (leverageRatio > 10) riskScore += 20;

                if (u.balance < 20000) riskScore += 20; // low cash

                if (profitRate < -15) riskScore += 30; // heavy losses
                else if (profitRate < -1) riskScore += 15; // negative account

                riskScore = Math.min(100, riskScore);

                const riskLevel = riskScore >= 70 ? 'HIGH' : riskScore >= 35 ? 'MEDIUM' : 'LOW';

                return {
                    id: u.id,
                    name: u.name,
                    username: u.username,
                    totalWealth,
                    portfolioValue,
                    cash: u.balance,
                    activeDebt,
                    leverageRatio: +leverageRatio.toFixed(1),
                    concentration: +concentration.toFixed(1),
                    largestPos,
                    riskScore,
                    riskLevel,
                    holdingsCount: holdings.length,
                };
            })
            .sort((a: any, b: any) => b.riskScore - a.riskScore);

        return NextResponse.json(riskProfiles);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

