const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_BOT_TOKEN } = require('../config');
const db = require('../db/supabase');
const { fmtUsd } = require('./formatAlert');

function createBot() {
  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

  // ========== MAIN MENU KEYBOARD ==========
  const mainMenu = {
    reply_markup: {
      keyboard: [
        [{ text: '🏆 Top 10 Traders' }, { text: '🔥 Live Signals' }],
        [{ text: '📋 My Following' }, { text: '📖 How it works' }]
      ],
      resize_keyboard: true,
      persistent: true
    }
  };

  // ========== HELPER FUNCTIONS ==========
  async function sendTop10(chatId) {
    const traders = await db.getActiveTraders();

    if (!traders.length) {
      return bot.sendMessage(chatId, 'No traders loaded yet. Please wait a minute and try again.', mainMenu);
    }

    const sorted = traders
      .sort((a, b) => (b.pnl_30d_usd || 0) - (a.pnl_30d_usd || 0))
      .slice(0, 10);

    let text = `🏆 *TOP 10 PROFITABLE TRADERS*\n_(Last 30 days)_\n\n`;

    sorted.forEach((t, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      text += `${medal} *${t.display_name}*\n`;
      text += `   +${fmtUsd(t.pnl_30d_usd)}  •  ${t.win_rate_pct}% win rate\n\n`;
    });

    const buttons = [];
    for (let i = 0; i < sorted.length; i += 2) {
      const row = [];
      row.push({
        text: `➕ ${sorted[i].display_name.slice(0, 14)}`,
        callback_data: `follow_trader:${sorted[i].address}`
      });
      if (sorted[i + 1]) {
        row.push({
          text: `➕ ${sorted[i + 1].display_name.slice(0, 14)}`,
          callback_data: `follow_trader:${sorted[i + 1].address}`
        });
      }
      buttons.push(row);
    }

    buttons.push([
      { text: '➕ Follow All Top 10', callback_data: 'follow_all_top' },
      { text: '🔄 Refresh', callback_data: 'refresh_traders' }
    ]);

    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
      ...mainMenu
    });
  }

  async function sendLiveSignals(chatId) {
    const traders = await db.getActiveTraders();

    if (!traders.length) {
      return bot.sendMessage(chatId, 'No traders are being tracked yet.\nPlease wait a moment and try again.', mainMenu);
    }

    const sorted = traders
      .sort((a, b) => (b.pnl_30d_usd || 0) - (a.pnl_30d_usd || 0))
      .slice(0, 10);

    let text = `🔥 *LIVE SIGNALS*\n\n`;
    text += `I am currently watching these *Top 10* traders in real-time.\n`;
    text += `The moment any of them opens or closes a trade, you will get an instant alert.\n\n`;
    text += `────────────────────\n`;

    sorted.forEach((t, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      text += `${medal} *${t.display_name}*\n`;
      text += `   Profit: +${fmtUsd(t.pnl_30d_usd)}  •  Win rate: ${t.win_rate_pct}%\n\n`;
    });

    text += `────────────────────\n`;
    text += `_Alerts are sent instantly via WebSocket — no delay._`;

    const buttons = [
      [
        { text: '🏆 Full Top 10', callback_data: 'show_traders' },
        { text: '📋 My Following', callback_data: 'my_following' }
      ],
      [{ text: '➕ Follow All Top 10', callback_data: 'follow_all_top' }]
    ];

    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
      ...mainMenu
    });
  }

  async function sendHowItWorks(chatId) {
    const text =
      `📖 *How this bot works*\n\n` +
      `1️⃣ Every 15 minutes we scan Hyperliquid and pick the *Top 10* traders with highest profit + high win rate.\n\n` +
      `2️⃣ We watch those 10 traders *24/7* in real time.\n\n` +
      `3️⃣ The second any of them opens or closes a trade → you get an instant notification.\n\n` +
      `4️⃣ You can follow individual traders or all of them.\n\n` +
      `Just copy what the smart money is doing.`;

    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏆 See Top 10 Traders', callback_data: 'show_traders' }],
          [{ text: '📋 What am I following?', callback_data: 'my_following' }]
        ]
      },
      ...mainMenu
    });
  }

  async function showMyFollowing(chatId) {
    const [coins, traderAddresses] = await Promise.all([
      db.getFollowedCoins(chatId),
      db.getFollowedTraders(chatId)
    ]);

    let text = `📋 *What you are following*\n\n`;

    if (traderAddresses.length > 0) {
      text += `*Traders:*\n`;
      for (const addr of traderAddresses) {
        const t = await db.getTrader(addr);
        text += `• ${t ? t.display_name : addr.slice(0, 10) + '…'}\n`;
      }
      text += `\n`;
    }

    if (coins.length > 0) {
      text += `*Coins:* ${coins.join(', ')}\n\n`;
    }

    if (traderAddresses.length === 0 && coins.length === 0) {
      text += `_You are not following anyone yet._\n\nTap *🏆 Top 10 Traders* to start.`;
    }

    const buttons = traderAddresses.map((addr) => {
      const short = addr.slice(0, 6) + '…' + addr.slice(-4);
      return [{ text: `❌ Unfollow ${short}`, callback_data: `unfollow_trader:${addr}` }];
    });

    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined,
      ...mainMenu
    });
  }

  // ========== MESSAGE HANDLER (more reliable) ==========
  bot.on('message', async (msg) => {
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    try {
      if (text === '/start') {
        await bot.sendMessage(chatId,
          `👋 *Welcome to Smart Trader Bot*\n\n` +
          `I watch the *Top 10 most profitable traders* on Hyperliquid and send you *instant alerts* the moment they open or close a trade.\n\n` +
          `Tap a button below to get started:`,
          { parse_mode: 'Markdown', ...mainMenu }
        );
        return;
      }

      if (text === '🏆 Top 10 Traders' || text === '/traders') {
        await sendTop10(chatId);
        return;
      }

      if (text === '🔥 Live Signals' || text === '/signals') {
        await sendLiveSignals(chatId);
        return;
      }

      if (text === '📖 How it works') {
        await sendHowItWorks(chatId);
        return;
      }

      if (text === '📋 My Following') {
        await showMyFollowing(chatId);
        return;
      }

    } catch (err) {
      console.error('[message handler error]', err);
      await bot.sendMessage(chatId, 'Something went wrong. Please try again.');
    }
  });

  // ========== CALLBACK HANDLERS ==========
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    try {
      if (data.startsWith('follow_trader:')) {
        const address = data.split(':')[1];
        const trader = await db.getTrader(address);

        if (!trader) {
          await bot.answerCallbackQuery(query.id, { text: 'Trader not found' });
          return;
        }

        await db.followTrader(chatId, address);
        await bot.answerCallbackQuery(query.id, { text: `Following ${trader.display_name}` });
        await bot.sendMessage(chatId,
          `✅ You are now following *${trader.display_name}*\n\nYou will get an alert every time they trade.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      if (data.startsWith('unfollow_trader:')) {
        const address = data.split(':')[1];
        await db.unfollowTrader(chatId, address);
        await bot.answerCallbackQuery(query.id, { text: 'Unfollowed' });
        await showMyFollowing(chatId);
        return;
      }

      if (data === 'show_traders' || data === 'refresh_traders') {
        await bot.answerCallbackQuery(query.id);
        await sendTop10(chatId);
        return;
      }

      if (data === 'my_following') {
        await bot.answerCallbackQuery(query.id);
        await showMyFollowing(chatId);
        return;
      }

      if (data === 'follow_all_top') {
        const traders = await db.getActiveTraders();
        if (!traders.length) {
          await bot.answerCallbackQuery(query.id, { text: 'No traders available' });
          return;
        }

        for (const t of traders) {
          await db.followTrader(chatId, t.address);
        }

        await bot.answerCallbackQuery(query.id, { text: `Following ${traders.length} traders!` });
        await bot.sendMessage(chatId,
          `✅ You are now following all *Top ${traders.length}* traders.\n\nYou will receive instant alerts.`,
          { parse_mode: 'Markdown' }
        );
      }

    } catch (err) {
      console.error('[callback error]', err);
      await bot.answerCallbackQuery(query.id, { text: 'Error occurred' });
    }
  });

  bot.on('polling_error', (err) => console.error('[telegram] polling error:', err.message));

  return bot;
}

module.exports = { createBot };
