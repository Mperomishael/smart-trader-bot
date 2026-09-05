const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_BOT_TOKEN } = require('../config');
const db = require('../db/supabase');
const state = require('../state');
const { fmtUsd, fmtPrice, formatDuration, formatOpenAlert, escapeMarkdownV2 } = require('./formatAlert');

function createBot() {
  const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

  const mainMenu = {
    reply_markup: {
      keyboard: [
        [{ text: '🏆 Top 10 Traders' }, { text: '🔥 Live Signals' }],
        [{ text: '📊 Open Positions' }, { text: '📋 My Following' }],
        [{ text: '📖 How it works' }],
      ],
      resize_keyboard: true,
      persistent: true,
    },
  };

  async function sendTop10(chatId) {
    const traders = await db.getActiveTraders();

    if (!traders.length) {
      return bot.sendMessage(chatId, 'No traders loaded yet. Please wait a minute and try again.', mainMenu);
    }

    const sorted = traders
      .sort((a, b) => (b.pnl_30d_usd || 0) - (a.pnl_30d_usd || 0))
      .slice(0, 10);

    let text = `🏆 *TOP 10 PROFITABLE TRADERS*\n_\\(Last 30 days\\)_\n\n`;

    sorted.forEach((t, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}\\.`;
      const name = escapeMarkdownV2(t.display_name);
      const pnl = escapeMarkdownV2(fmtUsd(t.pnl_30d_usd));
      const win = escapeMarkdownV2(String(t.win_rate_pct || '?'));
      text += `${medal} *${name}*\n`;
      text += `   \\+${pnl}  •  ${win}% win rate\n\n`;
    });

    const buttons = [];
    for (let i = 0; i < sorted.length; i += 2) {
      const row = [];
      row.push({
        text: `➕ ${sorted[i].display_name.slice(0, 14)}`,
        callback_data: `follow_trader:${sorted[i].address}`,
      });
      if (sorted[i + 1]) {
        row.push({
          text: `➕ ${sorted[i + 1].display_name.slice(0, 14)}`,
          callback_data: `follow_trader:${sorted[i + 1].address}`,
        });
      }
      buttons.push(row);
    }

    buttons.push([
      { text: '➕ Follow All Top 10', callback_data: 'follow_all_top' },
      { text: '🔄 Refresh', callback_data: 'refresh_traders' },
    ]);

    await bot.sendMessage(chatId, text, {
      parse_mode: 'MarkdownV2',
      reply_markup: { inline_keyboard: buttons },
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
    text += `I am currently watching these *Top 10* traders in real\\-time\\.\n`;
    text += `The moment any of them opens or closes a trade, you will get an instant alert\\.\n\n`;
    text += `────────────────────\n`;

    sorted.forEach((t, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}\\.`;
      const name = escapeMarkdownV2(t.display_name);
      const pnl = escapeMarkdownV2(fmtUsd(t.pnl_30d_usd));
      const win = escapeMarkdownV2(String(t.win_rate_pct || '?'));
      text += `${medal} *${name}*\n`;
      text += `   Profit: \\+${pnl}  •  Win rate: ${win}%\n\n`;
    });

    text += `────────────────────\n`;
    text += `_Alerts are sent instantly via WebSocket — no delay\\._`;

    const buttons = [
      [
        { text: '🏆 Full Top 10', callback_data: 'show_traders' },
        { text: '📋 My Following', callback_data: 'my_following' },
      ],
      [{ text: '➕ Follow All Top 10', callback_data: 'follow_all_top' }],
    ];

    await bot.sendMessage(chatId, text, {
      parse_mode: 'MarkdownV2',
      reply_markup: { inline_keyboard: buttons },
    });
  }

  async function sendHowItWorks(chatId) {
    const text =
      `📖 *How this bot works*\n\n` +
      `1️⃣ Every 15 minutes we scan Hyperliquid and pick the *Top 10* traders with highest profit \\+ high win rate\\.\n\n` +
      `2️⃣ We watch those 10 traders *24/7* in real time\\.\n\n` +
      `3️⃣ The second any of them opens or closes a trade → you get an instant notification\\.\n\n` +
      `4️⃣ You can follow individual traders or all of them\\.\n\n` +
      `Just copy what the smart money is doing\\.`;

    await bot.sendMessage(chatId, text, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🏆 See Top 10 Traders', callback_data: 'show_traders' }],
          [{ text: '📋 What am I following?', callback_data: 'my_following' }],
        ],
      },
    });
  }

  async function sendOpenPositions(chatId) {
    const positions = await db.getAllOpenPositions();

    if (!positions.length) {
      return bot.sendMessage(
        chatId,
        '📊 No open positions right now.\n\nAll tracked traders are flat — check back soon.',
        mainMenu
      );
    }

    let text = `📊 *OPEN POSITIONS*\n\n`;
    const seenTraders = new Map();

    for (const p of positions) {
      const trader = await db.getTrader(p.trader_address);
      const name = escapeMarkdownV2(
        trader ? trader.display_name : p.trader_address.slice(0, 6) + '…' + p.trader_address.slice(-4)
      );
      const coin = escapeMarkdownV2(p.coin);
      const sideEmoji = p.side === 'long' ? '🟢' : '🔴';
      const sideText = p.side === 'long' ? 'LONG' : 'SHORT';
      const entry = escapeMarkdownV2(fmtPrice(p.entry_price));
      const heldMs = Date.now() - new Date(p.opened_at).getTime();
      const held = escapeMarkdownV2(formatDuration(heldMs));

      text += `${sideEmoji} *${sideText} ${coin}* — ${name}\n`;
      text += `   Entry: ${entry}  •  Open ${held}\n\n`;

      if (trader && !seenTraders.has(p.trader_address)) {
        seenTraders.set(p.trader_address, trader.display_name);
      }
    }

    const buttons = [];
    for (const [address, displayName] of seenTraders) {
      buttons.push([{ text: `➕ Follow ${displayName.slice(0, 18)}`, callback_data: `follow_trader:${address}` }]);
    }
    buttons.push([{ text: '🔄 Refresh', callback_data: 'refresh_positions' }]);

    await bot.sendMessage(chatId, text, {
      parse_mode: 'MarkdownV2',
      reply_markup: { inline_keyboard: buttons },
    });
  }

  async function sendStatus(chatId) {
    const uptimeMs = Date.now() - state.startedAt;
    const uptime = escapeMarkdownV2(formatDuration(uptimeMs));
    const wsIcon = state.wsConnected ? '🟢 Connected' : '🔴 Disconnected';
    const lastRefresh = state.lastRefreshAt
      ? escapeMarkdownV2(formatDuration(Date.now() - state.lastRefreshAt)) + ' ago'
      : 'never yet';

    const text =
      `🩺 *BOT STATUS*\n\n` +
      `Uptime: *${uptime}*\n` +
      `Hyperliquid feed: ${wsIcon}\n` +
      `Tracked traders: *${state.trackedCount}*\n` +
      `Last leaderboard refresh: *${lastRefresh}*\n\n` +
      `Use /testalert to send yourself a sample trade alert and confirm delivery works\\.`;

    await bot.sendMessage(chatId, text, { parse_mode: 'MarkdownV2', ...mainMenu });
  }

  async function sendTestAlert(chatId) {
    const traders = await db.getActiveTraders();
    const trader = traders[0] || {
      display_name: 'Demo Trader',
      pnl_30d_usd: 125000,
      win_rate_pct: 68,
    };

    const fakeAlert = formatOpenAlert({
      trader,
      coin: 'BTC',
      side: 'long',
      entryPrice: 63200,
      positionUsd: 45000,
      time: Date.now(),
    });

    await bot.sendMessage(
      chatId,
      `🧪 *TEST ALERT* \\(not a real trade — this just confirms delivery works\\)\n\n` + fakeAlert,
      { parse_mode: 'MarkdownV2' }
    );
  }

  async function showMyFollowing(chatId) {
    const [coins, traderAddresses] = await Promise.all([
      db.getFollowedCoins(chatId),
      db.getFollowedTraders(chatId),
    ]);

    let text = `📋 *What you are following*\n\n`;

    if (traderAddresses.length > 0) {
      text += `*Traders:*\n`;
      for (const addr of traderAddresses) {
        const t = await db.getTrader(addr);
        const name = escapeMarkdownV2(t ? t.display_name : addr.slice(0, 10) + '…');
        text += `• ${name}\n`;
      }
      text += `\n`;
    }

    if (coins.length > 0) {
      text += `*Coins:* ${escapeMarkdownV2(coins.join(', '))}\n\n`;
    }

    if (traderAddresses.length === 0 && coins.length === 0) {
      text += `_You are not following anyone yet\\._\n\nTap *🏆 Top 10 Traders* to start\\.`;
    }

    const buttons = [];
    traderAddresses.forEach((addr) => {
      const short = addr.slice(0, 6) + '…' + addr.slice(-4);
      buttons.push([{ text: `❌ Unfollow ${short}`, callback_data: `unfollow_trader:${addr}` }]);
    });
    coins.forEach((c) => {
      buttons.push([{ text: `❌ Unfollow ${c}`, callback_data: `unfollow_coin:${c}` }]);
    });

    await bot.sendMessage(chatId, text, {
      parse_mode: 'MarkdownV2',
      reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined,
    });
  }

  // ========== MESSAGE HANDLER ==========
  bot.on('message', async (msg) => {
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const lower = text.toLowerCase();

    try {
      if (lower === '/start') {
        await bot.sendMessage(
          chatId,
          `👋 *Welcome to Smart Trader Bot*\n\n` +
            `I watch the *Top 10 most profitable traders* on Hyperliquid and send you *instant alerts* the moment they open or close a trade\\.\n\n` +
            `Tap a button below to get started:`,
          { parse_mode: 'MarkdownV2', ...mainMenu }
        );
        return;
      }

      if (lower.startsWith('/follow ')) {
        const coin = text.slice(8).trim().toUpperCase();
        if (!coin) {
          await bot.sendMessage(chatId, 'Usage: `/follow BTC`', { parse_mode: 'MarkdownV2', ...mainMenu });
          return;
        }
        await db.follow(chatId, coin);
        await bot.sendMessage(
          chatId,
          `✅ You are now following *${escapeMarkdownV2(coin)}*\n\nYou will get alerts when any tracked trader trades ${escapeMarkdownV2(coin)}\\.`,
          { parse_mode: 'MarkdownV2', ...mainMenu }
        );
        return;
      }

      if (lower.startsWith('/unfollow ')) {
        const coin = text.slice(10).trim().toUpperCase();
        if (!coin) {
          await bot.sendMessage(chatId, 'Usage: `/unfollow BTC`', { parse_mode: 'MarkdownV2', ...mainMenu });
          return;
        }
        await db.unfollow(chatId, coin);
        await bot.sendMessage(chatId, `❌ Unfollowed *${escapeMarkdownV2(coin)}*`, {
          parse_mode: 'MarkdownV2',
          ...mainMenu,
        });
        return;
      }

      if (lower === '/following') {
        await showMyFollowing(chatId);
        return;
      }

      if (text === '🏆 Top 10 Traders' || lower === '/traders') {
        await sendTop10(chatId);
        return;
      }

      if (text === '📊 Open Positions' || lower === '/positions') {
        await sendOpenPositions(chatId);
        return;
      }

      if (lower === '/status') {
        await sendStatus(chatId);
        return;
      }

      if (lower === '/testalert') {
        await sendTestAlert(chatId);
        return;
      }

      if (text === '🔥 Live Signals' || lower === '/signals') {
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
        await bot.sendMessage(
          chatId,
          `✅ You are now following *${escapeMarkdownV2(trader.display_name)}*\n\nYou will get an alert every time they trade\\.`,
          { parse_mode: 'MarkdownV2' }
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

      if (data.startsWith('unfollow_coin:')) {
        const coin = data.split(':')[1];
        await db.unfollow(chatId, coin);
        await bot.answerCallbackQuery(query.id, { text: `Unfollowed ${coin}` });
        await showMyFollowing(chatId);
        return;
      }

      if (data.startsWith('copy_signal:')) {
        const parts = data.split(':');
        const coin = parts[1];
        const side = parts[2];
        const entryPrice = parts[3];

        const sideText = side === 'long' ? 'BUY / LONG' : 'SELL / SHORT';

        await bot.answerCallbackQuery(query.id, { text: 'Signal copied!' });
        await bot.sendMessage(
          chatId,
          `📋 *COPY SIGNAL*\n\n` +
            `Pair: *${escapeMarkdownV2(coin)}*\n` +
            `Side: *${sideText}*\n` +
            `Entry: *${escapeMarkdownV2(Number(entryPrice).toFixed(2))}*\n\n` +
            `_This is for reference only\\. DYOR before trading\\._`,
          { parse_mode: 'MarkdownV2' }
        );
        return;
      }

      if (data === 'show_traders' || data === 'refresh_traders') {
        await bot.answerCallbackQuery(query.id);
        await sendTop10(chatId);
        return;
      }

      if (data === 'refresh_positions') {
        await bot.answerCallbackQuery(query.id);
        await sendOpenPositions(chatId);
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
        await bot.sendMessage(
          chatId,
          `✅ You are now following all *Top ${traders.length}* traders\\.\n\nYou will receive instant alerts\\.`,
          { parse_mode: 'MarkdownV2' }
        );
        return;
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
