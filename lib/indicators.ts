// ─── Technical Indicators Library ───────────────────────────────────────────
// All functions are pure, client-side computable from a price history array.

/** Simple Moving Average */
export function sma(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] ?? 0;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

/** Exponential Moving Average */
export function ema(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    const k = 2 / (period + 1);
    let e = prices[0];
    for (let i = 1; i < prices.length; i++) {
        e = prices[i] * k + e * (1 - k);
    }
    return e;
}

/** RSI — Relative Strength Index (14-period default) */
export function rsi(prices: number[], period = 14): number {
    if (prices.length < period + 1) return 50;
    const changes = prices.slice(-period - 1).map((p, i, arr) =>
        i === 0 ? 0 : p - arr[i - 1]
    ).slice(1);

    const gains = changes.filter(c => c > 0);
    const losses = changes.filter(c => c < 0).map(Math.abs);

    const avgGain = gains.reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return Math.round(100 - 100 / (1 + rs));
}

/** MACD — returns { macd, signal, histogram, trend } */
export function macd(prices: number[]): {
    macd: number; signal: number; histogram: number; trend: 'bullish' | 'bearish' | 'neutral';
} {
    if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0, trend: 'neutral' };
    const ema12 = ema(prices, 12);
    const ema26 = ema(prices, 26);
    const macdLine = ema12 - ema26;

    // signal = 9-period EMA of MACD — approximate from last 9 diffs
    const recentPrices = prices.slice(-35);
    const macdSeries: number[] = [];
    for (let i = 26; i <= recentPrices.length; i++) {
        const e12 = ema(recentPrices.slice(0, i), 12);
        const e26 = ema(recentPrices.slice(0, i), 26);
        macdSeries.push(e12 - e26);
    }
    const signalLine = ema(macdSeries, 9);
    const histogram = macdLine - signalLine;

    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (histogram > 0.05) trend = 'bullish';
    else if (histogram < -0.05) trend = 'bearish';

    return { macd: +macdLine.toFixed(3), signal: +signalLine.toFixed(3), histogram: +histogram.toFixed(3), trend };
}

/** Bollinger Bands (20-period, 2σ) */
export function bollingerBands(prices: number[], period = 20): {
    upper: number; middle: number; lower: number; position: number;
    signal: 'overbought' | 'oversold' | 'neutral';
} {
    if (prices.length < period) {
        const p = prices[prices.length - 1] ?? 0;
        return { upper: p, middle: p, lower: p, position: 0.5, signal: 'neutral' };
    }
    const slice = prices.slice(-period);
    const middle = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    const upper = middle + 2 * stdDev;
    const lower = middle - 2 * stdDev;
    const current = prices[prices.length - 1];
    const position = stdDev === 0 ? 0.5 : (current - lower) / (upper - lower);

    let signal: 'overbought' | 'oversold' | 'neutral' = 'neutral';
    if (position >= 0.85) signal = 'overbought';
    else if (position <= 0.15) signal = 'oversold';

    return {
        upper: +upper.toFixed(2),
        middle: +middle.toFixed(2),
        lower: +lower.toFixed(2),
        position: +position.toFixed(3),
        signal,
    };
}

/** Composite analyst recommendation */
export function analystSignal(prices: number[]): {
    recommendation: 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL';
    score: number; // 0-100, higher = more bullish
    reasons: string[];
} {
    const rsiVal = rsi(prices);
    const { trend: macdTrend } = macd(prices);
    const { signal: bbSignal } = bollingerBands(prices);
    const sma20 = sma(prices, 20);
    const sma50 = sma(prices, 50);
    const current = prices[prices.length - 1] ?? 0;

    let score = 50;
    const reasons: string[] = [];

    // RSI signals
    if (rsiVal < 30) { score += 20; reasons.push(`RSI ${rsiVal} — oversold (buy zone)`); }
    else if (rsiVal < 45) { score += 10; reasons.push(`RSI ${rsiVal} — approaching buy zone`); }
    else if (rsiVal > 70) { score -= 20; reasons.push(`RSI ${rsiVal} — overbought (sell zone)`); }
    else if (rsiVal > 60) { score -= 10; reasons.push(`RSI ${rsiVal} — approaching sell zone`); }
    else { reasons.push(`RSI ${rsiVal} — neutral`); }

    // MACD signals
    if (macdTrend === 'bullish') { score += 15; reasons.push('MACD bullish crossover'); }
    else if (macdTrend === 'bearish') { score -= 15; reasons.push('MACD bearish crossover'); }
    else { reasons.push('MACD neutral'); }

    // Bollinger Bands signals
    if (bbSignal === 'oversold') { score += 15; reasons.push('Price near lower Bollinger Band — potential bounce'); }
    else if (bbSignal === 'overbought') { score -= 15; reasons.push('Price near upper Bollinger Band — potential pullback'); }

    // SMA crossover
    if (prices.length >= 50) {
        if (sma20 > sma50 && current > sma20) { score += 10; reasons.push('Golden cross: SMA20 above SMA50'); }
        else if (sma20 < sma50 && current < sma20) { score -= 10; reasons.push('Death cross: SMA20 below SMA50'); }
    }

    score = Math.max(0, Math.min(100, score));

    let recommendation: 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL';
    if (score >= 75) recommendation = 'STRONG BUY';
    else if (score >= 58) recommendation = 'BUY';
    else if (score >= 42) recommendation = 'HOLD';
    else if (score >= 25) recommendation = 'SELL';
    else recommendation = 'STRONG SELL';

    return { recommendation, score, reasons };
}
