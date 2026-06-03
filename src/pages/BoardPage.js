/**
 * BoardPage — The main whiteboard workspace.
 * Production-ready: presence avatars, zoom controls, export, undo/redo,
 * inline title editing, context menu, text editing, export.
 */
import { CanvasManager } from '../canvas/CanvasManager.js';
import { ElementManager } from '../elements/ElementManager.js';
import { InputHandler } from '../canvas/InputHandler.js';
import { SyncManager } from '../sync/SyncManager.js';
import { Toolbar } from '../ui/Toolbar.js';
import { PropertyPanel } from '../ui/PropertyPanel.js';
import { TextEditor } from '../ui/TextEditor.js';
import { ContextMenu } from '../ui/ContextMenu.js';
import { CommandPalette } from '../ui/CommandPalette.js';
import { TemplateEngine } from '../plugins/templates/TemplateEngine.js';
import { AIManager } from '../ai/AIManager.js';
import { HistoryManager } from '../history/HistoryManager.js';
import { ExportManager } from '../export/ExportManager.js';
import { Toast } from '../ui/Toast.js';

// Tools
import { SelectTool } from '../tools/SelectTool.js';
import { PenTool } from '../tools/PenTool.js';
import { ShapeTool } from '../tools/ShapeTool.js';
import { StickyTool } from '../tools/StickyTool.js';
import { TextTool } from '../tools/TextTool.js';
import { EraserTool } from '../tools/EraserTool.js';
import { ImageTool } from '../tools/ImageTool.js';
import { Tool } from '../tools/Tool.js';

class PanTool extends Tool {
  constructor() { super('pan'); }
  onActivate() { this.cm.container.style.cursor = 'grab'; }
  onDeactivate() { this.cm.container.style.cursor = 'default'; }
  onPointerDown(pt, e) { this.cm.container.style.cursor = 'grabbing'; }
  onPointerUp(pt, e) { this.cm.container.style.cursor = 'grab'; }
  onPointerMove(pt, e) {
    if (e.buttons === 1) {
      this.cm.transform.panBy(e.movementX, e.movementY);
      this.cm.requestStaticRender();
    }
  }
}

export class BoardPage {
  constructor(root, app, boardId) {
    this.root = root;
    this.app = app;
    this.boardId = boardId;
    this.boardData = null;
    this.render();
  }

