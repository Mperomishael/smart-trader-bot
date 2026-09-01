const WebSocket = require('ws');
const { HYPERLIQUID_WS_URL } = require('../config');

// Subscribes to real-time `userFills` for a list of trader addresses and
// invokes onFill(fill, traderAddress) for each new fill. Handles reconnects
// with backoff and re-subscribes on reconnect.
class FillListener {
  constructor(addresses, onFill) {
    this.addresses = addresses;
    this.onFill = onFill;
    this.ws = null;
    this.reconnectDelayMs = 1000;
    this.pingInterval = null;
  }

  start() {
    this._connect();
  }

  stop() {
    clearInterval(this.pingInterval);
    if (this.ws) this.ws.close();
  }

  // Call when the tracked trader list changes (e.g. after a leaderboard
  // refresh) to re-subscribe without a full reconnect.
  updateAddresses(addresses) {
    const added = addresses.filter((a) => !this.addresses.includes(a));
    const removed = this.addresses.filter((a) => !addresses.includes(a));
    this.addresses = addresses;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      added.forEach((a) => this._subscribe(a));
      removed.forEach((a) => this._unsubscribe(a));
    }
  }

  _connect() {
    console.log(`[hyperliquid-ws] connecting to ${HYPERLIQUID_WS_URL}`);
    this.ws = new WebSocket(HYPERLIQUID_WS_URL);

    this.ws.on('open', () => {
      console.log(`[hyperliquid-ws] connected, subscribing to ${this.addresses.length} traders`);
      this.reconnectDelayMs = 1000;
      this.addresses.forEach((a) => this._subscribe(a));
      this.pingInterval = setInterval(() => {
        if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ method: 'ping' }));
      }, 30000);
    });

    this.ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.channel !== 'userFills' || !msg.data) return;
      const { user, fills } = msg.data;
      for (const fill of fills || []) {
        this.onFill(fill, user);
      }
    });

    this.ws.on('close', () => {
      console.warn('[hyperliquid-ws] disconnected, reconnecting...');
      clearInterval(this.pingInterval);
      setTimeout(() => this._connect(), this.reconnectDelayMs);
      this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 30000);
    });

    this.ws.on('error', (err) => {
      console.error('[hyperliquid-ws] error:', err.message);
    });
  }

  _subscribe(address) {
    this.ws.send(
      JSON.stringify({ method: 'subscribe', subscription: { type: 'userFills', user: address } })
    );
  }

  _unsubscribe(address) {
    this.ws.send(
      JSON.stringify({ method: 'unsubscribe', subscription: { type: 'userFills', user: address } })
    );
  }
}

module.exports = { FillListener };
