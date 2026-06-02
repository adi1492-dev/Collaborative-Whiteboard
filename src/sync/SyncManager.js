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
// CRDTSync will be imported in Phase 4

export class SyncManager {
  constructor(app, boardId, canvasManager) {
    this.app = app;
    this.boardId = boardId;
    this.cm = canvasManager;
    this.em = canvasManager.elementManager;
    this.userId = app.auth.getUser().id;

    // Lamport logical clock for LWW
    this.localClock = Date.now(); 

    // Auto-Save Queue
    this.dirtyElements = new Map();
    this.autoSaveInterval = setInterval(() => this._processAutoSave(), 1000);

    // Setup WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = process.env.NODE_ENV === 'production' ? window.location.host : 'localhost:3001';
    const url = `${wsProtocol}//${wsHost}/ws/board/${boardId}`;
    
    this.ws = new WebSocketClient(url, () => this.app.auth.getAccessToken());
    
    // Setup Presence
    this.presenceSync = new PresenceSync(this.ws, this.cm);

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
      const indicator = document.getElementById('latency-indicator');
      if (indicator) {
        indicator.className = 'status-dot status-red';
        indicator.title = 'Disconnected (Reconnecting...)';
      }
    });

    // Element Operations
    this.ws.on('element_create', this._onRemoteCreate.bind(this));
    this.ws.on('element_update', this._onRemoteUpdate.bind(this));
    this.ws.on('element_delete', this._onRemoteDelete.bind(this));
  }

  // --- Outgoing (Local -> Remote) ---

  broadcastCreate(element) {
    element.updatedAt = this._tickClock();
    const json = element.toJSON();
    this.ws.send('element_create', json);
    this.dirtyElements.set(element.id, json);
  }

  broadcastUpdate(element) {
    element.updatedAt = this._tickClock();
    const json = element.toJSON();
    this.ws.send('element_update', json);
    this.dirtyElements.set(element.id, json);
  }

  broadcastDelete(elementId) {
    this.ws.send('element_delete', { 
      elementId,
      updatedAt: this._tickClock() 
    });
    this.dirtyElements.delete(elementId);
  }

  // --- Bulk Save (HTTP) ---

  async forceSave() {
    if (this.dirtyElements.size === 0) return true;
    
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

  _processAutoSave() {
    if (this.dirtyElements.size > 0) {
      this.forceSave();
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
    }
  }

  _onRemoteUpdate(msg) {
    const remoteEl = msg.payload;
    this._tickClock(remoteEl.updatedAt);

    const localEl = this.em.elements.get(remoteEl.id);

    if (!localEl) {
      // We don't have it, treat as create
      const hydratedEl = this._hydrateElement(remoteEl);
      if (hydratedEl) this.em.setElement(hydratedEl);
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
    }
  }

  _onRemoteDelete(msg) {
    this._tickClock(msg.payload.updatedAt);
    this.em.removeElement(msg.payload.elementId);
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
    clearInterval(this.autoSaveInterval);
    if (this.dirtyElements.size > 0) {
      this.forceSave(); // Fire and forget with keepalive:true
    }
    this.ws.disconnect();
  }
}
