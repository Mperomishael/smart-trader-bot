// ========== LIVE SIGNALS ==========
bot.onText(/🔥 Live Signals|\/signals/, async (msg) => {
  const traders = await db.getActiveTraders();

  if (!traders.length) {
    return bot.sendMessage(msg.chat.id, 
      'No traders are being tracked yet.\nPlease wait a moment and try again.',
      mainMenu
    );
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
