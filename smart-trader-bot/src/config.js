require('dotenv').config();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

module.exports = {
  TELEGRAM_BOT_TOKEN: required('TELEGRAM_BOT_TOKEN'),
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_KEY: required('SUPABASE_SERVICE_KEY'),

  HYPERLIQUID_WS_URL: process.env.HYPERLIQUID_WS_URL || 'wss://api.hyperliquid.xyz/ws',
  HYPERLIQUID_INFO_URL: process.env.HYPERLIQUID_INFO_URL || 'https://api.hyperliquid.xyz/info',
  HYPERLIQUID_LEADERBOARD_URL:
    process.env.HYPERLIQUID_LEADERBOARD_URL || 'https://stats-data.hyperliquid.xyz/Mainnet/leaderboard',

  // Trader-selection thresholds used when refreshing the tracked-trader list.
  MIN_PNL_30D_USD: Number(process.env.MIN_PNL_30D_USD || 50000),
  MIN_WIN_RATE_PCT: Number(process.env.MIN_WIN_RATE_PCT || 55),
  MIN_ACCOUNT_VALUE_USD: Number(process.env.MIN_ACCOUNT_VALUE_USD || 100000),
  MAX_TRACKED_TRADERS: Number(process.env.MAX_TRACKED_TRADERS || 40),

  // How often (ms) to re-pull the leaderboard and recompute win rates.
  TRADER_REFRESH_INTERVAL_MS: Number(process.env.TRADER_REFRESH_INTERVAL_MS || 30 * 60 * 1000),
};