  async render() {
    this.root.innerHTML = `
      <div class="board-layout">
        <header class="board-header glass" id="board-header">
          <div class="header-left">
            <a href="#/dashboard" class="icon-btn" aria-label="Back to dashboard" title="Dashboard">
              <span class="material-symbols-outlined">arrow_back</span>
            </a>
            <div class="board-title-group">
              <h1 class="headline-sm truncate board-title-editable" id="board-title" 
                  style="font-size:16px;cursor:text;padding:2px 6px;border-radius:4px;max-width:220px;"
                  title="Click to rename">Loading...</h1>
              <div id="latency-indicator" class="status-dot status-yellow" title="Connecting..."></div>
              <div id="peer-count" class="peer-count-badge" style="display:none;" title="Connected peers">
                <span class="material-symbols-outlined" style="font-size:12px">lan</span>
                <span id="peer-count-num">0</span>
              </div>
            </div>
            <!-- Room Key for owner -->
            <div id="room-key-display" style="display:none;align-items:center;background:rgba(192,193,255,0.1);padding:4px 10px;border-radius:16px;margin-left:12px;border:1px solid rgba(192,193,255,0.2);gap:6px;">
              <span class="material-symbols-outlined" style="font-size:13px;color:var(--primary)">key</span>
              <span class="label-sm" style="color:var(--primary);font-family:monospace;letter-spacing:2px;font-size:13px" id="room-key-text">------</span>
              <span class="label-sm" style="color:var(--on-surface-variant);font-size:10px" id="room-key-timer">(60s)</span>
              <button id="copy-key-btn" class="icon-btn" style="width:22px;height:22px;margin-left:2px;" title="Copy invite link">
                <span class="material-symbols-outlined" style="font-size:14px">content_copy</span>
              </button>
            </div>
          </div>

          <div class="header-center">
            <!-- Undo / Redo -->
            <button class="icon-btn" id="undo-btn" title="Undo (Ctrl+Z)" disabled>
              <span class="material-symbols-outlined">undo</span>
            </button>
            <button class="icon-btn" id="redo-btn" title="Redo (Ctrl+Y)" disabled>
              <span class="material-symbols-outlined">redo</span>
            </button>
            <!-- Zoom controls -->
            <div class="zoom-controls">
              <button class="icon-btn" id="zoom-out-btn" title="Zoom out">
                <span class="material-symbols-outlined">remove</span>
              </button>
              <span id="zoom-display" style="font-size:12px;min-width:42px;text-align:center;font-family:var(--font-mono);color:var(--on-surface-variant)">100%</span>
              <button class="icon-btn" id="zoom-in-btn" title="Zoom in">
                <span class="material-symbols-outlined">add</span>
              </button>
              <button class="icon-btn" id="zoom-reset-btn" title="Reset zoom (fit board)">
                <span class="material-symbols-outlined">fit_screen</span>
              </button>
            </div>
          </div>

          <div class="header-right">
            <!-- Presence avatars -->
            <div id="presence-bar" class="presence-bar"></div>
            
            <!-- AI Assist -->
            <button class="btn btn-ghost ai-assist-btn" id="ai-assist-btn" style="color:var(--tertiary);padding:6px 12px;height:auto;">
              <span class="material-symbols-outlined" style="font-size:16px;margin-right:4px;">auto_awesome</span>AI
            </button>

            <!-- Templates -->
            <button class="btn btn-outline" id="templates-btn" style="padding:6px 12px;height:auto;">
              <span class="material-symbols-outlined" style="font-size:16px;margin-right:4px;">view_cozy</span>Templates
            </button>

            <!-- Export -->
            <button class="btn btn-outline" id="export-btn" style="padding:6px 12px;height:auto;">
              <span class="material-symbols-outlined" style="font-size:16px">download</span>Export
            </button>

            <!-- Manage Collaborators (Owner Only) -->
            <button class="btn btn-outline" id="manage-collabs-btn" style="display:none;padding:6px 12px;height:auto;gap:4px;">
              <span class="material-symbols-outlined" style="font-size:16px">group</span>Collaborators
            </button>

            <!-- Save -->
            <button class="btn btn-primary" id="manual-save-btn" style="padding:6px 12px;height:auto;">
              <span class="material-symbols-outlined" style="font-size:16px">save</span>
              <span id="save-btn-text">Save</span>
            </button>
          </div>
        </header>

        <div class="board-workspace">
          <div id="canvas-container" class="canvas-container"></div>
          <div id="ui-container" class="ui-container"></div>
        </div>
      </div>
    `;

    this._injectStyles();

    try {
      const res = await this.app.auth.apiFetch(`/api/boards/${this.boardId}`);
      if (!res.ok) throw new Error('Board not found');
      const data = await res.json();
      this.boardData = data.board;
      this.root.querySelector('#board-title').textContent = this.boardData.title;
      this._initEngine(data.elements || []);
      this._initRoomKey();
      this._initTitleEditing();
    } catch (err) {
      console.error('Failed to load board:', err);
      alert('Failed to load board: ' + err.message);
      this.app.navigate('/dashboard');
    }
  }

