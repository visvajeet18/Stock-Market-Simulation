export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

// Accept a loan request
export async function POST(request: Request) {
    try {
        const { lenderId, loanId } = await request.json();

        if (!lenderId || !loanId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const users = await readDB('users.json');
        const lenderIndex = users.findIndex((u: any) => u.id === lenderId);

        if (lenderIndex === -1) {
            return NextResponse.json({ error: 'Lender not found' }, { status: 404 });
        }

        const loans = await readDB('loans.json');
        const loanIndex = loans.findIndex((l: any) => l.id === loanId);

        if (loanIndex === -1) {
            return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
        }

        const loan = loans[loanIndex];

        if (loan.status !== 'PENDING') {
            return NextResponse.json({ error: 'Loan cannot be accepted. Status is ' + loan.status }, { status: 400 });
        }

        if (loan.borrowerId === lenderId) {
            return NextResponse.json({ error: 'You cannot fund your own loan request' }, { status: 400 });
        }

        if (users[lenderIndex].balance < loan.amount) {
            return NextResponse.json({ error: 'Insufficient funds to lend' }, { status: 400 });
        }

        // --- Execute Transaction ---

        // 1. Deduct from lender
        users[lenderIndex].balance -= loan.amount;

        // 2. Add to borrower
        const borrowerIndex = users.findIndex((u: any) => u.id === loan.borrowerId);
        if (borrowerIndex !== -1) {
            users[borrowerIndex].balance += loan.amount;
        } else {
            return NextResponse.json({ error: 'Borrower account no longer exists.' }, { status: 400 });
        }

        // 3. Update loan status
        loan.status = 'ACTIVE';
        loan.lenderId = lenderId;
        loan.lenderName = users[lenderIndex].name;
        loan.fundedAt = new Date().toISOString();

        loans[loanIndex] = loan;

        // Save states
        await writeDB('users.json', users);
        await writeDB('loans.json', loans);

        // Record it in transactions as well for activity log
        const transactions = await readDB('transactions.json');
        transactions.push({
            id: Date.now().toString(),
            userId: lenderId,
            type: 'LEND',
            symbol: `LOAN-TO-${loan.borrowerUsername}`,
            quantity: 1,
            price: loan.amount, // representing amount flowing out
            total: loan.amount,
            timestamp: loan.fundedAt
        });
        transactions.push({
            id: (Date.now() + 1).toString(),
            userId: loan.borrowerId,
            type: 'BORROW',
            symbol: `LOAN-FROM-${users[lenderIndex].username}`,
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

