/**
 * WebSocketClient — Handles the raw WebSocket connection, reconnection logic,
 * and JSON parsing. Event emitter pattern for decoupled message handling.
 */
export class WebSocketClient {
  constructor(url, tokenGetter) {
    this.baseUrl = url;
    this.tokenGetter = tokenGetter;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.baseReconnectDelay = 1000;
    this.listeners = new Map();
    this.isConnected = false;
    this.isConnecting = false;
    this.intentionallyClosed = false;
  }

  connect() {
    if (this.isConnected || this.isConnecting) return;
    
    this.isConnecting = true;
    this.intentionallyClosed = false;
    
    try {
      const token = typeof this.tokenGetter === 'function' ? this.tokenGetter() : this.tokenGetter;
      const url = `${this.baseUrl}?token=${encodeURIComponent(token)}`;
      this.ws = new WebSocket(url);
      
      this.ws.onopen = this._onOpen.bind(this);
      this.ws.onmessage = this._onMessage.bind(this);
      this.ws.onclose = this._onClose.bind(this);
      this.ws.onerror = this._onError.bind(this);
    } catch (err) {
      console.error('WebSocket connection failed:', err);
      this.isConnecting = false;
      this._scheduleReconnect();
    }
  }

  disconnect() {
    this.intentionallyClosed = true;
    if (this.ws) {
      const socket = this.ws;
      this.ws = null; // Detach immediately
      
      // Allow 150ms for the OS to flush any remaining packets in the TCP buffer
      setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      }, 150);
    }
    this.isConnected = false;
    this.isConnecting = false;
  }

  send(type, payload = {}) {
    if (!this.isConnected || !this.ws) {
      console.warn(`Cannot send message of type ${type}: WebSocket not connected`);
      return false;
    }

    const msg = { type, payload };
    try {
      this.ws.send(JSON.stringify(msg));
      return true;
    } catch (err) {
      console.error('Failed to send WebSocket message:', err);
      return false;
    }
  }

  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(callback);
  }

  off(type, callback) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).delete(callback);
    }
  }

  _emit(type, data) {
    if (this.listeners.has(type)) {
      for (const callback of this.listeners.get(type)) {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in WebSocket event listener for ${type}:`, err);
        }
      }
    }
  }

  _onOpen() {
    console.log('WebSocket connected');
    this.isConnected = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this._emit('connected', null);
  }

  _onMessage(event) {
    try {
      const msg = JSON.parse(event.data);
      if (msg && msg.type) {
        // msg includes: type, payload, userId, userName, timestamp
        this._emit(msg.type, msg);
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  }

  _onClose(event) {
    this.isConnected = false;
    this.isConnecting = false;
    this.ws = null;
    
    this._emit('disconnected', event);
    
    if (!this.intentionallyClosed) {
      this._scheduleReconnect();
    }
  }

  _onError(event) {
    console.error('WebSocket error:', event);
    // onclose will be called after this
  }

  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max WebSocket reconnect attempts reached');
      this._emit('reconnect_failed', null);
      return;
    }

    const delay = this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts);
    // Add jitter (±20%)
    const jitter = delay * 0.4 * (Math.random() - 0.5);
    const finalDelay = Math.min(delay + jitter, 30000); // Max 30s delay

    this.reconnectAttempts++;
    console.log(`Scheduling reconnect in ${Math.round(finalDelay)}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, finalDelay);
  }
}
