import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { lenderId, loanId, interestRate } = await request.json();

        if (!lenderId || !loanId || interestRate === undefined || interestRate < 0) {
            return NextResponse.json({ error: 'Missing req fields or invalid interest' }, { status: 400 });
        }

        const loans = await readDB('loans.json');
        const loanIndex = loans.findIndex((l: any) => l.id === loanId);

        if (loanIndex === -1) {
            return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
        }

        const loan = loans[loanIndex];

        if (loan.lenderId !== lenderId) {
            return NextResponse.json({ error: 'Unauthorized to propose on this loan' }, { status: 403 });
        }

        if (loan.status !== 'PENDING_LENDER') {
            return NextResponse.json({ error: 'Loan is not in a state to receive proposals. Status: ' + loan.status }, { status: 400 });
        }

        loan.interestRate = Number(interestRate);
        loan.status = 'PENDING_BORROWER';

        loans[loanIndex] = loan;
        await writeDB('loans.json', loans);

        return NextResponse.json({ success: true, loan });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
