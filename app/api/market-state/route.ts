import { NextResponse } from 'next/server';
import { readDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        let state: any = {};
        try { state = await readDB('market_state.json'); } catch { state = {}; }
        return NextResponse.json({
            sentiment: state?.sentiment ?? 'normal',
            haltedStocks: state?.haltedStocks ?? [],
            lastEvent: state?.lastEvent ?? null,
            sirenTrigger: state?.sirenTrigger ?? 0
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
