const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_BOT_TOKEN } = require('../config');
const db = require('../db/supabase');

function createBot() {
  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

  bot.onText(/^\/start/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      "Welcome. This bot alerts you when proven profitable Hyperliquid traders " +
        "open, close, or flip a real position — not raw whale transfers.\n\n" +
        'Commands:\n' +
        '/follow BTC — get alerts for a coin\n' +
        '/unfollow BTC — stop alerts for a coin\n' +
        '/following — list your active coins\n' +
        '/traders — show currently tracked traders'
    );
  });

  bot.onText(/^\/follow(?:@\w+)?\s+(\w+)/i, async (msg, match) => {
    const coin = match[1].toUpperCase();
    await db.follow(msg.chat.id, coin);
    bot.sendMessage(msg.chat.id, `Following ${coin}. You'll get an alert on any real trade in it.`);
  });

  bot.onText(/^\/unfollow(?:@\w+)?\s+(\w+)/i, async (msg, match) => {
    const coin = match[1].toUpperCase();
    await db.unfollow(msg.chat.id, coin);
    bot.sendMessage(msg.chat.id, `Unfollowed ${coin}.`);
  });

  bot.onText(/^\/following/, async (msg) => {
    const coins = await db.getFollowedCoins(msg.chat.id);
    bot.sendMessage(msg.chat.id, coins.length ? coins.join(', ') : "You're not following any coins yet. Try /follow BTC");
  });

  bot.onText(/^\/traders/, async (msg) => {
    const traders = await db.getActiveTraders();
    if (!traders.length) {
      bot.sendMessage(msg.chat.id, 'No traders tracked yet — run the trader refresh job first.');
      return;
    }
    const lines = traders
      .sort((a, b) => (b.pnl_30d_usd || 0) - (a.pnl_30d_usd || 0))
      .slice(0, 20)
      .map(
        (t) =>
          `${t.display_name} — 30D PnL +$${Math.round(t.pnl_30d_usd).toLocaleString()}, win rate ${t.win_rate_pct}%`
      );
    bot.sendMessage(msg.chat.id, lines.join('\n'));
  });

  bot.on('polling_error', (err) => console.error('[telegram] polling error:', err.message));

  return bot;
}

module.exports = { createBot };
