const { TRADER_REFRESH_INTERVAL_MS } = require('./src/config');
const db = require('./src/db/supabase');
const { createBot } = require('./src/telegram/bot');
const { FillListener } = require('./src/hyperliquid/fillListener');
const { processFill } = require('./src/alertEngine');
const { refreshTraders } = require('./scripts/refreshTraders');

async function main() {
  console.log('[boot] refreshing tracked trader list...');
  await refreshTraders().catch((err) => {
    // Non-fatal on boot - fall back to whatever's already in the DB.
    console.error('[boot] trader refresh failed, continuing with existing list:', err.message);
  });

  const traders = await db.getActiveTraders();
  const addresses = traders.map((t) => t.address);
  console.log(`[boot] tracking ${addresses.length} traders`);

  const bot = createBot();

  const listener = new FillListener(addresses, (fill, traderAddress) => {
    processFill(fill, traderAddress, bot).catch((err) =>
      console.error('[alert-engine] failed processing fill:', err.message)
    );
  });
  listener.start();

  // Periodically re-pull the leaderboard, recompute win rates, and
  // re-subscribe the WS connection to any newly qualified/disqualified traders.
  setInterval(async () => {
    try {
      const newAddresses = await refreshTraders();
      listener.updateAddresses(newAddresses);
      console.log(`[refresh] now tracking ${newAddresses.length} traders`);
    } catch (err) {
      console.error('[refresh] failed:', err.message);
    }
  }, TRADER_REFRESH_INTERVAL_MS);

  // Keep the fill-dedup table from growing forever.
  setInterval(() => {
    db.pruneOldFills().catch((err) => console.error('[prune] failed:', err.message));
  }, 6 * 3600 * 1000);

  console.log('[boot] smart-trader-bot running');
}

main().catch((err) => {
  console.error('[boot] fatal:', err);
  process.exit(1);
});