  _initEngine(initialElements) {
    const canvasContainer = this.root.querySelector('#canvas-container');
    const uiContainer = this.root.querySelector('#ui-container');
    if (!canvasContainer) return;

    // 1. Canvas Manager
    this.cm = new CanvasManager(canvasContainer, this.boardId);
    this.cm.setBackground(this.boardData.background);

    // 2. Element Manager
    this.em = new ElementManager(this.cm);
    this.cm.elementManager = this.em;

    // 3. Input Handler
    this.ih = new InputHandler(this.cm, this.em);
    this.cm.inputHandler = this.ih;

    // 4. History Manager
    this.history = new HistoryManager();
    this.cm.historyManager = this.history;
    this.ih.historyManager = this.history;

    // 5. Register Tools
    this.ih.registerTool('select', new SelectTool());
    this.ih.registerTool('pan', new PanTool());
    this.ih.registerTool('pen', new PenTool());
    this.ih.registerTool('rectangle', new ShapeTool('rectangle'));
    this.ih.registerTool('ellipse', new ShapeTool('ellipse'));
    this.ih.registerTool('triangle', new ShapeTool('triangle'));
    this.ih.registerTool('diamond', new ShapeTool('diamond'));
    this.ih.registerTool('star', new ShapeTool('star'));
    this.ih.registerTool('polygon', new ShapeTool('polygon'));
    this.ih.registerTool('line', new ShapeTool('line'));
    this.ih.registerTool('arrow', new ShapeTool('arrow'));
    this.ih.registerTool('sticky', new StickyTool());
    this.ih.registerTool('text', new TextTool());
    this.ih.registerTool('eraser', new EraserTool());
    this.ih.registerTool('image', new ImageTool());
    
    this.ih.setActiveTool('select');

    // 6. Sync Layer
    this.sync = new SyncManager(this.app, this.boardId, this.cm);
    this.cm.syncManager = this.sync;

    // 7. Text Editor
    this.textEditor = new TextEditor(this.cm);
    this.cm.textEditor = this.textEditor;

    // 8. Context Menu
    this.contextMenu = new ContextMenu(this.em, this.sync, this.history);
    this.ih.contextMenu = this.contextMenu;

    // 9. Export Manager
    this.exportMgr = new ExportManager(this.cm, this.em);

    // 10. Toolbar & Property Panel
    this.toolbar = new Toolbar(uiContainer, this.ih);
    this.propertyPanel = new PropertyPanel(uiContainer, this.ih, this.em, this.sync);

    // 11. AI Manager
    this.ai = new AIManager(this.app, this);
    this.root.querySelector('#ai-assist-btn')?.addEventListener('click', () => {
      this.ai.summarizeBoard();
    });

    // 11.5 Command Palette
    this.commandPalette = new CommandPalette(this, this.ih, this.cm);

    // 11.6 Template Engine
    this.templateEngine = new TemplateEngine(this);
    this.root.querySelector('#templates-btn')?.addEventListener('click', () => {
      this.templateEngine.open();
    });

    // Dynamic property panel
    const originalSetActive = this.ih.setActiveTool.bind(this.ih);
    this.ih.setActiveTool = (toolId) => {
      originalSetActive(toolId);
      if (toolId === 'select' && this.em.selectedIds.size > 0) {
        this.propertyPanel.show();
      } else if (toolId !== 'select' && toolId !== 'pan' && toolId !== 'eraser') {
        this.propertyPanel.show();
      } else {
        this.propertyPanel.hide();
      }
    };

    const originalSelect = this.em.select.bind(this.em);
    this.em.select = (id, add) => {
      originalSelect(id, add);
      if (this.ih.activeTool?.name === 'select') this.propertyPanel.show();
    };

    const originalClear = this.em.clearSelection.bind(this.em);
    this.em.clearSelection = () => {
      originalClear();
      if (this.ih.activeTool?.name === 'select') this.propertyPanel.hide();
    };

    // 12. Connection status
    const statusDot = this.root.querySelector('#latency-indicator');
    if (statusDot) {
      this.sync.ws.on('connected', () => {
        statusDot.className = 'status-dot status-green';
        statusDot.title = 'Online & Synced';
      });
      this.sync.ws.on('disconnected', () => {
        statusDot.className = 'status-dot status-red';
        statusDot.title = 'Offline (Reconnecting...)';
      });
    }

    // 13. Presence avatars & peer toasts
    this.sync.ws.on('peer_joined', (msg) => {
      this._updatePresenceBar();
      if (msg.userName && msg.userId !== this.sync.userId) {
        Toast.show(`${msg.userName} joined the canvas`, 'info', 3000);
      }
      // Update P2P count after a short delay for connection to settle
      setTimeout(() => this._updatePeerCount(), 1500);
    });
    this.sync.ws.on('peer_left', (msg) => {
      this._updatePresenceBar();
      if (msg.userName && msg.userId !== this.sync.userId) {
        Toast.show(`${msg.userName} left the canvas`, 'warning', 3000);
      }
      setTimeout(() => this._updatePeerCount(), 500);
    });

    // 14. Load initial elements
    const hydratedElements = initialElements.map(el => this.sync._hydrateElement(el)).filter(Boolean);
    this.em.setElements(hydratedElements);
    if (hydratedElements.length > 0) {
      setTimeout(() => this.cm.zoomToFit(), 100);
    }

    // 15. Zoom controls
    this._initZoomControls();

    // 16. Save button
    this._initSaveButton();

    // 17. Export button
    this.root.querySelector('#export-btn')?.addEventListener('click', (e) => {
      this.exportMgr.showExportMenu(e.currentTarget, this.boardData?.title);
    });

    // 18. Undo/Redo buttons
    this.root.querySelector('#undo-btn')?.addEventListener('click', () => this.history.undo());
    this.root.querySelector('#redo-btn')?.addEventListener('click', () => this.history.redo());

    // 19. Beforeunload
    this.handleBeforeUnload = () => {
      if (this.sync?.dirtyElements.size > 0) this.sync.forceSave();
    };
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    // P2P count update every 5s
    this._peerCountInterval = setInterval(() => this._updatePeerCount(), 5000);
  }

