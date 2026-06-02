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
import { Element } from '../elements/Element.js';
import { WebRTCManager } from './WebRTCManager.js';
// CRDTSync will be imported in Phase 4

export class SyncManager {
  constructor(app, boardId, canvasManager) {
    this.app = app;
    this.boardId = boardId;
    this.cm = canvasManager;
    this.em = canvasManager.elementManager;
    const user = app.auth.getUser();
    this.userId = user ? (user.id || user._id) : null;

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

    this._bindEvents();
    this.ws.connect();
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
      this._updateHostUI();
      
      const indicator = document.getElementById('latency-indicator');
      if (indicator) {
        indicator.className = 'status-dot status-red';
        indicator.title = 'Disconnected (Reconnecting...)';
      }
    });

    // Handle host assignment
    this.ws.on('host_assigned', () => {
      console.log("[SyncManager] Received host_assigned! This client is now the designated room host.");
      this.isHost = true;
      this._updateHostUI();
    });

    // Also check initial user list for host status
    this.ws.on('peer_joined', () => {
      // If we are the only one in the room (before others join), we should be host.
      // But server assigns it, so we'll wait for user_list or assume it from the server.
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
    if (this.isHost) {
      this.ws.send('element_delete', { elementId });
    }
    this.dirtyElements.delete(elementId);
    this._scheduleAutoSave();
  }

  _scheduleAutoSave() {
    // Only the Host is allowed to auto-save to the backend!
    if (!this.isHost) return;

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
      console.log("[SyncManager] Save request ignored: client is not the room host.");
      return true;
    }

    if (this.dirtyElements.size === 0) {
      console.log("[SyncManager] Save skipped: no dirty elements to sync.");
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
    this._tickClock(msg.payload.updatedAt);
    this.em.removeElement(msg.payload.elementId);
    if (this.isHost) {
      this.ws.send('element_delete', { elementId: msg.payload.elementId });
    }
  }

  _hydrateElement(data) {
    switch (data.type) {
      case 'freehand':
        return new FreehandElement(data);
      case 'shape':
        return new ShapeElement(data);
      case 'sticky':
        return new StickyNote(data);
      case 'text':
        return new TextElement(data);
      default:
        return new Element(data);
    }
  }

  destroy() {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    if (this.isHost && this.dirtyElements.size > 0) {
      this.forceSave(); // Fire and forget with keepalive:true
    }
    if (this.p2p) this.p2p.destroy();
    this.ws.disconnect();
  }
}
