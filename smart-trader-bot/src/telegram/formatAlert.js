function fmtUsd(n) {
  const num = Number(n) || 0;
  const abs = Math.abs(num);
  if (abs >= 1e6) return (num < 0 ? '-' : '') + '$' + (abs / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (num < 0 ? '-' : '') + '$' + (abs / 1e3).toFixed(0) + 'K';
  return (num < 0 ? '-' : '') + '$' + abs.toFixed(0);
}

function fmtPrice(n) {
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}

function formatOpenAlert({ trader, coin, side, entryPrice, positionUsd, time }) {
  const isLong = side === 'long';
  const action = isLong ? '🟢 BUY / LONG' : '🔴 SELL / SHORT';
  const sideText = isLong ? 'LONG' : 'SHORT';

  return (
    `🚨 *NEW TRADE SIGNAL*\n\n` +
    `${action} — *${coin}*\n\n` +
    `👤 Trader: *${trader.display_name}*\n` +
    `📈 30D Profit: *+${fmtUsd(trader.pnl_30d_usd || 0)}*\n` +
    `🎯 Win Rate: *${trader.win_rate_pct || '?'}%*\n\n` +
    `💰 Entry Price: *${fmtPrice(entryPrice)}*\n` +
    `📦 Position Size: *${fmtUsd(positionUsd)}*\n` +
    `🕒 Time: ${formatTime(time)}\n\n` +
    `📋 *COPY SIGNAL:*\n` +
    `Pair: ${coin}\n` +
    `Side: ${sideText}\n` +
    `Entry: ${Number(entryPrice).toFixed(2)}`
  );
}

function formatCloseAlert({ trader, coin, entryPrice, exitPrice, pnlUsd, heldMs }) {
  const held = formatDuration(heldMs);
  const profitEmoji = pnlUsd >= 0 ? '✅' : '❌';

  return (
    `${profitEmoji} *POSITION CLOSED* — ${coin}\n\n` +
    `👤 Trader: *${trader.display_name}*\n` +
    `Entry → Exit: ${fmtPrice(entryPrice)} → ${fmtPrice(exitPrice)}\n` +
    `PnL: *${pnlUsd >= 0 ? '+' : ''}${fmtUsd(pnlUsd)}*\n` +
    `⏱ Held: ${held}`
  );
}

function formatDuration(ms) {
  if (ms == null || ms < 0) return 'unknown';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

module.exports = {
  formatOpenAlert,
  formatCloseAlert,
  fmtUsd,
  fmtPrice
};