  _initZoomControls() {
    const updateDisplay = () => {
      const el = document.getElementById('zoom-display');
      if (el) el.textContent = `${Math.round(this.cm.transform.scale * 100)}%`;
    };

    this.root.querySelector('#zoom-in-btn')?.addEventListener('click', () => {
      this.cm.transform.zoom(0.1, this.cm.width / 2, this.cm.height / 2);
      this.cm.requestStaticRender();
      updateDisplay();
    });
    this.root.querySelector('#zoom-out-btn')?.addEventListener('click', () => {
      this.cm.transform.zoom(-0.1, this.cm.width / 2, this.cm.height / 2);
      this.cm.requestStaticRender();
      updateDisplay();
    });
    this.root.querySelector('#zoom-reset-btn')?.addEventListener('click', () => {
      this.cm.zoomToFit();
      updateDisplay();
    });
  }

  _initSaveButton() {
    const saveBtn = this.root.querySelector('#manual-save-btn');
    const saveBtnText = this.root.querySelector('#save-btn-text');
    
    let isSaving = false;
    let saveQueued = false;
    
    const triggerSave = async (isManual = false) => {
      if (!saveBtn) return;
      if (isSaving) { saveQueued = true; return; }
      
      isSaving = true;
      saveBtn.disabled = true;
      saveBtnText.textContent = 'Saving...';
      
      if (isManual) {
        for (const el of this.em.elements.values()) {
          this.sync.dirtyElements.set(el.id, el.toJSON());
        }
      }
      
      const success = await this.sync.forceSave();
      saveBtnText.textContent = success ? 'Saved!' : 'Failed';
      isSaving = false;
      
      if (saveQueued) {
        saveQueued = false;
        triggerSave(false);
      } else {
        setTimeout(() => {
          if (!isSaving && saveBtn) {
            saveBtn.disabled = false;
            saveBtnText.textContent = 'Save';
          }
        }, 1500);
      }
    };

    if (saveBtn) {
      saveBtn.addEventListener('click', () => triggerSave(true));
      this.sync.onSaveTriggered = () => triggerSave(false);
    }
  }

