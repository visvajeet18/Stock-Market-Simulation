export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { borrowerId, loanId } = await request.json();

        if (!borrowerId || !loanId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const loans = await readDB('loans.json');

        const loanIndex = loans.findIndex((l: any) => l.id === loanId);
        if (loanIndex === -1) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

        const loan = loans[loanIndex];

        if (loan.borrowerId !== borrowerId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        if (loan.status !== 'PENDING_BORROWER') {
            return NextResponse.json({ error: 'Cannot decline proposal. Status: ' + loan.status }, { status: 400 });
        }

        // Update Loan Status
        loan.status = 'DECLINED';
        loans[loanIndex] = loan;

        await writeDB('loans.json', loans);

        return NextResponse.json({ success: true, loan });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

