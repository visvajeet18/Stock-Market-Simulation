import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { userId, symbol, quantity, action } = await request.json();

        if (!userId || !symbol || !quantity || !action) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const stocks = await readDB('stocks.json');
        const stock = stocks.find((s: any) => s.symbol === symbol);
        if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 });

        const users = await readDB('users.json');
        const userIndex = users.findIndex((u: any) => u.id === userId);
        if (userIndex === -1) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const user = users[userIndex];
        if (!user.portfolio) user.portfolio = {};

        if (user.suspended) {
            return NextResponse.json({ error: 'Trading blocked. Account suspended.' }, { status: 403 });
        }

        const totalCost = stock.price * quantity;

        // Migrate old number-format holdings to { qty, avgCost } objects
        for (const sym of Object.keys(user.portfolio)) {
            if (typeof user.portfolio[sym] === 'number') {
                user.portfolio[sym] = { qty: user.portfolio[sym], avgCost: stock.price };
            }
        }

        if (action === 'BUY') {
            if (stock.availableQuantity !== undefined) {
                if (stock.availableQuantity < quantity) {
                    return NextResponse.json({ error: `Not enough shares available on market (Only ${stock.availableQuantity} left in circulation)` }, { status: 400 });
                }
                stock.availableQuantity -= quantity;
            }

            if (user.balance < totalCost) {
                return NextResponse.json({ error: 'Insufficient funds' }, { status: 400 });
            }
            user.balance -= totalCost;
            const existing = user.portfolio[symbol];
            if (existing && existing.qty > 0) {
                // Weighted average cost
                const newQty = existing.qty + quantity;
                const newAvgCost = (existing.avgCost * existing.qty + stock.price * quantity) / newQty;
                user.portfolio[symbol] = { qty: newQty, avgCost: +newAvgCost.toFixed(2) };
            } else {
                user.portfolio[symbol] = { qty: quantity, avgCost: stock.price };
            }
        } else if (action === 'SELL') {
            const holding = user.portfolio[symbol];
            const currentQty = holding?.qty ?? (typeof holding === 'number' ? holding : 0);
            if (currentQty < quantity) {
                return NextResponse.json({ error: 'Insufficient stock quantity' }, { status: 400 });
            }

            if (stock.availableQuantity !== undefined) {
                stock.availableQuantity += quantity;
            }

            user.balance += totalCost;
            const newQty = currentQty - quantity;
            user.portfolio[symbol] = { qty: newQty, avgCost: holding?.avgCost ?? stock.price };
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        users[userIndex] = user;
        await writeDB('users.json', users);

        if (stock.availableQuantity !== undefined) {
            const sIndex = stocks.findIndex((s: any) => s.symbol === symbol);
            if (sIndex !== -1) {
                stocks[sIndex] = stock;
                await writeDB('stocks.json', stocks);
            }
        }

        // Record transaction
        const transactions = await readDB('transactions.json');
        transactions.push({
            id: Date.now().toString(),
            userId,
            type: action,
            symbol,
            quantity,
            price: stock.price,
            total: totalCost,
            timestamp: new Date().toISOString()
        });
        await writeDB('transactions.json', transactions);

        return NextResponse.json({ success: true, balance: user.balance, portfolio: user.portfolio });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
