export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';
import { INITIAL_BALANCE } from '@/lib/constants';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, username, password } = body;

        if (!name || !username || !password) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const users = await readDB('users.json');
        if (users.find((u: any) => u.username === username)) {
            return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
        }

        const newUser = {
            id: Date.now().toString(),
            name,
            username,
            password, // Storing in plain text for simplicity as it's a mock local competition
            role: 'student',
            balance: INITIAL_BALANCE, 
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        await writeDB('users.json', users);

        // Initial transaction log for the starting balance
        const transactions = await readDB('transactions.json');
        transactions.push({
            id: Date.now().toString() + '-init',
            userId: newUser.id,
            type: 'DEPOSIT',
            symbol: 'V-CASH',
            quantity: 1,
            price: INITIAL_BALANCE,
            total: INITIAL_BALANCE,
            timestamp: new Date().toISOString()
        });
        await writeDB('transactions.json', transactions);

        return NextResponse.json({ success: true, user: { id: newUser.id, name: newUser.name, username: newUser.username, role: newUser.role, balance: newUser.balance } });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

