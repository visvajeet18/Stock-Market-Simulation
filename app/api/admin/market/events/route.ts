import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';
import { PRESET_EVENTS } from '@/lib/marketEvents';

export async function POST(request: Request) {
    try {
        const { adminId, eventId, customEvent } = await request.json();
        if (adminId !== 'admin-001') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        let event: any;
        if (customEvent) {
            event = customEvent;
        } else {
            event = PRESET_EVENTS.find((e: any) => e.id === eventId);
            if (!event) return NextResponse.json({ error: 'Unknown event' }, { status: 400 });
        }

        // Schedule event for next tick
        let state: any = {};
        try { state = await readDB('market_state.json'); } catch { state = {}; }
        if (!state) state = {};

        state.pendingEvent = { ...event, queuedAt: new Date().toISOString() };

        // Persist to announcements too
        const announcements: any[] = await readDB('announcements.json').catch(() => []);
        announcements.unshift({
            id: Date.now().toString(),
            type: 'event',
            title: event.label ?? event.description,
            body: event.description,
            impact: event.impact,
            timestamp: new Date().toISOString(),
            isNew: true,
        });
        if (announcements.length > 30) announcements.pop();

        await writeDB('market_state.json', state);
        await writeDB('announcements.json', announcements);

        return NextResponse.json({ success: true, event: event.description });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ events: PRESET_EVENTS });
}
