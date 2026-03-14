export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { borrowerId, loanId } = await request.json();

        if (!borrowerId || !loanId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const users = await readDB('users.json');
        const loans = await readDB('loans.json');

        const loanIndex = loans.findIndex((l: any) => l.id === loanId);
        if (loanIndex === -1) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

        const loan = loans[loanIndex];

        if (loan.borrowerId !== borrowerId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        if (loan.status !== 'PENDING_BORROWER') {
            return NextResponse.json({ error: 'Cannot accept proposal. Status: ' + loan.status }, { status: 400 });
        }

        // Fund Check
        const lenderIndex = users.findIndex((u: any) => u.id === loan.lenderId);
        if (lenderIndex === -1) return NextResponse.json({ error: 'Lender account no longer exists' }, { status: 400 });

        if (users[lenderIndex].balance < loan.amount) {
            return NextResponse.json({ error: 'Lender has insufficient cash to fund this loan now.' }, { status: 400 });
        }

        // Execute Transaction
        users[lenderIndex].balance -= loan.amount;

        const borrowerIndex = users.findIndex((u: any) => u.id === borrowerId);
        users[borrowerIndex].balance += loan.amount;

        loan.status = 'ACTIVE';
        loan.fundedAt = new Date().toISOString();
        loans[loanIndex] = loan;

        await writeDB('users.json', users);
        await writeDB('loans.json', loans);

        // Record in transactions
        const transactions = await readDB('transactions.json');
        transactions.push({
            id: Date.now().toString(),
            userId: loan.lenderId,
            type: 'LEND',
            symbol: `LOAN-TO-${loan.borrowerUsername}`,
            quantity: 1,
            price: loan.amount,
            total: loan.amount,
            timestamp: loan.fundedAt
        });
        transactions.push({
            id: (Date.now() + 1).toString(),
            userId: loan.borrowerId,
            type: 'BORROW',
            symbol: `LOAN-FROM-${loan.lenderUsername}`,
            quantity: 1,
            price: loan.amount,
            total: loan.amount,
            timestamp: loan.fundedAt
        });
        await writeDB('transactions.json', transactions);

        return NextResponse.json({ success: true, loan });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

