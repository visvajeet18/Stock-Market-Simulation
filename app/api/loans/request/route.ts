export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { borrowerId, lenderId, amount, description } = await request.json();

        if (!borrowerId || !lenderId || !amount) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (amount <= 0) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
        }

        const users = await readDB('users.json');
        const borrower = users.find((u: any) => u.id === borrowerId);
        const lender = users.find((u: any) => u.id === lenderId);

        if (!borrower) return NextResponse.json({ error: 'Borrower not found' }, { status: 404 });
        if (!lender) return NextResponse.json({ error: 'Lender not found' }, { status: 404 });

        if (borrowerId === lenderId) {
            return NextResponse.json({ error: 'Cannot borrow from yourself' }, { status: 400 });
        }

        const loans = await readDB('loans.json');

        const newLoan = {
            id: Date.now().toString(),
            borrowerId,
            borrowerName: borrower.name,
            borrowerUsername: borrower.username,
            lenderId,
            lenderName: lender.name,
            lenderUsername: lender.username,
            amount: Number(amount),
            interestRate: null, // To be proposed by lender
            description: description || '',
            status: 'PENDING_LENDER', // PENDING_LENDER, PENDING_BORROWER, ACTIVE, COMPLETED, REJECTED
            createdAt: new Date().toISOString(),
            fundedAt: null,
            repaidAt: null
        };

        loans.push(newLoan);
        await writeDB('loans.json', loans);

        return NextResponse.json({ success: true, loan: newLoan });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

