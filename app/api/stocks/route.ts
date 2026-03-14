export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';
export async function GET() {
    try {
        let stocks = await readDB('stocks.json');
        let changed = false;

        const updatedStocks = stocks.map((stock: any) => {
            // Save previous price for UI indicators
            if (!stock.previousPrice) stock.previousPrice = stock.price;

            // Initialize history array if missing
            if (!stock.history) stock.history = Array(20).fill(stock.price); // backfill with current price for initial chart look

            // Simulate market fluctuation for realistic organic feel
            if (stock.autoUpdate !== false && Math.random() < 0.5) {
                changed = true;
                stock.previousPrice = stock.price;
                const changePercent = (Math.random() * stock.volatility * 2) - stock.volatility;
                let newPrice = stock.price * (1 + changePercent);
                stock.price = Math.round(newPrice * 100) / 100; // 2 decimal places

                // Add to history (limit to 60 points)
                stock.history.push(stock.price);
                if (stock.history.length > 60) {
                    stock.history.shift();
                }
            }
            return stock;
        });

        if (changed) {
            await writeDB('stocks.json', updatedStocks);
        }

        return NextResponse.json(updatedStocks);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

