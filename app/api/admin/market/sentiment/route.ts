export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { adminId, sentiment } = await request.json();
        if (adminId !== 'admin-001') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        if (!['bull', 'bear', 'volatile', 'normal'].includes(sentiment))
            return NextResponse.json({ error: 'Invalid sentiment' }, { status: 400 });

        let state: any = {};
        try { state = await readDB('market_state.json'); } catch { state = {}; }
        if (!state) state = {};
        state.sentiment = sentiment;
        state.sentimentSetAt = new Date().toISOString();
        await writeDB('market_state.json', state);

        // Announce the sentiment change
        const announcements: any[] = await readDB('announcements.json').catch(() => []);
        const labels: Record<string, string> = {
            bull: '🟢 BULL MARKET MODE ACTIVATED — Strong upward bias in all ticks',
            bear: '🔴 BEAR MARKET MODE ACTIVATED — Downward pressure across markets',
            volatile: '⚡ HIGH-VOLATILITY MODE — Extreme price swings expected both ways',
            normal: '⚪ NORMAL MARKET CONDITIONS RESTORED',
        };
        announcements.unshift({
            id: Date.now().toString(),
            type: 'sentiment',
            title: labels[sentiment],
            body: `Market sentiment has been set to ${sentiment.toUpperCase()} by the administrator.`,
            timestamp: new Date().toISOString(),
            isNew: true,
        });
        if (announcements.length > 30) announcements.pop();
        await writeDB('announcements.json', announcements);

        return NextResponse.json({ success: true, sentiment });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET() {
    try {
        let state: any = {};
        try { state = await readDB('market_state.json'); } catch { state = {}; }
        return NextResponse.json({ sentiment: state?.sentiment ?? 'normal', setAt: state?.sentimentSetAt });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

