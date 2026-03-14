export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB } from '@/lib/db';
import { INITIAL_BALANCE } from '@/lib/constants';

export async function GET() {
    try {
        const users = await readDB('users.json');
        const stocks = await readDB('stocks.json');
        const transactions = await readDB('transactions.json');
        const loans = await readDB('loans.json');
        let marketState: any = {};
        try { marketState = await readDB('market_state.json'); } catch { marketState = {}; }

        // Create dictionaries mapping symbols to price & history
        const stockPrices: Record<string, number> = {};
        const historicalData: Record<string, number[]> = {};
        const stockAutoUpdates: Record<string, boolean> = {};
        const stockMeta: Record<string, any> = {};
        stocks.forEach((s: any) => {
            stockPrices[s.symbol] = s.price;
            if (s.history) historicalData[s.symbol] = s.history;
            stockAutoUpdates[s.symbol] = s.autoUpdate !== false;
            stockMeta[s.symbol] = {
                name: s.name, sector: s.sector, beta: s.beta,
                pe: s.pe, previousPrice: s.previousPrice, volatility: s.volatility,
                logoUrl: s.logoUrl,
            };
        });

        // Calculate leaderboard data
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
                const activeDebt = loans
                    .filter((l: any) => l.borrowerId === user.id && l.status === 'ACTIVE')
                    .reduce((sum: number, l: any) => sum + l.amount * (1 + l.interestRate / 100), 0);
                const activeLending = loans
                    .filter((l: any) => l.lenderId === user.id && l.status === 'ACTIVE')
                    .reduce((sum: number, l: any) => sum + l.amount * (1 + l.interestRate / 100), 0);

                const totalValue = user.balance + portfolioValue + activeLending - activeDebt;
                const initialBalance = INITIAL_BALANCE;
                const profit = totalValue - initialBalance;
                const profitRate = (profit / initialBalance) * 100;

                return {
                    id: user.id, name: user.name, username: user.username,
                    balance: user.balance, portfolioValue, totalValue,
                    profit, profitRate, activeDebt, activeLending,
                    suspended: user.suspended,
                    holdingsCount: Object.keys(user.portfolio ?? {}).filter(sym => {
                        const h = user.portfolio[sym];
                        return (typeof h === 'number' ? h : h?.qty ?? 0) > 0;
                    }).length,
                };
            })
            .sort((a: any, b: any) => b.totalValue - a.totalValue);

        const recentTransactions = transactions.slice(-100).reverse();

        return NextResponse.json({
            leaderboard, recentTransactions,
            defaultStockPrices: stockPrices, historicalData,
            loans, stockAutoUpdates, stockMeta,
            marketState: {
                sentiment: marketState?.sentiment ?? 'normal',
                haltedStocks: marketState?.haltedStocks ?? [],
                lastEvent: marketState?.lastEvent ?? null,
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

