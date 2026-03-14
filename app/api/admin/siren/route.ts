export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { adminId } = await request.json();

        // In a real app, verify adminId
        if (!adminId) {
            return NextResponse.json({ error: 'Missing adminId' }, { status: 400 });
        }

        const state = await readDB('market_state.json');
        state.sirenTrigger = Date.now();
        await writeDB('market_state.json', state);

        return NextResponse.json({ success: true, sirenTrigger: state.sirenTrigger });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
