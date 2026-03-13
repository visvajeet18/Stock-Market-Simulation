import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { adminId, userIdToDelete } = await request.json();

        if (!adminId || !userIdToDelete) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        // Authenticate admin (Hardcoded for this prototype)
        if (adminId !== 'admin-001') {
            return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
        }

        // Delete User
        const users = await readDB('users.json');
        const updatedUsers = users.filter((u: any) => u.id !== userIdToDelete);

        if (users.length === updatedUsers.length) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        await writeDB('users.json', updatedUsers);

        // Filter Out User's Transactions to clean up database
        const transactions = await readDB('transactions.json');
        const updatedTransactions = transactions.filter((t: any) => t.userId !== userIdToDelete);
        await writeDB('transactions.json', updatedTransactions);

        return NextResponse.json({ success: true, message: 'User deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
