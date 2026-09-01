function fmtUsd(n) {
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${n < 0 ? '-' : ''}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${n < 0 ? '-' : ''}$${(abs / 1e3).toFixed(0)}K`;
  return `${n < 0 ? '-' : ''}$${abs.toFixed(2)}`;
}

function fmtPrice(n) {
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function traderLink(address) {
  return `https://app.hyperliquid.xyz/explorer/address/${address}`;
}

function formatOpenAlert({ trader, coin, side, entryPrice, positionUsd, leverage }) {
  const isLong = side === 'long';
  const header = isLong ? 'BUY / LONG' : 'SELL / SHORT';
  const pnlLine = trader.pnl_30d_usd != null ? `30D PnL: +${fmtUsd(trader.pnl_30d_usd)}\n` : '';
  const winLine = trader.win_rate_pct != null ? `Win rate: ${trader.win_rate_pct}%\n` : '';
  const levLine = leverage ? `Leverage: ${leverage}x\n` : '';
  return (
    `SMART MONEY ALERT\n` +
    `${header} — ${coin}\n\n` +
    `Trader: ${trader.display_name}\n` +
    pnlLine +
    winLine +
    `Entry: ${fmtPrice(entryPrice)}\n` +
    `Position: ${fmtUsd(positionUsd)}\n` +
    levLine +
    `${isLong ? 'Long' : 'Short'} ${coin}\n\n` +
    `[View Trader](${traderLink(trader.address)})`
  );
}

function formatCloseAlert({ trader, coin, entryPrice, exitPrice, pnlUsd, heldMs }) {
  const held = formatDuration(heldMs);
  return (
    `POSITION CLOSED\n` +
    `${coin}\n\n` +
    `Trader: ${trader.display_name}\n` +
    `Entry: ${fmtPrice(entryPrice)}\n` +
    `Exit: ${fmtPrice(exitPrice)}\n` +
    `PnL: ${pnlUsd >= 0 ? '+' : ''}${fmtUsd(pnlUsd)}\n` +
    `Held: ${held}`
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

module.exports = { formatOpenAlert, formatCloseAlert, fmtUsd, fmtPrice };
