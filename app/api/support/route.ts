export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { userId, username, message } = await request.json();

        if (!userId || !username || !message) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const supportMessages = await readDB('support_messages.json').catch(() => []);
        
        supportMessages.unshift({
            id: Date.now().toString(),
            userId,
            username,
            message,
            timestamp: new Date().toISOString(),
            status: 'NEW'
        });

        if (supportMessages.length > 100) supportMessages.pop();
        await writeDB('support_messages.json', supportMessages);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const adminId = searchParams.get('adminId');

        if (adminId !== 'admin-001') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const supportMessages = await readDB('support_messages.json').catch(() => []);
        return NextResponse.json(supportMessages);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

