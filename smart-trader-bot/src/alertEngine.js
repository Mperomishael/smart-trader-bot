const db = require('./db/supabase');
const { formatOpenAlert, formatCloseAlert } = require('./telegram/formatAlert');

function classify(dir) {
  const d = (dir || '').toLowerCase();
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
  if (!trader || !trader.active) return;

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
    await broadcast(bot, coin, traderAddress, formatOpenAlert({
      trader,
      coin,
      side: info.side,
      entryPrice: px,
      positionUsd,
      time: fill.time
    }), trader, { side: info.side, px });
    return;
  }

  if (info.action === 'close') {
    const existing = await db.getOpenPosition(traderAddress, coin);
    const entryPrice = existing ? existing.entry_price : px;
    const openedAt = existing ? new Date(existing.opened_at).getTime() : null;
    const heldMs = openedAt ? fill.time - openedAt : null;
    await db.clearOpenPosition(traderAddress, coin);
    await broadcast(bot, coin, traderAddress, formatCloseAlert({
      trader, coin, entryPrice, exitPrice: px,
      pnlUsd: Number(fill.closedPnl) || 0, heldMs
    }), trader);
    return;
  }

  if (info.action === 'flip') {
    const existing = await db.getOpenPosition(traderAddress, coin);
    if (existing) {
      const heldMs = Date.now() - new Date(existing.opened_at).getTime();
      await broadcast(bot, coin, traderAddress, formatCloseAlert({
        trader, coin,
        entryPrice: existing.entry_price,
        exitPrice: px,
        pnlUsd: Number(fill.closedPnl) || 0,
        heldMs
      }), trader);
    }
    await db.upsertOpenPosition({
      trader_address: traderAddress,
      coin,
      side: info.to,
      entry_price: px,
      size: sz,
      opened_at: new Date(fill.time).toISOString(),
    });
    await broadcast(bot, coin, traderAddress, formatOpenAlert({
      trader,
      coin,
      side: info.to,
      entryPrice: px,
      positionUsd,
      time: fill.time
    }), trader, { side: info.to, px });
  }
}

async function broadcast(bot, coin, traderAddress, message, trader, signalData = null) {
  // Get people following the coin OR this specific trader
  const [coinSubs, traderSubs] = await Promise.all([
    db.getSubscribersForCoin(coin.toUpperCase()),
    db.getSubscribersForTrader(traderAddress),
  ]);

  const allChatIds = [...new Set([...coinSubs, ...traderSubs])];

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🔍 View Trader', url: `https://app.hyperliquid.xyz/explorer/address/${traderAddress}` },
        { text: '➕ Follow Trader', callback_data: `follow_trader:${traderAddress}` }
      ]
    ]
  };

  if (signalData) {
    keyboard.inline_keyboard.push([
      { text: '📋 Copy Signal', callback_data: `copy_signal:${coin}:${signalData.side}:${signalData.px}` }
    ]);
  }

  await Promise.all(
    allChatIds.map((chatId) =>
      bot.sendMessage(chatId, message, {
        parse_mode: 'MarkdownV2',
        reply_markup: keyboard,
        disable_web_page_preview: true,
      }).catch((err) => console.error(`[telegram] failed to send to ${chatId}:`, err.message))
    )
  );
}

module.exports = { processFill, classify };
