# Smart Trader Alert Bot

Telegram bot that alerts on real trades by proven profitable Hyperliquid
traders — opens, closes, increases, flips — not raw whale wallet transfers.

## How it works

1. **Trader selection** (`src/hyperliquid/leaderboard.js`): pulls Hyperliquid's
   public leaderboard feed, filters candidates by 30D PnL and account value,
   then computes a real win rate per candidate from their closed fills
   (`closedPnl` on `userFills`). Traders clearing all three bars get tracked.
2. **Live fills** (`src/hyperliquid/fillListener.js`): one WebSocket
   connection subscribed to Hyperliquid's `userFills` channel for every
   tracked trader — pushed in real time, no polling.
3. **Position state** (`src/alertEngine.js` + `open_positions` table): each
   open fill is recorded so that when a close fill arrives we know the entry
   price and how long the position was held.
4. **Alerts**: formatted to match your spec (`src/telegram/formatAlert.js`)
   and broadcast to every Telegram chat following that coin.
5. **Refresh loop**: the trader list re-pulls on an interval (default 30 min)
   so the bot naturally drops traders who stop performing and picks up new
   ones — no manual curation needed.

## Setup

1. Create a Supabase project, then run `schema.sql` in the SQL editor.
2. Create a Telegram bot via [@BotFather](https://t.me/BotFather), grab the token.
3. Copy `.env.example` to `.env` and fill in `TELEGRAM_BOT_TOKEN`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
4. `npm install`
5. `npm run refresh-traders` — does the first leaderboard pull so the bot has
   traders to track on boot (this can take a minute or two: it fetches fills
   for every candidate to compute win rate).
6. `npm start`

## Telegram commands

- `/follow BTC` — get alerts for a coin
- `/unfollow BTC` — stop
- `/following` — list your active coins
- `/traders` — see who's currently tracked, ranked by 30D PnL

## Deploy (Railway)

1. Push this folder to a GitHub repo.
2. New Railway project → Deploy from repo.
3. Add the same env vars from `.env.example` in Railway's Variables tab.
4. Start command: `npm start` (Railway auto-detects this from `package.json`).
5. The trader-refresh loop runs inside the same process — no separate cron
   job needed, though you can also run `npm run refresh-traders` as a
   one-off Railway job if you want to seed traders before first boot.

## Known MVP simplifications (worth knowing before you rely on this)

- **Entry price on partial fills**: `open_positions` is overwritten on every
  "Open" fill, not volume-weighted. If a trader scales into a position across
  several fills, the recorded entry price is the *last* open fill's price,
  not the true average. Fine for MVP; flag if you want weighted averaging.
- **Win rate** only counts closed fills with nonzero `closedPnl`, over
  whatever history `userFills` returns (Hyperliquid caps this at the most
  recent ~2,000 fills). It's a good profitability signal, not a certified stat.
- **Leaderboard endpoint** (`stats-data.hyperliquid.xyz`) is the same feed
  Hyperliquid's own web UI uses, but it's undocumented and could change
  shape without notice — `leaderboard.js` is the one place to patch if so.
- **Flip fills** ("Long > Short" in one fill) are handled as a synthetic
  close + open, sent as two alerts.
