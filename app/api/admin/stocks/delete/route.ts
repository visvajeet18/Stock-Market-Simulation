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

        const stocks = await readDB('stocks.json');
        const updatedStocks = stocks.filter((s: any) => s.symbol !== symbol);

        if (stocks.length === updatedStocks.length) {
            return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
        }

        await writeDB('stocks.json', updatedStocks);

        return NextResponse.json({ success: true, message: 'Stock deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