  _initTitleEditing() {
    const titleEl = this.root.querySelector('#board-title');
    if (!titleEl) return;

    titleEl.addEventListener('click', () => {
      const current = titleEl.textContent;
      const input = document.createElement('input');
      input.value = current;
      input.style.cssText = `
        font-size:16px;font-family:inherit;font-weight:inherit;
        background:rgba(255,255,255,0.1);border:1px solid var(--primary);
        border-radius:4px;padding:2px 8px;color:var(--on-surface);
        outline:none;width:${Math.max(120, current.length * 10)}px;
      `;
      titleEl.replaceWith(input);
      input.focus();
      input.select();

      const commit = async () => {
        const newTitle = input.value.trim() || current;
        titleEl.textContent = newTitle;
        input.replaceWith(titleEl);
        if (newTitle !== current) {
          try {
            await this.app.auth.apiFetch(`/api/boards/${this.boardId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: newTitle })
            });
            this.boardData.title = newTitle;
          } catch (err) {
            console.error('Failed to rename board:', err);
          }
        }
      };

      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { input.value = current; commit(); }
      });
    });
  }

  _updatePresenceBar() {
    const bar = this.root.querySelector('#presence-bar');
    if (!bar || !this.sync) return;
    // Presence data comes from WebSocket room user list (simplify: show colors from peers)
    // We'll show a simple avatar for the local user
    const user = this.app.auth.getUser();
    if (!user) return;
    const initials = (user.displayName || user.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const color = '#c0c1ff';
    bar.innerHTML = `
      <div class="presence-avatar" title="${user.displayName || user.name || 'You'} (You)" style="background:${color};">
        ${initials}
      </div>
    `;
  }

  _updatePeerCount() {
    if (!this.sync?.p2p) return;
    const count = this.sync.p2p.connectedPeerCount;
    const badge = document.getElementById('peer-count');
    const num = document.getElementById('peer-count-num');
    if (badge && num) {
      num.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  }

  async _initRoomKey() {
    const user = this.app.auth.getUser();
    if (!user || !this.boardData) return;
    
    const userId = user._id || user.id || '';
    
    // Handle both string IDs (SQLite) and MongoDB ObjectID objects
    const getIdStr = (id) => {
      if (!id) return '';
      if (typeof id === 'string') return id;
      if (id.$oid) return id.$oid;
      return String(id);
    };

    const ownerIdStr = getIdStr(this.boardData.ownerId);
    const userIdStr = getIdStr(userId);

    // Show room key for owner
    const isOwner = ownerIdStr && userIdStr && ownerIdStr === userIdStr;
    if (!isOwner) return;

    const display = this.root.querySelector('#room-key-display');
    const text = this.root.querySelector('#room-key-text');
    const timerLabel = this.root.querySelector('#room-key-timer');
    
    if (display) display.style.display = 'flex';
    
    let secondsLeft = 0;
    
    const refreshKey = async () => {
      try {
        const res = await this.app.auth.apiFetch(`/api/boards/${this.boardId}/key/refresh`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (text) text.textContent = data.roomKey;
          secondsLeft = 60;
        }
      } catch (err) {
        console.error('Failed to refresh room key', err);
      }
    };

    await refreshKey();
    
    if (this.keyTimerInterval) clearInterval(this.keyTimerInterval);
    this.keyTimerInterval = setInterval(() => {
      if (secondsLeft > 0) {
        secondsLeft--;
        if (timerLabel) timerLabel.textContent = `(${secondsLeft}s)`;
        if (secondsLeft === 0) refreshKey();
      }
    }, 1000);
    
    if (this.keyRefreshInterval) clearInterval(this.keyRefreshInterval);
    this.keyRefreshInterval = setInterval(refreshKey, 60000);

    // Copy invite link
    this.root.querySelector('#copy-key-btn')?.addEventListener('click', () => {
      const key = text?.textContent?.trim();
      if (key) {
        const url = `${window.location.origin}${window.location.pathname}#/join/${key}`;
        navigator.clipboard.writeText(url).then(() => {
          Toast.show('Invite link copied to clipboard!', 'success', 2500);
        });
      }
    });

    // Manage Collaborators button logic
    const manageBtn = this.root.querySelector('#manage-collabs-btn');
    if (manageBtn) {
      manageBtn.style.display = 'flex';
      manageBtn.addEventListener('click', () => this._showCollaboratorsModal());
    }
  }

  _showCollaboratorsModal() {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px);';

    const modal = document.createElement('div');
    modal.className = 'modal-content glass';
    modal.style.cssText = 'background:var(--surface);padding:24px;border-radius:12px;width:400px;max-width:90vw;display:flex;flex-direction:column;gap:16px;box-shadow:0 8px 32px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
    header.innerHTML = `
      <h3 style="margin:0;font-size:18px;color:var(--on-surface);">Manage Collaborators</h3>
      <button class="icon-btn" id="close-collab-modal" style="margin:0;"><span class="material-symbols-outlined">close</span></button>
    `;

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;';

    const collabs = this.boardData.collaborators || [];
    if (collabs.length === 0) {
      list.innerHTML = `<div style="color:var(--on-surface-variant);font-size:14px;text-align:center;padding:24px 0;">No collaborators yet. Share your room key!</div>`;
    } else {
      collabs.forEach(collab => {
        const item = document.createElement('div');
        item.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:rgba(255,255,255,0.05);border-radius:8px;';
        
        // Try to safely extract string values from map or object
        const cid = typeof collab.userId === 'string' ? collab.userId : (collab.userId?.$oid || JSON.stringify(collab.userId));
        const cname = collab.displayName || 'Collaborator';
        
        item.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:24px;height:24px;border-radius:50%;background:${collab.avatarColor || 'var(--primary)'};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:bold;">
              ${cname.charAt(0).toUpperCase()}
            </div>
            <span style="font-size:14px;color:var(--on-surface);">${cname}</span>
          </div>
          <button class="icon-btn remove-collab-btn" data-id="${cid}" style="color:#ff516a;width:28px;height:28px;" title="Remove access">
            <span class="material-symbols-outlined" style="font-size:16px;">person_remove</span>
          </button>
        `;
        list.appendChild(item);
      });
    }

    modal.appendChild(header);
    modal.appendChild(list);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();
    overlay.querySelector('#close-collab-modal').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    list.querySelectorAll('.remove-collab-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const targetId = e.currentTarget.getAttribute('data-id');
        if (confirm('Are you sure you want to remove this collaborator?')) {
          e.currentTarget.disabled = true;
          try {
            const res = await this.app.auth.apiFetch(`/api/boards/${this.boardId}/collaborators/${targetId}`, { method: 'DELETE' });
            if (res.ok) {
              Toast.show('Collaborator removed.', 'success');
              // Update local state
              this.boardData.collaborators = this.boardData.collaborators.filter(c => {
                const cid = typeof c.userId === 'string' ? c.userId : (c.userId?.$oid || '');
                return cid !== targetId;
              });
              closeModal();
              this._showCollaboratorsModal(); // Reopen to refresh list
            } else {
              Toast.show('Failed to remove.', 'error');
            }
          } catch (err) {
            Toast.show('Error removing collaborator.', 'error');
          }
        }
      });
    });
  }

  destroy() {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    if (this.cm) this.cm.stopRenderLoop();
    if (this.sync) this.sync.destroy();
    if (this.textEditor) this.textEditor.destroy();
    if (this.contextMenu) this.contextMenu.destroy();
    if (this.commandPalette) this.commandPalette.destroy();
    if (this.templateEngine) this.templateEngine.destroy();
    if (this.keyRefreshInterval) clearInterval(this.keyRefreshInterval);
    if (this.keyTimerInterval) clearInterval(this.keyTimerInterval);
    if (this._peerCountInterval) clearInterval(this._peerCountInterval);
  }

  _injectStyles() {
    if (document.getElementById('board-styles')) return;
    const style = document.createElement('style');
    style.id = 'board-styles';
    style.textContent = `
      .board-layout { display:flex; flex-direction:column; height:100vh; overflow:hidden; background:var(--surface); }
      
      .board-header {
        position:absolute; top:0; left:0; width:100%;
        display:flex; align-items:center; justify-content:space-between;
        padding:0 16px; z-index:100; height:56px;
        border-bottom:1px solid rgba(255,255,255,0.05);
        gap:12px;
      }
      [data-theme="light"] .board-header { border-bottom-color:var(--outline-variant); }
      
      .header-left, .header-right { display:flex; align-items:center; gap:8px; }
      .header-center { display:flex; align-items:center; gap:4px; }

      .icon-btn {
        width:32px; height:32px; border-radius:8px;
        display:flex; align-items:center; justify-content:center;
        color:var(--on-surface-variant); text-decoration:none;
        background:transparent; border:none; cursor:pointer;
        transition:all 0.15s ease;
      }
      .icon-btn:hover:not([disabled]) { background:rgba(255,255,255,0.08); color:var(--on-surface); }
      .icon-btn[disabled] { opacity:0.35; cursor:default; }
      [data-theme="light"] .icon-btn:hover:not([disabled]) { background:rgba(0,0,0,0.06); }
      
      .board-title-group { display:flex; align-items:center; gap:8px; }
      .board-title-editable:hover { background:rgba(255,255,255,0.05); }
      [data-theme="light"] .board-title-editable:hover { background:rgba(0,0,0,0.04); }
      
      .status-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
      .status-green { background:#22c55e; box-shadow:0 0 8px rgba(34,197,94,0.5); }
      .status-yellow { background:#eab308; box-shadow:0 0 8px rgba(234,179,8,0.5); animation: pulse-glow 1.5s ease-in-out infinite; }
      .status-red { background:#ef4444; box-shadow:0 0 8px rgba(239,68,68,0.5); }
      
      .peer-count-badge {
        display:flex; align-items:center; gap:3px; font-size:11px;
        color:var(--secondary); background:rgba(76,215,246,0.12);
        padding:2px 7px; border-radius:12px; font-family:var(--font-mono);
      }
      
      .zoom-controls { display:flex; align-items:center; gap:2px; }
      
      .presence-bar { display:flex; gap:-4px; }
      .presence-avatar {
        width:28px; height:28px; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        font-size:11px; font-weight:700; color:#131313;
        border:2px solid var(--surface-container);
        cursor:default; flex-shrink:0;
        transition:transform 0.2s;
      }
      .presence-avatar:hover { transform:scale(1.15) translateY(-2px); z-index:1; }
      
      .board-workspace { position:relative; flex:1; margin-top:56px; }
      .canvas-container { position:absolute; inset:0; z-index:1; touch-action:none; }
      .ui-container { position:absolute; inset:0; z-index:10; pointer-events:none; }
      
      .canvas-toolbar {
        position:absolute; left:50%; bottom:24px; transform:translateX(-50%);
        display:flex; align-items:center; padding:6px; border-radius:24px;
        pointer-events:auto; background:var(--surface-container);
        border:1px solid rgba(255,255,255,0.08);
        box-shadow:0 8px 32px rgba(0,0,0,0.3);
      }
      [data-theme="light"] .canvas-toolbar { 
        background:var(--surface-container-lowest); 
        border-color:var(--outline-variant);
        box-shadow:0 4px 20px rgba(0,0,0,0.1);
      }
      
      .toolbar-btn {
        width:40px; height:40px; border-radius:50%; border:none; background:transparent;
        color:var(--on-surface-variant); cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        transition:all 0.15s; position:relative;
      }
      .toolbar-btn:hover { color:var(--on-surface); background:rgba(255,255,255,0.07); transform:scale(1.05); }
      [data-theme="light"] .toolbar-btn:hover { background:rgba(0,0,0,0.05); }
      .toolbar-btn.active { color:var(--primary); background:rgba(192,193,255,0.15); }
      [data-theme="light"] .toolbar-btn.active { background:rgba(63,59,189,0.1); }
      
      .toolbar-divider { width:1px; height:24px; background:rgba(255,255,255,0.08); margin:0 4px; }
      [data-theme="light"] .toolbar-divider { background:var(--outline-variant); }
      
      .property-panel {
        background:var(--surface-container) !important;
      }
      [data-theme="light"] .property-panel {
        background:var(--surface-container-lowest) !important;
      }

      /* Toolbar tooltip */
      .toolbar-btn[title]:hover::after {
        content: attr(title);
        position: absolute;
        bottom: calc(100% + 8px);
        left: 50%;
        transform: translateX(-50%);
        background: var(--surface-container-highest);
        color: var(--on-surface);
        font-size: 11px;
        white-space: nowrap;
        padding: 4px 8px;
        border-radius: 6px;
        pointer-events: none;
        font-family: var(--font-body);
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 9999;
      }
    `;
    document.head.appendChild(style);
  }
}
