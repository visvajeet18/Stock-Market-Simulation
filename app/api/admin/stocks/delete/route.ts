export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { adminId, symbol } = await request.json();

        if (!adminId || !symbol) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Authenticate admin (Hardcoded for this prototype)
        if (adminId !== 'admin-001') {
            return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
        }
        const { readDB, writeDB, deleteDB } = require('@/lib/db');
        const stocks = await readDB('stocks.json');
        const updatedStocks = stocks.filter((s: any) => s.symbol !== symbol);

        if (stocks.length === updatedStocks.length) {
            return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
        }

        // Correct deletion for both local and Supabase
        const stockToDelete = stocks.find((s: any) => s.symbol === symbol);
        if (stockToDelete && (process.env.USE_FIRESTORE === 'true' || process.env.NODE_ENV === 'production')) {
            await deleteDB('stocks.json', String(stockToDelete.id));
        } else {
            await writeDB('stocks.json', updatedStocks);
        }

        return NextResponse.json({ success: true, message: 'Stock deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

