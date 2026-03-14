export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { lenderId, loanId } = await request.json();

        if (!lenderId || !loanId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const loans = await readDB('loans.json');
        const users = await readDB('users.json');

        const loanIndex = loans.findIndex((l: any) => l.id === loanId);
        if (loanIndex === -1) {
            return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
        }

        const loan = loans[loanIndex];

        if (loan.lenderId !== lenderId) {
            return NextResponse.json({ error: 'Only the lender can recall this loan' }, { status: 403 });
        }

        if (loan.status !== 'ACTIVE') {
            return NextResponse.json({ error: 'Loan must be ACTIVE to recall' }, { status: 400 });
        }

        const borrower = users.find((u: any) => u.id === loan.borrowerId);
        const lender = users.find((u: any) => u.id === loan.lenderId);

        if (!borrower || !lender) {
            return NextResponse.json({ error: 'User(s) not found' }, { status: 404 });
        }

        const totalToRecall = loan.amount; // Recalling principal only or including interest? The user said "get money instantly back". Usually principal.

        if (borrower.balance < totalToRecall) {
            // If borrower doesn't have enough, take what they have? 
            // Or allow it and drive them into negative? 
            // The simulation usually shouldn't crash. Let's allowing negative for "forced" recovery if needed, 
            // or just take the maximum available. 
            // Following "Force" logic: drive them into debt if necessary.
        }

        borrower.balance -= totalToRecall;
        lender.balance += totalToRecall;

        loan.status = 'COMPLETED';
        loan.repaidAt = new Date().toISOString();
        loan.description = (loan.description || '') + ' [FORCED RECALL]';

        await writeDB('users.json', users);
        await writeDB('loans.json', loans);

        return NextResponse.json({ success: true, message: 'Loan principal recalled successfully', loan });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
