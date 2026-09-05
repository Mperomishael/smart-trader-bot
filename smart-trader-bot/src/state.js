// Tiny shared mutable state, updated by index.js and fillListener.js,
// read by the bot's /status command. Not persisted — resets on restart,
// which is fine since it only reflects the current process's health.
module.exports = {
  startedAt: Date.now(),
  wsConnected: false,
  lastRefreshAt: null,
  trackedCount: 0,
};

