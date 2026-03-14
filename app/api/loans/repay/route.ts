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
        const borrowerIndex = users.findIndex((u: any) => u.id === borrowerId);

        if (borrowerIndex === -1) {
            return NextResponse.json({ error: 'Borrower not found' }, { status: 404 });
        }

        const loans = await readDB('loans.json');
        const loanIndex = loans.findIndex((l: any) => l.id === loanId);

        if (loanIndex === -1) {
            return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
        }

        const loan = loans[loanIndex];

        if (loan.borrowerId !== borrowerId) {
            return NextResponse.json({ error: 'Unauthorized to repay this loan' }, { status: 403 });
        }

        if (loan.status !== 'ACTIVE') {
            return NextResponse.json({ error: 'Loan is not currently active. Status: ' + loan.status }, { status: 400 });
        }

        // Calculate total amount to repay (Principal + Interest)
        const principal = loan.amount;
        const interestAmount = principal * (loan.interestRate / 100);
        const totalRepayment = principal + interestAmount;

        if (users[borrowerIndex].balance < totalRepayment) {
            return NextResponse.json({ error: `Insufficient funds. You need ₹${totalRepayment.toFixed(2)} to repay this.` }, { status: 400 });
        }

        // --- Execute Repayment ---

        const lenderIndex = users.findIndex((u: any) => u.id === loan.lenderId);
        if (lenderIndex === -1) {
            return NextResponse.json({ error: 'Lender account no longer exists. Debt forgiven.' }, { status: 400 }); // Edge case handle
        }

        // 1. Deduct from borrower
        users[borrowerIndex].balance -= totalRepayment;

        // 2. Add to lender
        users[lenderIndex].balance += totalRepayment;

        // 3. Update loan status
        loan.status = 'COMPLETED';
        loan.repaidAt = new Date().toISOString();

        loans[loanIndex] = loan;

        // Save states
        await writeDB('users.json', users);
        await writeDB('loans.json', loans);

        // Record in transactions
        const transactions = await readDB('transactions.json');
        transactions.push({
            id: Date.now().toString(),
            userId: borrowerId,
            type: 'REPAY',
            symbol: `LOAN-${loan.id}`,
            quantity: 1,
            price: totalRepayment,
            total: totalRepayment,
            timestamp: loan.repaidAt
        });
        transactions.push({
            id: (Date.now() + 1).toString(),
            userId: loan.lenderId,
            type: 'COLLECT',
            symbol: `LOAN-${loan.id}`,
            quantity: 1,
            price: totalRepayment,
            total: totalRepayment,
            timestamp: loan.repaidAt
        });
        await writeDB('transactions.json', transactions);

        return NextResponse.json({ success: true, loan, repaymentInfo: { principal, interest: interestAmount, total: totalRepayment } });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

