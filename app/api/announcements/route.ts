import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

// GET — fetch announcements (used by dashboard and admin)
export async function GET() {
    try {
        const announcements = await readDB('announcements.json').catch(() => []);
        return NextResponse.json(announcements ?? []);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — admin posts a custom announcement
export async function POST(request: Request) {
    try {
        const { adminId, title, body } = await request.json();
        if (adminId !== 'admin-001') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const announcements: any[] = await readDB('announcements.json').catch(() => []);
        announcements.unshift({
            id: Date.now().toString(),
            type: 'admin',
            title: `📢 ${title}`,
            body,
            timestamp: new Date().toISOString(),
            isNew: true,
        });
        if (announcements.length > 30) announcements.pop();
        await writeDB('announcements.json', announcements);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE — clear announcements
export async function DELETE(request: Request) {
    try {
        const { adminId, id } = await request.json();
        if (adminId !== 'admin-001') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        if (id) {
            const announcements = await readDB('announcements.json').catch(() => []);
            const filtered = announcements.filter((a: any) => a.id !== id);
            await writeDB('announcements.json', filtered);
        } else {
            await writeDB('announcements.json', []);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
