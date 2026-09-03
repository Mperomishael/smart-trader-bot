const { TRADER_REFRESH_INTERVAL_MS } = require('./src/config');
const db = require('./src/db/supabase');
const { createBot } = require('./src/telegram/bot');
const { FillListener } = require('./src/hyperliquid/fillListener');
const { processFill } = require('./src/alertEngine');
const { refreshTraders } = require('./scripts/refreshTraders');

async function main() {
  console.log('[boot] Smart Trader Bot starting...');
  console.log('[boot] Refreshing Top 10 traders list...');

  // First refresh (non-fatal if it fails)
  await refreshTraders().catch((err) => {
    console.error('[boot] Initial trader refresh failed, continuing with existing list:', err.message);
  });

  const traders = await db.getActiveTraders();
  const addresses = traders.map((t) => t.address);
  console.log(`[boot] Tracking ${addresses.length} top traders`);

  // Create Telegram bot
  const bot = createBot();

  // Start real-time fill listener
  const listener = new FillListener(addresses, (fill, traderAddress) => {
    processFill(fill, traderAddress, bot).catch((err) =>
      console.error('[alert-engine] failed processing fill:', err.message)
    );
  });
  listener.start();

  // Periodically refresh the Top 10 list (every 15 min by default)
  setInterval(async () => {
    try {
      console.log('[refresh] Updating Top 10 traders...');
      const newAddresses = await refreshTraders();
      listener.updateAddresses(newAddresses);
      console.log(`[refresh] Now tracking ${newAddresses.length} traders`);
    } catch (err) {
      console.error('[refresh] failed:', err.message);
    }
  }, TRADER_REFRESH_INTERVAL_MS);

  // Clean old fill records every 6 hours
  setInterval(() => {
    db.pruneOldFills().catch((err) => console.error('[prune] failed:', err.message));
  }, 6 * 3600 * 1000);

  console.log('[boot] ✅ Smart Trader Bot is live and listening for trades');
}

main().catch((err) => {
  console.error('[boot] Fatal error:', err);
  process.exit(1);
});
