/**
 * SyncManager — Bridges the ElementManager and WebSocketClient.
 * Handles element CRUD operations over the network using Lamport timestamps
 * for Last-Writer-Wins (LWW) conflict resolution.
 */
import { PresenceSync } from './PresenceSync.js';
import { WebSocketClient } from './WebSocketClient.js';
import { FreehandElement } from '../elements/FreehandElement.js';
import { ShapeElement } from '../elements/ShapeElement.js';
import { StickyNote } from '../elements/StickyNote.js';
import { TextElement } from '../elements/TextElement.js';
import { ImageElement } from '../elements/ImageElement.js';
import { Element } from '../elements/Element.js';
import { WebRTCManager } from './WebRTCManager.js';

export class SyncManager {
  constructor(app, boardId, canvasManager) {
    this.app = app;
    this.boardId = boardId;
    this.cm = canvasManager;
    this.em = canvasManager.elementManager;
    const user = app.auth.getUser();
    this.userId = user ? (user.id || user.$id || user.uid || user._id) : null;

    // Lamport logical clock for LWW
    this.localClock = Date.now();

    // Auto-Save Queue
    this.dirtyElements = new Map();

    // Setup WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const url = `${wsProtocol}//${wsHost}/ws/board/${boardId}`;

    this.ws = new WebSocketClient(url, () => this.app.auth.getAccessToken());

    // P2P Manager
    this.p2p = new WebRTCManager(this, this.ws, this.ws.clientId);

    // Setup Presence
    this.presenceSync = new PresenceSync(this.ws, this.cm, this.p2p);

    // Host status for saving
    this.isHost = false;

    // Track unique users for accurate UI peer count
    this.activeUsers = new Map();

    // BUG-003 fix: Track recently forwarded deletes to avoid echo loops
    this._recentlyForwardedDeletes = new Set();

    this._bindEvents();
    this.ws.connect();
  }

  get uniqueUserCount() {
    return this.activeUsers.size;
  }

  _tickClock(remoteTimestamp = 0) {
    this.localClock = Math.max(this.localClock, remoteTimestamp, Date.now()) + 1;
    return this.localClock;
  }

  _bindEvents() {
    this.ws.on('connected', () => {
      // Request full sync on connection/reconnection
      this.ws.send('sync_request');

      const indicator = document.getElementById('latency-indicator');
      if (indicator) {
        indicator.className = 'status-dot status-green';
        indicator.title = 'Connected';
      }
    });

    this.ws.on('disconnected', () => {
      this.isHost = false;
      this.activeUsers.clear();
      this._updateHostUI();

      const indicator = document.getElementById('latency-indicator');
      if (indicator) {
        indicator.className = 'status-dot status-yellow';
        indicator.title = 'Offline (Local Mode — saves still work)';
      }

      // In offline/solo mode, this client is implicitly the "host" for saving
      setTimeout(() => {
        if (!this.isHost) {
          this.isHost = true;
          this._updateHostUI();
        }
      }, 3000);
    });

    // Handle host assignment
    this.ws.on('host_assigned', () => {
      console.log('[SyncManager] Received host_assigned! This client is now the designated room host.');
      this.isHost = true;
      this._updateHostUI();
    });

    // Track active users — guard against counting ourselves
    this.ws.on('peer_joined', (msg) => {
      // Skip if this is our own join event (server now only sends to others,
      // but keep this guard as a safety net)
      if (msg.userId === this.userId || msg.clientId === this.ws.clientId) return;

      if (!this.activeUsers.has(msg.userId)) {
        this.activeUsers.set(msg.userId, new Set());
      }
      this.activeUsers.get(msg.userId).add(msg.clientId);
    });

    this.ws.on('peer_left', (msg) => {
      if (this.activeUsers.has(msg.userId)) {
        this.activeUsers.get(msg.userId).delete(msg.clientId);
        if (this.activeUsers.get(msg.userId).size === 0) {
          this.activeUsers.delete(msg.userId);
        }
      }
    });

    // Handle room_state: server sends existing members when we first join.
    // This ensures we know about users who were ALREADY in the room.
    this.ws.on('room_state', (msg) => {
      const members = msg.payload?.members || [];
      for (const member of members) {
        // Skip if this entry is for ourselves
        if (member.userId === this.userId || member.clientId === this.ws.clientId) continue;
        if (!this.activeUsers.has(member.userId)) {
          this.activeUsers.set(member.userId, new Set());
        }
        this.activeUsers.get(member.userId).add(member.clientId);
      }
      // Trigger presence bar update if a callback exists
      if (this._onPresenceUpdate) this._onPresenceUpdate();
    });

    // Element Operations (fallback or initial sync from server)
    // Most realtime drawing will now come from P2P WebRTC data channels
    this.ws.on('element_create', this._onRemoteCreate.bind(this));
    this.ws.on('element_update', this._onRemoteUpdate.bind(this));
    this.ws.on('element_delete', this._onRemoteDelete.bind(this));
  }

