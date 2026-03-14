export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { adminId, symbol, action, amount } = body;

        if (!adminId || !symbol || !action) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        // We trust the admin check was done in middleware or UI for this demo

        const stocks = await readDB('stocks.json');
        const stockIndex = stocks.findIndex((s: any) => s.symbol === symbol);
        if (stockIndex === -1) return NextResponse.json({ error: 'Stock not found' }, { status: 404 });

        const users = await readDB('users.json');

        if (action === 'DIVIDEND') {
            if (!amount || amount <= 0) return NextResponse.json({ error: 'Invalid dividend amount' }, { status: 400 });

            // Pay dividend per share to all holders
            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                if (user.portfolio && user.portfolio[symbol]) {
                    const holding = user.portfolio[symbol];
                    const qty = holding.qty ?? (typeof holding === 'number' ? holding : 0);
                    if (qty > 0) {
                        const payout = qty * amount;
                        user.balance += payout;
                    }
                }
            }

            // Add global announcement
            const announcements = await readDB('announcements.json');
            announcements.unshift({
                id: Date.now().toString(),
                title: `💰 Dividend Paid: ${symbol}`,
                body: `A dividend of ₹${amount} per share has been distributed to all ${symbol} shareholders.`,
                type: 'sentiment',
                timestamp: new Date().toISOString()
            });
            await writeDB('announcements.json', announcements);

        } else if (action === 'SPLIT_2_FOR_1') {
            // Halve the stock price
            stocks[stockIndex].price = Math.max(0.01, stocks[stockIndex].price / 2);
            stocks[stockIndex].previousPrice = stocks[stockIndex].price;

            // Double the shares for all holders, halve their avgCost
            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                if (user.portfolio && user.portfolio[symbol]) {
                    const holding = user.portfolio[symbol];
                    const qty = holding.qty ?? (typeof holding === 'number' ? holding : 0);
                    const avgCost = holding.avgCost ?? stocks[stockIndex].price * 2;
                    if (qty > 0) {
                        user.portfolio[symbol] = {
                            qty: qty * 2,
                            avgCost: avgCost / 2
                        };
                    }
                }
            }

            // Add global announcement
            const announcements = await readDB('announcements.json');
            announcements.unshift({
                id: Date.now().toString(),
                title: `✂️ Stock Split: ${symbol}`,
                body: `${symbol} has executed a 2-for-1 stock split. Share counts have doubled and price has halved.`,
                type: 'event',
                timestamp: new Date().toISOString()
            });
            await writeDB('announcements.json', announcements);
        } else {
            return NextResponse.json({ error: 'Invalid action type' }, { status: 400 });
        }

        await writeDB('users.json', users);
        if (action === 'SPLIT_2_FOR_1') await writeDB('stocks.json', stocks);

        return NextResponse.json({ success: true, message: `Successfully executed ${action} for ${symbol}` });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

