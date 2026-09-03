const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_BOT_TOKEN } = require('../config');
const db = require('../db/supabase');
const { fmtUsd } = require('./formatAlert');

function createBot() {
  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

  // ========== MAIN MENU ==========
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

  // ========== START / WELCOME ==========
  bot.onText(/^\/start/, async (msg) => {
    const text =
      `👋 *Welcome to Smart Trader Bot*\n\n` +
      `I watch the *Top 10 most profitable traders* on Hyperliquid and send you *instant alerts* the moment they open or close a trade.\n\n` +
      `No complicated charts. Just copy what the best performers are doing.\n\n` +
      `Tap a button below to get started:`;

    await bot.sendMessage(msg.chat.id, text, {
      parse_mode: 'Markdown',
      ...mainMenu
    });
  });

  // ========== TOP 10 TRADERS ==========
  bot.onText(/🏆 Top 10 Traders|\/traders/, async (msg) => {
    const traders = await db.getActiveTraders();

    if (!traders.length) {
      return bot.sendMessage(msg.chat.id, 'No traders loaded yet. Please wait a minute and try again.', mainMenu);
    }

    const sorted = traders
      .sort((a, b) => (b.pnl_30d_usd || 0) - (a.pnl_30d_usd || 0))
      .slice(0, 10);

    let text = `🏆 *TOP 10 PROFITABLE TRADERS*\n_(Last 30 days)_\n\n`;

    sorted.forEach((t, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      text += `\( {medal} * \){t.display_name}*\n`;
      text += `   +${fmtUsd(t.pnl_30d_usd)}  •  ${t.win_rate_pct}% win rate\n\n`;
    });

    // Follow buttons (2 per row)
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

    await bot.sendMessage(msg.chat.id, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
      ...mainMenu
    });
  });

  // ========== LIVE SIGNALS ==========
  bot.onText(/🔥 Live Signals|\/signals/, async (msg) => {
    const traders = await db.getActiveTraders();

    if (!traders.length) {
      return bot.sendMessage(msg.chat.id, 'No traders are being tracked yet.\nPlease wait a moment and try again.', mainMenu);
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
      text += `\( {medal} * \){t.display_name}*\n`;
      text += `   Profit: +${fmtUsd(t.pnl_30d_usd)}  •  Win rate: ${t.win_rate_pct}%\n\n`;
    });

    text += `────────────────────\n`;
    text += `_Alerts are sent instantly via WebSocket — no delay._`;

    const buttons = [
      [
        { text: '🏆 Full Top 10', callback_data: 'show_traders' },
        { text: '📋 My Following', callback_data: 'my_following' }
      ],
      [
        { text: '➕ Follow All Top 10', callback_data: 'follow_all_top' }
      ]
    ];

    await bot.sendMessage(msg.chat.id, text, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
      ...mainMenu
    });
  });

  // ========== HOW IT WORKS ==========
  bot.onText(/📖 How it works/, async (msg) => {
    const text =
      `📖 *How this bot works* (simple version)\n\n` +
      `1️⃣ Every 15 minutes we scan Hyperliquid and pick the *10 traders* who made the most money in the last 30 days and have a high win rate.\n\n` +
      `2️⃣ We watch those 10 traders *24/7* in real time.\n\n` +
      `3️⃣ The second any of them opens, closes, or flips a position → *you get a notification instantly*.\n\n` +
      `4️⃣ You can follow the whole list or only the traders you like.\n\n` +
      `No indicators. No complicated analysis. Just copy smart money.\n\n` +
      `Ready?`;

    await bot.sendMessage(msg.chat.id, text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏆 See Top 10 Traders', callback_data: 'show_traders' }],
          [{ text: '📋 What am I following?', callback_data: 'my_following' }]
        ]
      },
      ...mainMenu
    });
  });

  // ========== MY FOLLOWING ==========
  bot.onText(/📋 My Following/, async (msg) => {
    await showMyFollowing(bot, msg.chat.id);
  });

  // ========== CALLBACK HANDLERS ==========
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    try {
      // Follow a specific trader
      if (data.startsWith('follow_trader:')) {
        const address = data.split(':')[1];
        const trader = await db.getTrader(address);

        if (!trader) {
          await bot.answerCallbackQuery(query.id, { text: 'Trader not found' });
          return;
        }

        await db.followTrader(chatId, address);
        await bot.answerCallbackQuery(query.id, { text: `Now following ${trader.display_name}` });

        await bot.sendMessage(
          chatId,
          `✅ You are now following *${trader.display_name}*\n\n` +
          `You will get an instant alert every time they open or close a trade.`,
          { parse_mode: 'Markdown' }
        );
      }

      // Unfollow a specific trader
      if (data.startsWith('unfollow_trader:')) {
        const address = data.split(':')[1];
        await db.unfollowTrader(chatId, address);
        await bot.answerCallbackQuery(query.id, { text: 'Unfollowed' });
        await showMyFollowing(bot, chatId);
      }

      // Show / Refresh Top 10
      if (data === 'show_traders' || data === 'refresh_traders') {
        await bot.answerCallbackQuery(query.id);
        bot.emit('text', { chat: { id: chatId }, text: '🏆 Top 10 Traders' });
      }

      // My Following
      if (data === 'my_following') {
        await bot.answerCallbackQuery(query.id);
        await showMyFollowing(bot, chatId);
      }

      // Follow All Top 10
      if (data === 'follow_all_top') {
        const traders = await db.getActiveTraders();

        if (!traders.length) {
          await bot.answerCallbackQuery(query.id, { text: 'No traders available right now' });
          return;
        }

        let count = 0;
        for (const t of traders) {
          await db.followTrader(chatId, t.address);
          count++;
        }

        await bot.answerCallbackQuery(query.id, { text: `Following ${count} traders!` });

        await bot.sendMessage(
          chatId,
          `✅ *Done!*\n\n` +
          `You are now following all *Top ${count}* traders.\n\n` +
          `You will receive an instant alert the second any of them opens or closes a trade.`,
          { parse_mode: 'Markdown' }
        );
      }

    } catch (err) {
      console.error('[callback error]', err);
      await bot.answerCallbackQuery(query.id, { text: 'Something went wrong. Please try again.' });
    }
  });

  // ========== HELPER: Show what the user is following ==========
  async function showMyFollowing(botInstance, chatId) {
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

    // Unfollow buttons
    const buttons = traderAddresses.map((addr) => {
      const short = addr.slice(0, 6) + '…' + addr.slice(-4);
      return [{ text: `❌ Unfollow \( {short}`, callback_data: `unfollow_trader: \){addr}` }];
    });

    await botInstance.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined
    });
  }

  bot.on('polling_error', (err) => console.error('[telegram] polling error:', err.message));

  return bot;
}

module.exports = { createBot };
