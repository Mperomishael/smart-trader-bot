const db = require('./db/supabase');
const { formatOpenAlert, formatCloseAlert } = require('./telegram/formatAlert');

// Hyperliquid labels fills with a human-readable `dir`, e.g.:
//   "Open Long", "Open Short", "Close Long", "Close Short"
// Flip fills (e.g. "Long > Short") are treated as a close of the old side
// followed by an open of the new side - handled as two synthetic events.
function classify(dir) {
  const d = dir.toLowerCase();
  if (d.startsWith('open long')) return { action: 'open', side: 'long' };
  if (d.startsWith('open short')) return { action: 'open', side: 'short' };
  if (d.startsWith('close long')) return { action: 'close', side: 'long' };
  if (d.startsWith('close short')) return { action: 'close', side: 'short' };
  if (d.includes('long > short')) return { action: 'flip', from: 'long', to: 'short' };
  if (d.includes('short > long')) return { action: 'flip', from: 'short', to: 'long' };
  return { action: 'ignore' };
}

async function processFill(fill, traderAddress, bot) {
  if (fill.tid == null) return;
  if (await db.isFillSeen(fill.tid)) return;
  await db.markFillSeen(fill.tid);

  const trader = await db.getTrader(traderAddress);
  if (!trader || !trader.active) return; // not a tracked trader (shouldn't happen, but be safe)

  const coin = fill.coin;
  const px = Number(fill.px);
  const sz = Number(fill.sz);
  const positionUsd = px * sz;
  const info = classify(fill.dir);

  if (info.action === 'open') {
    await db.upsertOpenPosition({
      trader_address: traderAddress,
      coin,
      side: info.side,
      entry_price: px,
      size: sz,
      opened_at: new Date(fill.time).toISOString(),
    });
    await broadcast(
      bot,
      coin,
      formatOpenAlert({ trader, coin, side: info.side, entryPrice: px, positionUsd })
    );
    return;
  }

  if (info.action === 'close') {
    const existing = await db.getOpenPosition(traderAddress, coin);
    const entryPrice = existing ? existing.entry_price : px;
    const openedAt = existing ? new Date(existing.opened_at).getTime() : null;
    const heldMs = openedAt ? fill.time - openedAt : null;
    await db.clearOpenPosition(traderAddress, coin);
    await broadcast(
      bot,
      coin,
      formatCloseAlert({
        trader,
        coin,
        entryPrice,
        exitPrice: px,
        pnlUsd: Number(fill.closedPnl) || 0,
        heldMs,
      })
    );
    return;
  }

  if (info.action === 'flip') {
    // Close the old side first (if we have it tracked), then open the new one.
    const existing = await db.getOpenPosition(traderAddress, coin);
    if (existing) {
      const heldMs = Date.now() - new Date(existing.opened_at).getTime();
      await broadcast(
        bot,
        coin,
        formatCloseAlert({
          trader,
          coin,
          entryPrice: existing.entry_price,
          exitPrice: px,
          pnlUsd: Number(fill.closedPnl) || 0,
          heldMs,
        })
      );
    }
    await db.upsertOpenPosition({
      trader_address: traderAddress,
      coin,
      side: info.to,
      entry_price: px,
      size: sz,
      opened_at: new Date(fill.time).toISOString(),
    });
    await broadcast(
      bot,
      coin,
      formatOpenAlert({ trader, coin, side: info.to, entryPrice: px, positionUsd })
    );
  }
}

async function broadcast(bot, coin, message) {
  const chatIds = await db.getSubscribersForCoin(coin.toUpperCase());
  await Promise.all(
    chatIds.map((chatId) =>
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' }).catch((err) => {
        console.error(`[telegram] failed to send to ${chatId}:`, err.message);
      })
    )
  );
}

module.exports = { processFill, classify };
