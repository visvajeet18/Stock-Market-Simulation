import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, symbol, quantity, targetPrice, action } = body;

        if (!userId || !symbol || !quantity || !targetPrice || !action) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }
        if (action !== 'LIMIT_BUY' && action !== 'LIMIT_SELL') {
            return NextResponse.json({ error: 'Invalid Limit Action' }, { status: 400 });
        }

        const stocks = await readDB('stocks.json');
        const stock = stocks.find((s: any) => s.symbol === symbol);
        if (!stock) return NextResponse.json({ error: 'Stock not found' }, { status: 404 });

        const users = await readDB('users.json');
        const userIndex = users.findIndex((u: any) => u.id === userId);
        if (userIndex === -1) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const user = users[userIndex];
        const totalCost = targetPrice * quantity;

        // Validations
        if (action === 'LIMIT_BUY') {
            if (user.balance < totalCost) {
                return NextResponse.json({ error: 'Insufficient funds for LIMIT BUY allocation' }, { status: 400 });
            }
            // Lock funds by deducting now so they can't double-spend it. 
            // We will refund if they cancel the order.
            user.balance -= totalCost;
        } else if (action === 'LIMIT_SELL') {
            const holding = user.portfolio?.[symbol];
            if (!holding || holding.qty < quantity) {
                return NextResponse.json({ error: 'Insufficient stock quantity for LIMIT SELL' }, { status: 400 });
            }
            // Lock stock by removing it from portfolio now so they can't sell it twice.
            // We will refund if they cancel.
            user.portfolio[symbol].qty -= quantity;
        }

        users[userIndex] = user;
        await writeDB('users.json', users);

        const orders = await readDB('orders.json');
        const newOrder = {
            id: crypto.randomUUID(),
            userId,
            symbol,
            quantity,
            targetPrice,
            action,
            status: 'PENDING',
            createdAt: new Date().toISOString()
        };

        orders.push(newOrder);
        await writeDB('orders.json', orders);

        return NextResponse.json({ success: true, order: newOrder, balance: user.balance });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const orders = await readDB('orders.json');

        if (userId) {
            return NextResponse.json(orders.filter((o: any) => o.userId === userId));
        }
        return NextResponse.json(orders);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { orderId } = await request.json();
        if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });

        const orders = await readDB('orders.json');
        const orderIdx = orders.findIndex((o: any) => o.id === orderId && o.status === 'PENDING');

        if (orderIdx === -1) return NextResponse.json({ error: 'Pending order not found' }, { status: 404 });
        const order = orders[orderIdx];

        // Refund User
        const users = await readDB('users.json');
        const user = users.find((u: any) => u.id === order.userId);

        if (user) {
            if (order.action === 'LIMIT_BUY') {
                user.balance += (order.targetPrice * order.quantity);
            } else if (order.action === 'LIMIT_SELL') {
                if (!user.portfolio) user.portfolio = {};
                if (!user.portfolio[order.symbol]) user.portfolio[order.symbol] = { qty: 0, avgCost: 0 };
                user.portfolio[order.symbol].qty += order.quantity;
            }
            await writeDB('users.json', users);
        }

        // Cancel order
        order.status = 'CANCELLED';
        orders[orderIdx] = order;
        await writeDB('orders.json', orders);

        return NextResponse.json({ success: true });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
