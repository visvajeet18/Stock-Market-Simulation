export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        const loans = await readDB('loans.json').catch(() => []);

        let filteredLoans = loans;
        if (userId) {
            filteredLoans = loans.filter((l: any) => l.borrowerId === userId || l.lenderId === userId);
        }

        return NextResponse.json(filteredLoans);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const adminId = searchParams.get('adminId');
        const id = searchParams.get('id');
        const clearAll = searchParams.get('clearAll') === 'true';

        if (adminId !== 'admin-001') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const loans = await readDB('loans.json').catch(() => []);
        
        if (clearAll) {
            await writeDB('loans.json', []);
        } else if (id) {
            const filtered = loans.filter((l: any) => l.id !== id);
            await writeDB('loans.json', filtered);
        } else {
            return NextResponse.json({ error: 'Missing id or clearAll parameter' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
