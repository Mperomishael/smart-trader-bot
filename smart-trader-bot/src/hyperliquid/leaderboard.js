const {
  HYPERLIQUID_LEADERBOARD_URL,
  HYPERLIQUID_INFO_URL,
  MIN_PNL_30D_USD,
  MIN_WIN_RATE_PCT,
  MIN_ACCOUNT_VALUE_USD,
  MAX_TRACKED_TRADERS,
} = require('../config');

// Hyperliquid's public (undocumented but stable) leaderboard feed - the same
// data that powers app.hyperliquid.xyz/leaderboard. GET, no auth required.
async function fetchLeaderboard() {
  const res = await fetch(HYPERLIQUID_LEADERBOARD_URL);
  if (!res.ok) throw new Error(`Leaderboard fetch failed: ${res.status}`);
  const data = await res.json();
  return data.leaderboardRows || data;
}

// Win rate isn't in the leaderboard feed, so we derive it from a trader's
// recent closed fills: wins / (wins + losses), ignoring zero-PnL fills
// (opens, funding-only events, etc).
async function computeWinRate(address) {
  const res = await fetch(HYPERLIQUID_INFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'userFills', user: address }),
  });
  if (!res.ok) return null;
  const fills = await res.json();

  let wins = 0;
  let losses = 0;
  for (const f of fills) {
    const pnl = Number(f.closedPnl);
    if (!pnl) continue; // opens and non-closing fills report 0
    if (pnl > 0) wins += 1;
    else losses += 1;
  }
  const total = wins + losses;
  if (total < 5) return null; // not enough closed trades to be meaningful
  return Number(((wins / total) * 100).toFixed(1));
}

function pickWindow(row, window) {
  const perf = (row.windowPerformances || []).find(([w]) => w === window);
  return perf ? perf[1] : null;
}

// Pulls the leaderboard, filters to traders who clear the configured bar,
// enriches survivors with a computed win rate, and returns rows shaped for
// the `traders` table.
async function buildQualifiedTraderList() {
  const rows = await fetchLeaderboard();

  const candidates = rows
    .map((row) => {
      const month = pickWindow(row, 'month');
      return {
        address: row.ethAddress || row.address,
        accountValue: Number(row.accountValue),
        pnl30d: month ? Number(month.pnl) : null,
        roi30d: month ? Number(month.roi) * 100 : null,
      };
    })
    .filter(
      (c) =>
        c.address &&
        c.pnl30d !== null &&
        c.pnl30d >= MIN_PNL_30D_USD &&
        c.accountValue >= MIN_ACCOUNT_VALUE_USD
    )
    .sort((a, b) => b.pnl30d - a.pnl30d)
    .slice(0, MAX_TRACKED_TRADERS * 2); // over-fetch; win-rate filter trims further

  const qualified = [];
  for (const c of candidates) {
    const winRate = await computeWinRate(c.address);
    if (winRate === null || winRate < MIN_WIN_RATE_PCT) continue;
    qualified.push({
      address: c.address,
      display_name: `Trader ${c.address.slice(0, 6)}`,
      active: true,
      pnl_30d_usd: c.pnl30d,
      roi_30d_pct: c.roi30d,
      win_rate_pct: winRate,
      account_value: c.accountValue,
      stats_updated_at: new Date().toISOString(),
    });
    if (qualified.length >= MAX_TRACKED_TRADERS) break;
  }
  return qualified;
}

module.exports = { fetchLeaderboard, computeWinRate, buildQualifiedTraderList };
