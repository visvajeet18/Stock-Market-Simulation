import { NextResponse } from 'next/server';
import { readDB } from '@/lib/db';

// Fetch users for the dropdown (exclude self and admins)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const currentUserId = searchParams.get('userId');

        const users = await readDB('users.json');

        let availableUsers = users.filter((u: any) => u.role !== 'admin' && !u.suspended);
        if (currentUserId) {
            availableUsers = availableUsers.filter((u: any) => u.id !== currentUserId);
        }

        // Return only necessary info (id, name, username)
        const simplifiedUsers = availableUsers.map((u: any) => ({
            id: u.id,
            name: u.name,
            username: u.username
        }));

        return NextResponse.json(simplifiedUsers);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