  // --- Outgoing (Local -> Remote P2P) ---

  broadcastCreate(element) {
    element.updatedAt = this._tickClock();
    const json = element.toJSON();
    this.p2p.broadcast('element_create', json); // P2P
    this.dirtyElements.set(element.id, json);
    this._scheduleAutoSave();
  }

  broadcastUpdate(element) {
    element.updatedAt = this._tickClock();
    const json = element.toJSON();
    this.p2p.broadcast('element_update', json); // P2P
    this.dirtyElements.set(element.id, json);
    this._scheduleAutoSave();
  }

  broadcastDelete(elementId) {
    this.p2p.broadcast('element_delete', { // P2P
      elementId,
      updatedAt: this._tickClock()
    });
    // BUG-003 fix: host sends to server but tracks it to avoid echo processing
    if (this.isHost) {
      this._recentlyForwardedDeletes.add(elementId);
      setTimeout(() => this._recentlyForwardedDeletes.delete(elementId), 5000);
      this.ws.send('element_delete', { elementId });
    }
    this.dirtyElements.delete(elementId);
    // BUG-018 fix: only schedule save if there is still something to save
    if (this.dirtyElements.size > 0) {
      this._scheduleAutoSave();
    }
  }

  _scheduleAutoSave() {
    // Only the Host is allowed to auto-save to the backend!
    if (!this.isHost) return;

    // BUG-009 fix: use consistent timer name 'autoSaveTimer'
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = setTimeout(() => {
      if (this.onSaveTriggered && this.dirtyElements.size > 0) {
        this.onSaveTriggered();
      }
    }, 500); // 500ms debounce
  }

  _updateHostUI() {
    const titleGroup = document.querySelector('.board-title-group');
    let hostBadge = document.getElementById('host-badge');
    if (this.isHost) {
      if (!hostBadge && titleGroup) {
        hostBadge = document.createElement('div');
        hostBadge.id = 'host-badge';
        hostBadge.className = 'badge';
        hostBadge.style.cssText = 'background: rgba(234, 179, 8, 0.2); color: #eab308; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-left: 8px;';
        hostBadge.innerHTML = '👑 HOST';
        titleGroup.appendChild(hostBadge);
      }
    } else if (hostBadge) {
      hostBadge.remove();
    }
  }

  // --- Bulk Save (HTTP) ---

