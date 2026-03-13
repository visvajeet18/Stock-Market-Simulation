import { NextResponse } from 'next/server';
import { readDB } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const users = await readDB('users.json');
        const user = users.find((u: any) => u.id === userId);

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (user.suspended) {
            return NextResponse.json({ error: 'Account suspended' }, { status: 403 });
        }

        // Do not return password
        const { password, ...safeUser } = user;

        return NextResponse.json(safeUser);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
