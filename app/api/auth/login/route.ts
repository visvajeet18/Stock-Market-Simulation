export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB } from '@/lib/db';

const ADMIN_CREDENTIALS = {
    id: 'admin-001',
    name: 'Administrator',
    username: 'admin',
    password: 'fin@krct.sim',
    role: 'admin'
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
            return NextResponse.json({ success: true, user: ADMIN_CREDENTIALS });
        }

        const users = await readDB('users.json');
        const user = users.find((u: any) => u.username === username && u.password === password);

        if (!user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        if (user.suspended) {
            return NextResponse.json({ error: 'Your account has been suspended for malpractice. Contact Administrator.' }, { status: 403 });
        }

        return NextResponse.json({ success: true, user: { id: user.id, name: user.name, username: user.username, role: user.role, balance: user.balance } });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