  async forceSave() {
    // Prevent non-hosts from saving to DB to save costs and avoid conflicts
    if (!this.isHost) {
      console.log('[SyncManager] Save request ignored: client is not the room host.');
      return true;
    }

    if (this.dirtyElements.size === 0) {
      console.log('[SyncManager] Save skipped: no dirty elements to sync.');
      return true;
    }

    console.log(`[SyncManager] Saving ${this.dirtyElements.size} dirty elements to database...`);

    const elementsToSave = Array.from(this.dirtyElements.values());
    this.dirtyElements.clear(); // Clear immediately so new edits can be queued

    try {
      const res = await this.app.auth.apiFetch(`/api/boards/${this.boardId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements: elementsToSave }),
        keepalive: true
      });

      if (!res.ok) {
        console.error('Auto-save failed, re-queueing elements');
        elementsToSave.forEach(el => {
          if (!this.dirtyElements.has(el.id)) {
            this.dirtyElements.set(el.id, el);
          }
        });
        return false;
      }
      return true;
    } catch (err) {
      console.error('Auto-save error:', err);
      elementsToSave.forEach(el => {
        if (!this.dirtyElements.has(el.id)) {
          this.dirtyElements.set(el.id, el);
        }
      });
      return false;
    }
  }

  // --- Incoming (Remote -> Local) ---

  _onRemoteCreate(msg) {
    const remoteEl = msg.payload;
    this._tickClock(remoteEl.updatedAt);

    // Instantiate correct class based on type
    const hydratedEl = this._hydrateElement(remoteEl);
    if (hydratedEl) {
      this.em.setElement(hydratedEl);
      if (this.isHost) {
        this.dirtyElements.set(hydratedEl.id, remoteEl);
        this._scheduleAutoSave();
      }
    }
  }

  _onRemoteUpdate(msg) {
    const remoteEl = msg.payload;
    this._tickClock(remoteEl.updatedAt);

    const localEl = this.em.elements.get(remoteEl.id);

    if (!localEl) {
      // We don't have it, treat as create
      const hydratedEl = this._hydrateElement(remoteEl);
      if (hydratedEl) {
        this.em.setElement(hydratedEl);
        if (this.isHost) {
          this.dirtyElements.set(hydratedEl.id, remoteEl);
          this._scheduleAutoSave();
        }
      }
      return;
    }

    // Property-level Last-Writer-Wins (LWW) conflict resolution
    if (remoteEl.updatedAt > localEl.updatedAt) {
      // Merge properties
      localEl.x = remoteEl.x;
      localEl.y = remoteEl.y;
      localEl.width = remoteEl.width;
      localEl.height = remoteEl.height;
      localEl.rotation = remoteEl.rotation;
      localEl.zIndex = remoteEl.zIndex;
      localEl.style = { ...remoteEl.style };

      // Type-specific properties
      if (remoteEl.type === 'sticky' || remoteEl.type === 'text') {
        localEl.text = remoteEl.text;
      } else if (remoteEl.type === 'freehand') {
        localEl.points = remoteEl.points;
      } else if (remoteEl.type === 'image' && remoteEl.src !== localEl.src) {
        // Re-load image if src changed (e.g. replaced image)
        localEl.src = remoteEl.src;
        localEl._loadImage && localEl._loadImage();
      }

      localEl.updatedAt = remoteEl.updatedAt;
      this.cm.requestStaticRender();

      if (this.isHost) {
        this.dirtyElements.set(localEl.id, remoteEl);
        this._scheduleAutoSave();
      }
    }
  }

  _onRemoteDelete(msg) {
    const elementId = msg.payload?.elementId;
    if (!elementId) return; // Guard: malformed message
    this._tickClock(msg.payload.updatedAt || 0);
    this.em.removeElement(elementId);

    // BUG-003 fix: Only forward to WS server if this wasn't one we just sent
    // to avoid the echo loop where server broadcasts back to us
    if (this.isHost && !this._recentlyForwardedDeletes.has(elementId)) {
      this._recentlyForwardedDeletes.add(elementId);
      setTimeout(() => this._recentlyForwardedDeletes.delete(elementId), 5000);
      this.ws.send('element_delete', { elementId });
    }
  }

  _hydrateElement(data) {
    if (!data || !data.type) return null;
    switch (data.type) {
      case 'freehand':
        return new FreehandElement(data);
      case 'shape':
        return new ShapeElement(data);
      case 'sticky':
        return new StickyNote(data);
      case 'text':
        return new TextElement(data);
      case 'image':
        return new ImageElement(data);
      default:
        console.warn('[SyncManager] Unknown element type:', data.type);
        return null; // Reject unknown types rather than creating a broken base Element
    }
  }

  // BUG-001 fix: single unified destroy() method
  destroy() {
    // BUG-009 fix: use correct timer variable name
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    if (this.isHost && this.dirtyElements.size > 0) {
      this.forceSave(); // Fire and forget with keepalive:true
    }
    if (this.p2p) this.p2p.destroy();
    try { this.ws.disconnect(); } catch (_) {}
  }
}
