export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    try {
        const messages = await readDB('messages.json');
        // Return messages for this user
        const userMessages = messages.filter((m: any) => String(m.targetUserId) === String(userId));
        return NextResponse.json(userMessages);
    } catch {
        return NextResponse.json([]);
    }
}

export async function POST(request: Request) {
    try {
        const { adminId, targetUserId, message } = await request.json();

        if (!adminId || !targetUserId || !message) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        let messages = [];
        try { messages = await readDB('messages.json'); } catch { messages = []; }

        const newMessage = {
            id: Date.now().toString(),
            targetUserId,
            message,
            timestamp: new Date().toISOString(),
            read: false
        };

        messages.push(newMessage);
        // Keep last 200 messages
        if (messages.length > 200) messages.shift();
        
        await writeDB('messages.json', messages);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
