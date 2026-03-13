// ─── Preset Market Events (shared constants) ─────────────────────────────────
// This file is imported by both the API route and the admin client component.
// It contains NO server-only imports.

export const PRESET_EVENTS = [
    // COMPANY SPECIFIC
    { id: 'aapl_earnings_beat', label: '🍎 AAPL Earnings Beat (+12%)', symbols: ['AAPL'], impact: +12, description: 'Apple posts record quarterly revenue — EPS beats estimates by 18%' },
    { id: 'aapl_product_launch', label: '📱 Apple Vision Pro Launch (+8%)', symbols: ['AAPL'], impact: +8, description: 'Apple launches landmark AR headset — stock surges on analyst upgrades' },
    { id: 'tsla_recall', label: '🚗 Tesla Safety Recall (-15%)', symbols: ['TSLA'], impact: -15, description: 'NHTSA orders Tesla to recall 500K vehicles over autopilot defects' },
    { id: 'tsla_delivery_beat', label: '⚡ Tesla Q4 Deliveries Beat (+18%)', symbols: ['TSLA'], impact: +18, description: 'Tesla delivers record 600K vehicles in Q4 — smashes analyst expectations' },
    { id: 'msft_ai_deal', label: '🤖 Microsoft AI Mega-Deal (+10%)', symbols: ['MSFT'], impact: +10, description: 'Microsoft signs $10B government AI contract with Pentagon' },
    { id: 'googl_antitrust', label: '⚖️ Google Antitrust Ruling (-12%)', symbols: ['GOOGL'], impact: -12, description: 'US judge rules against Google in landmark search-monopoly case' },
    { id: 'amzn_prime_hike', label: '📦 Amazon Prime Price Hike (+7%)', symbols: ['AMZN'], impact: +7, description: 'Amazon raises Prime to ₹1,999/yr — analysts upgrade on margin expansion' },
    { id: 'reliance_jio_ipo', label: '📡 Jio IPO Filing (+14%)', symbols: ['RELIANCE.NS'], impact: +14, description: 'Reliance files for Jio Financial Services IPO — massive value unlock' },
    { id: 'hdfc_rbi_penalty', label: '🏦 RBI Penalty on HDFC (-8%)', symbols: ['HDFCBANK.NS'], impact: -8, description: 'RBI levies ₹5.6Cr penalty on HDFC for KYC compliance failures' },
    { id: 'tcs_mega_contract', label: '💼 TCS Wins $2B Contract (+9%)', symbols: ['TCS.NS'], impact: +9, description: 'TCS wins a 10-year digital transformation deal with UK NHS' },
    { id: 'infy_whistleblow', label: '📣 Infosys Whistleblower Report (-10%)', symbols: ['INFY.NS'], impact: -10, description: 'Anonymous employee letter alleges revenue manipulation at Infosys' },

    // SECTOR EVENTS
    { id: 'fed_rate_hike', label: '🏛️ Fed Rate Hike +50bps (Tech -7%)', sector: 'tech', impact: -7, description: 'Federal Reserve surprises markets with 50bps rate hike — tech valuations contract' },
    { id: 'it_tailwind', label: '💻 IT Sector Upgrade (Indian IT +8%)', sector: 'indian_it', impact: +8, description: 'UBS upgrades Indian IT sector to overweight — deal pipeline at 3-year high' },
    { id: 'oil_price_spike', label: '🛢️ Oil Price Spike (Energy +12%)', sector: 'conglomerate', impact: +12, description: 'Brent crude tops $95/bbl — Reliance refinery margins surge' },
    { id: 'ev_subsidy_cut', label: '⚡ EV Subsidy Cut (EV -10%)', sector: 'ev', impact: -10, description: 'US cuts EV tax credits for vehicles over $55K — dampens demand outlook' },

    // MARKET WIDE
    { id: 'market_crash', label: '💥 Market Crash Trigger (-8% All)', market: true, impact: -8, description: 'Stagflation fears grip global markets — broad sell-off across all sectors' },
    { id: 'bull_rally', label: '🚀 Broad Market Bull Rally (+6% All)', market: true, impact: +6, description: 'Inflation data cools — Fed signals rate-cut path. Euphoric rally across indices' },
    { id: 'fii_inflow', label: '💰 FII Mega Inflow (+5% All)', market: true, impact: +5, description: 'Foreign Institutional Investors pump ₹15,000Cr into Indian equities in a single session' },
    { id: 'global_recession', label: '🌍 Global Recession Warning (-10% All)', market: true, impact: -10, description: 'IMF downgrades global growth — recession probability hits 65% per Goldman Sachs' },
];

export type MarketEvent = typeof PRESET_EVENTS[0];
