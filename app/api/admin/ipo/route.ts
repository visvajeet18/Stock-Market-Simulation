import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { adminId, symbol, name, sector, initialPrice, shares } = body;

        if (!adminId || !symbol || !name || !sector || !initialPrice || !shares) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const stocks = await readDB('stocks.json');

        // Ensure symbol doesn't already exist
        const exists = stocks.find((s: any) => s.symbol === symbol.toUpperCase());
        if (exists) return NextResponse.json({ error: 'Stock symbol already exists' }, { status: 400 });

        const newStock = {
            symbol: symbol.toUpperCase(),
            name,
            sector,
            price: Number(initialPrice),
            previousPrice: Number(initialPrice),
            history: [Number(initialPrice)],
            autoUpdate: true,
            volatility: 0.05, // IPOs are slightly more volatile initially
            beta: 1.5,
            weekHigh52: Number(initialPrice) * 1.5,
            weekLow52: Number(initialPrice) * 0.8,
            availableQuantity: Number(shares)
        };

        stocks.push(newStock);
        await writeDB('stocks.json', stocks);

        // Announce the IPO
        const announcements = await readDB('announcements.json');
        announcements.unshift({
            id: Date.now().toString(),
            title: `🚀 NEW IPO LISTING: ${newStock.symbol}`,
            body: `${name} has just been listed on the market at ₹${initialPrice}. Total shares available: ${shares.toLocaleString()}`,
            type: 'event',
            timestamp: new Date().toISOString()
        });
        await writeDB('announcements.json', announcements);

        // Track in market metadata
        let state: any;
        try {
            state = await readDB('market_state.json');
        } catch { state = {}; }

        if (!state.stockMeta) state.stockMeta = {};
        state.stockMeta[newStock.symbol] = {
            sector,
            industry: sector,
            description: `Newly listed IPO company: ${name}`
        };
        await writeDB('market_state.json', state);

        return NextResponse.json({ success: true, stock: newStock });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
