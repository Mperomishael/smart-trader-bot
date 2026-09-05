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

  // Strict Top 10 settings
  MIN_PNL_30D_USD: Number(process.env.MIN_PNL_30D_USD || 25000),
  MIN_WIN_RATE_PCT: Number(process.env.MIN_WIN_RATE_PCT || 50),
  MIN_ACCOUNT_VALUE_USD: Number(process.env.MIN_ACCOUNT_VALUE_USD || 50000),
  MAX_TRACKED_TRADERS: Number(process.env.MAX_TRACKED_TRADERS || 10),

  // Refresh leaderboard every 15 minutes
  TRADER_REFRESH_INTERVAL_MS: Number(process.env.TRADER_REFRESH_INTERVAL_MS || 15 * 60 * 1000),
};
