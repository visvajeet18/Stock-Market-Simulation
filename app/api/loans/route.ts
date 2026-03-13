import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

// Fetch all loans, or just for a specific user
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        const loans = await readDB('loans.json');

        let filteredLoans = loans;
        if (userId) {
            filteredLoans = loans.filter((l: any) => l.borrowerId === userId || l.lenderId === userId);
        }

        return NextResponse.json(filteredLoans);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
