const { buildQualifiedTraderList } = require('../src/hyperliquid/leaderboard');
const db = require('../src/db/supabase');

async function refreshTraders() {
  console.log('[refresh-traders] pulling leaderboard...');
  const qualified = await buildQualifiedTraderList();
  console.log(`[refresh-traders] ${qualified.length} traders qualified`);

  await db.upsertTraders(qualified);
  if (qualified.length) {
    await db.deactivateTradersNotIn(qualified.map((t) => t.address));
  }
  return qualified.map((t) => t.address);
}

if (require.main === module) {
  refreshTraders()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[refresh-traders] failed:', err);
      process.exit(1);
    });
}

module.exports = { refreshTraders };
