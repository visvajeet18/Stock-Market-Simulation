import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { adminId, userId, suspend } = await request.json();

        if (!adminId || !userId || typeof suspend !== 'boolean') {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Authenticate admin (Hardcoded for this prototype)
        if (adminId !== 'admin-001') {
            return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
        }

        const users = await readDB('users.json');
        const userIndex = users.findIndex((u: any) => u.id === userId);

        if (userIndex === -1) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        users[userIndex].suspended = suspend;
        await writeDB('users.json', users);

        return NextResponse.json({ success: true, message: `User ${suspend ? 'suspended' : 'unsuspended'} successfully` });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
