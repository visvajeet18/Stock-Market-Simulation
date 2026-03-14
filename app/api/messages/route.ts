export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    try {
        const users = await readDB('users.json');
        const user = users.find((u: any) => String(u.id) === String(userId));
        return NextResponse.json(user?.privateMessages || []);
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

        const users = await readDB('users.json');
        const userIndex = users.findIndex((u: any) => String(u.id) === String(targetUserId));
        
        if (userIndex === -1) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const newMessage = {
            id: Date.now().toString(),
            message,
            timestamp: new Date().toISOString(),
            read: false
        };

        if (!users[userIndex].privateMessages) users[userIndex].privateMessages = [];
        users[userIndex].privateMessages.push(newMessage);
        
        // Keep last 50 messages per user to avoid bloat
        if (users[userIndex].privateMessages.length > 50) users[userIndex].privateMessages.shift();
        
        await writeDB('users.json', users);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
