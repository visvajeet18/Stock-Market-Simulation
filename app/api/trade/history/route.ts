export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const transactions = await readDB('transactions.json');

        if (userId) {
            // Sort history by newest first
            const userTx = transactions
                .filter((t: any) => t.userId === userId)
                .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return NextResponse.json(userTx);
        }
        return NextResponse.json(transactions);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

