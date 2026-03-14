export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readDB, writeDB } from '@/lib/db';

// ─── Market State ────────────────────────────────────────────────────────────
// Persisted in stocks via a global market state. We use a small sidecar
// file "market_state.json" to store sentiment, last-event, and circuit states.

// Sector correlation groups — when a market-wide event fires, these move together
const SECTOR_GROUPS: Record<string, string[]> = {
    tech: ['AAPL', 'GOOGL', 'MSFT'],
    indian_it: ['TCS.NS', 'INFY.NS'],
    conglomerate: ['RELIANCE.NS'],
    banking: ['HDFCBANK.NS'],
    ev: ['TSLA'],
    index: ['^BSESN'],
};

type Sentiment = 'bull' | 'bear' | 'volatile' | 'normal';

function sentimentDrift(sentiment: Sentiment): number {
    switch (sentiment) {
        case 'bull': return +0.45;   // strong upward bias
        case 'bear': return -0.35;   // downward pressure
        case 'volatile': return 0;       // neutral drift but 2× amplitude
        default: return +0.12;   // slight natural upward drift
    }
}

function sentimentAmplitude(sentiment: Sentiment, baseVol: number): number {
    if (sentiment === 'volatile') return baseVol * 2.2;
    if (sentiment === 'bull') return baseVol * 0.8;  // bull markets are smoother
    if (sentiment === 'bear') return baseVol * 1.4;  // bear markets choppier
    return baseVol;
}

