export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB, deleteDB, deleteManyDB } from '@/lib/db';

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
        await deleteDB('users.json', userIdToDelete);

        // Filter Out User's Transactions to clean up database
        const transactions = await readDB('transactions.json');
        const userTxIds = transactions.filter((t: any) => t.userId === userIdToDelete).map((t: any) => String(t.id));
        if (userTxIds.length > 0) {
            await deleteManyDB('transactions.json', userTxIds);
        }

        return NextResponse.json({ success: true, message: 'User deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
