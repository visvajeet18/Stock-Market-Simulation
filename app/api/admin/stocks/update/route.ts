export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { adminId, symbol, action, value } = await request.json();

        // In a real app, verify adminId against session/DB
        if (!adminId || !symbol || !action) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const stocks = await readDB('stocks.json');
        const stockIndex = stocks.findIndex((s: any) => s.symbol === symbol);

        if (stockIndex === -1) {
            return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
        }

        const stock = stocks[stockIndex];
        stock.previousPrice = stock.price; // Save for UI

        if (action === 'SET_PRICE') {
            if (typeof value !== 'number' || value <= 0) {
                return NextResponse.json({ error: 'Invalid price value' }, { status: 400 });
            }
            stock.price = Math.round(value * 100) / 100;
            stock.autoUpdate = false; // Disable auto-update when manual price is set
        } else if (action === 'SET_QUANTITY') {
            if (typeof value !== 'number' || value < 0) {
                return NextResponse.json({ error: 'Invalid quantity value' }, { status: 400 });
            }
            stock.availableQuantity = Math.floor(value);
        } else if (action === 'HIKE' || action === 'DROP') {
            const percentage = typeof value === 'number' ? value : 5; // Default 5%
            const multiplier = action === 'HIKE' ? (1 + percentage / 100) : (1 - percentage / 100);
            stock.price = Math.round((stock.price * multiplier) * 100) / 100;
        } else if (action === 'TOGGLE_AUTO') {
            stock.autoUpdate = value === true;
        } else if (action === 'UNHALT') {
            let state: any = {};
            try { state = await readDB('market_state.json'); } catch { state = {}; }
            if (state && state.haltedStocks) {
                state.haltedStocks = state.haltedStocks.filter((s: string) => s !== symbol);
                await writeDB('market_state.json', state);
            }
        } else if (action === 'HALT') {
            let state: any = {};
            try { state = await readDB('market_state.json'); } catch { state = {}; }
            if (!state) state = {};
            if (!state.haltedStocks) state.haltedStocks = [];
            if (!state.haltedStocks.includes(symbol)) {
                state.haltedStocks.push(symbol);
                await writeDB('market_state.json', state);
            }
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // Push to history for charts
        if (!stock.history) stock.history = Array(20).fill(stock.previousPrice);
        stock.history.push(stock.price);
        if (stock.history.length > 60) stock.history.shift();

        stocks[stockIndex] = stock;
        await writeDB('stocks.json', stocks);

        return NextResponse.json({ success: true, stock });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