export async function POST() {
    try {
        const stocks = await readDB('stocks.json');
        let state: any = {};
        try { state = await readDB('market_state.json'); } catch { state = {}; }
        if (!state) state = {};

        const sentiment: Sentiment = state.sentiment ?? 'normal';
        const haltedStocks: string[] = state.haltedStocks ?? [];
        const momentumMap: Record<string, number> = state.momentumMap ?? {};

        // ─── Check for triggered market event ───────────────────────────────────
        let eventMsg: string | null = null;
        if (state.pendingEvent) {
            eventMsg = state.pendingEvent.description;
            // Apply event immediately
            const ev = state.pendingEvent;
            const updatedStocksWithEvent = stocks.map((s: any) => {
                if (!s.autoUpdate || haltedStocks.includes(s.symbol)) return s;
                let impact = 0;
                if (ev.symbols?.includes(s.symbol)) {
                    impact = ev.impact;   // direct impact e.g. +15 or -20 (%)
                } else if (ev.sector && SECTOR_GROUPS[ev.sector]?.includes(s.symbol)) {
                    impact = ev.impact * 0.6; // sector spillover
                } else if (ev.market) {
                    impact = ev.impact * 0.3; // market-wide small ripple
                }
                if (impact !== 0) {
                    s.previousPrice = s.price;
                    s.price = Math.max(0.01, Math.round(s.price * (1 + impact / 100) * 100) / 100);
                    if (!s.history) s.history = [s.previousPrice];
                    s.history.push(s.price);
                    if (s.history.length > 80) s.history.shift();
                }
                return s;
            });
            let latestState: any = {};
            try { latestState = await readDB('market_state.json'); } catch { latestState = {}; }
            if (latestState.pendingEvent?.id === ev.id) latestState.pendingEvent = null;
            latestState.lastEvent = { ...ev, firedAt: new Date().toISOString() };
            await writeDB('market_state.json', latestState);
            await writeDB('stocks.json', updatedStocksWithEvent);
            return NextResponse.json({ success: true, event: ev.description });
        }

        // ─── Normal tick with GBM + momentum + mean reversion ───────────────────
        const updatedStocks = stocks.map((stock: any) => {
            if (stock.autoUpdate === false) return stock;
            if (haltedStocks.includes(stock.symbol)) return stock; // circuit breaker

            const baseVol = (stock.volatility ?? 0.02) * 100; // e.g. 2%
            const amplitude = sentimentAmplitude(sentiment, baseVol);
            const drift = sentimentDrift(sentiment);

            // Gaussian random via Box-Muller
            const u1 = Math.random(), u2 = Math.random();
            const gaussian = Math.sqrt(-2 * Math.log(u1 + 1e-9)) * Math.cos(2 * Math.PI * u2);

            // Geometric Brownian Motion step
            let changePercent = drift + amplitude * gaussian * 0.45;

            // ── Momentum: trending extends the move ──────────────────────────────
            const prevMomentum = momentumMap[stock.symbol] ?? 0;
            changePercent += prevMomentum * 0.18; // carry 18% of last move
            momentumMap[stock.symbol] = changePercent * 0.5; // decay momentum

            // ── Mean reversion: if price deviates far from 52W mid, pull back ──
            if (stock.weekHigh52 && stock.weekLow52) {
                const midPrice = (stock.weekHigh52 + stock.weekLow52) / 2;
                const deviation = (stock.price - midPrice) / midPrice; // +/- fraction
                changePercent -= deviation * 0.25; // gentle pull toward mid
            }

            // ── Circuit breaker: halt if single tick > 8% ───────────────────────
            if (Math.abs(changePercent) > 8) {
                state.haltedStocks.push(stock.symbol);
                changePercent = Math.sign(changePercent) * 4; // cap at 4%
            }

            const newPrice = Math.max(0.01, stock.price * (1 + changePercent / 100));
            stock.previousPrice = stock.price;
            stock.price = Math.round(newPrice * 100) / 100;

            if (!stock.history) stock.history = [stock.previousPrice];
            stock.history.push(stock.price);
            if (stock.history.length > 80) stock.history.shift();

            return stock;
        });

        // Persist momentum to state safely (preventing race condition with admin changes)
        let latestState: any = {};
        try { latestState = await readDB('market_state.json'); } catch { latestState = {}; }
        if (!latestState) latestState = {};

        latestState.momentumMap = momentumMap;
        latestState.haltedStocks = state.haltedStocks;
        if (latestState.pendingEvent && state.pendingEvent && latestState.pendingEvent.id === state.pendingEvent.id) {
            delete latestState.pendingEvent;
        }

        await writeDB('market_state.json', latestState);
        await writeDB('stocks.json', updatedStocks);

        // ─── Announcement Auto-Cleanup (10 min expiry) ──────────────────────────
        try {
            const announcements = await readDB('announcements.json').catch(() => []);
            const now = Date.now();
            const filtered = announcements.filter((a: any) => {
                const age = now - new Date(a.timestamp).getTime();
                return age < 10 * 60 * 1000; // 10 minutes
            });
            if (filtered.length !== announcements.length) {
                await writeDB('announcements.json', filtered);
            }
        } catch (e) {
            console.error("Announcement cleanup error:", e);
        }

        // ─── Process Pending Limit Orders ───────────────────────────────────────
        try {
            const orders = await readDB('orders.json');
            const pendingOrders = orders.filter((o: any) => o.status === 'PENDING');
            if (pendingOrders.length > 0) {
                const users = await readDB('users.json');
                const transactions = await readDB('transactions.json');
                let usersUpdated = false;
                let ordersUpdated = false;

                for (const order of pendingOrders) {
                    const priceNow = updatedStocks.find((s: any) => s.symbol === order.symbol)?.price;
                    if (!priceNow) continue;

                    let executed = false;
                    let executionPrice = priceNow;

                    if (order.action === 'LIMIT_BUY' && priceNow <= order.targetPrice) {
                        const existingStock = updatedStocks.find((s: any) => s.symbol === order.symbol);
                        if (existingStock && existingStock.availableQuantity !== undefined) {
                            if (existingStock.availableQuantity >= order.quantity) {
                                executed = true;
                                existingStock.availableQuantity -= order.quantity;
                            } else {
                                executed = false;
                            }
                        } else {
                            executed = true;
                        }
                    } else if (order.action === 'LIMIT_SELL' && priceNow >= order.targetPrice) {
                        executed = true;
                        const existingStock = updatedStocks.find((s: any) => s.symbol === order.symbol);
                        if (existingStock && existingStock.availableQuantity !== undefined) {
                            existingStock.availableQuantity += order.quantity;
                        }
                    }

                    if (executed) {
                        const userArrayIdx = users.findIndex((u: any) => u.id === order.userId);
                        if (userArrayIdx === -1) continue;

                        const u = users[userArrayIdx];

                        if (order.action === 'LIMIT_BUY') {
                            // Target price funds were locked. If execution price is lower, refund the difference.
                            const refund = (order.targetPrice - executionPrice) * order.quantity;
                            u.balance += refund;

                            if (!u.portfolio) u.portfolio = {};
                            const existing = u.portfolio[order.symbol];
                            if (existing && existing.qty > 0) {
                                const newQty = existing.qty + order.quantity;
                                const newAvgCost = (existing.avgCost * existing.qty + executionPrice * order.quantity) / newQty;
                                u.portfolio[order.symbol] = { qty: newQty, avgCost: +newAvgCost.toFixed(2) };
                            } else {
                                u.portfolio[order.symbol] = { qty: order.quantity, avgCost: executionPrice };
                            }
                        } else if (order.action === 'LIMIT_SELL') {
                            // Stock was already locked from portfolio. 
                            // Add cash balance at execution price.
                            u.balance += (executionPrice * order.quantity);
                        }

                        // Mark order fulfilled
                        order.status = 'FULFILLED';
                        order.executedAt = new Date().toISOString();
                        order.executionPrice = executionPrice;
                        ordersUpdated = true;
                        usersUpdated = true;

                        // Push log
                        transactions.push({
                            id: Date.now().toString() + Math.random().toString(36).substring(7),
                            userId: u.id,
                            type: order.action === 'LIMIT_BUY' ? 'BUY' : 'SELL',
                            symbol: order.symbol,
                            quantity: order.quantity,
                            price: executionPrice,
                            total: executionPrice * order.quantity,
                            timestamp: order.executedAt,
                            isLimitOrder: true
                        });
                    }
                }

                if (ordersUpdated) await writeDB('orders.json', orders);
                if (usersUpdated) await writeDB('users.json', users);
                if (ordersUpdated) await writeDB('transactions.json', transactions);
            }
        } catch (e) {
            console.error("Error processing limit orders:", e);
        }

        return NextResponse.json({ success: true, updated: updatedStocks.length, sentiment });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

