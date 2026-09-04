function escapeMarkdownV2(text) {
  if (text == null) return '';
  return String(text).replace(/[_*[\]()\~`>#+=|{}.!\\-]/g, '\\$&');
}

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

  const name = escapeMarkdownV2(trader.display_name);
  const coinSafe = escapeMarkdownV2(coin);
  const pnl = escapeMarkdownV2(fmtUsd(trader.pnl_30d_usd || 0));
  const win = escapeMarkdownV2(String(trader.win_rate_pct || '?'));
  const entry = escapeMarkdownV2(fmtPrice(entryPrice));
  const size = escapeMarkdownV2(fmtUsd(positionUsd));
  const t = escapeMarkdownV2(formatTime(time));
  const entryRaw = escapeMarkdownV2(Number(entryPrice).toFixed(2));

  return (
    `🚨 *NEW TRADE SIGNAL*\n\n` +
    `\( {action} — * \){coinSafe}*\n\n` +
    `👤 Trader: *${name}*\n` +
    `📈 30D Profit: *+${pnl}*\n` +
    `🎯 Win Rate: *${win}%*\n\n` +
    `💰 Entry Price: *${entry}*\n` +
    `📦 Position Size: *${size}*\n` +
    `🕒 Time: ${t}\n\n` +
    `📋 *COPY SIGNAL:*\n` +
    `Pair: ${coinSafe}\n` +
    `Side: ${sideText}\n` +
    `Entry: ${entryRaw}`
  );
}

function formatCloseAlert({ trader, coin, entryPrice, exitPrice, pnlUsd, heldMs }) {
  const held = formatDuration(heldMs);
  const profitEmoji = pnlUsd >= 0 ? '✅' : '❌';

  const name = escapeMarkdownV2(trader.display_name);
  const coinSafe = escapeMarkdownV2(coin);
  const entry = escapeMarkdownV2(fmtPrice(entryPrice));
  const exit = escapeMarkdownV2(fmtPrice(exitPrice));
  const pnl = escapeMarkdownV2(fmtUsd(pnlUsd));
  const heldSafe = escapeMarkdownV2(held);

  return (
    `${profitEmoji} *POSITION CLOSED* — ${coinSafe}\n\n` +
    `👤 Trader: *${name}*\n` +
    `Entry → Exit: ${entry} → ${exit}\n` +
    `PnL: *\( {pnlUsd >= 0 ? '+' : ''} \){pnl}*\n` +
    `⏱ Held: ${heldSafe}`
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
  fmtPrice,
  escapeMarkdownV2,
};
