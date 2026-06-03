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
import { TemplateModal } from '../ui/TemplateModal.js';
import { CommentPanel } from '../ui/CommentPanel.js';
import { ShareModal } from '../ui/ShareModal.js';
import { AIManager } from '../ai/AIManager.js';
import { HistoryManager } from '../history/HistoryManager.js';
import { ExportManager } from '../export/ExportManager.js';
import { CommentElement } from '../elements/CommentElement.js';
import { UIElement, UI_COMPONENTS } from '../elements/UIElement.js';
import { generateId } from '../utils/uid.js';
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
    // Lifecycle guard: set to true by destroy() so any in-flight async
    // operations (like the board API fetch) bail out before creating
    // managers that would never be cleaned up.
    this._destroyed = false;
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

            <!-- Viewer: Request Access -->
            <button class="btn btn-primary" id="request-access-btn" style="display:none;padding:6px 12px;height:auto;background:var(--tertiary);">
              <span class="material-symbols-outlined" style="font-size:16px">lock_open</span>
              <span>Request Edit Access</span>
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

      // Guard: user may have navigated away while the fetch was in flight.
      // If destroyed, do NOT create InputHandler/SyncManager — their window
      // listeners would never be removed, causing ghost cursor/connection leaks.
      if (this._destroyed) return;

      if (!res.ok) throw new Error('Board not found');
      const data = await res.json();

      // Second guard after the second await (json parsing)
      if (this._destroyed) return;

      this.boardData = data.board;
      this.boardRole = data.role || 'editor';
      this.root.querySelector('#board-title').textContent = this.boardData.title;
      this._initEngine(data.elements || []);
      this._initRoomKey();
      this._initTitleEditing();
    } catch (err) {
      if (this._destroyed) return; // Suppress errors after navigation
      console.error('Failed to load board:', err);
      // BUG-016 fix: use Toast instead of blocking alert()
      import('../ui/Toast.js').then(({ Toast }) => {
        Toast.show('Failed to load board: ' + err.message, 'error', 5000);
      });
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
    this.exportMgr = new ExportManager(this.cm, this.em, this.sync, this.history);

    // Lock UI if viewer
    const isViewer = this.boardRole === 'viewer';

    // 10. Toolbar & Property Panel
    this.toolbar = new Toolbar(uiContainer, this.ih);
    this.propertyPanel = new PropertyPanel(uiContainer, this.ih, this.em, this.sync);

    if (isViewer) {
      uiContainer.style.display = 'none'; // hide toolbar and properties completely
      this.root.querySelector('#manual-save-btn').style.display = 'none';
      const reqBtn = this.root.querySelector('#request-access-btn');
      reqBtn.style.display = 'flex';
      reqBtn.addEventListener('click', () => this._requestAccess(reqBtn));
      this.ih.setActiveTool('pan');
    }

    // 11. AI Manager
    this.ai = new AIManager(this.app, this);
    this.root.querySelector('#ai-assist-btn')?.addEventListener('click', () => {
      this.ai.summarizeBoard();
    });

    // 11.5 Command Palette
    this.commandPalette = new CommandPalette(this, this.ih, this.cm);

    // 11.6 Template Engine (existing plugin) + new TemplateModal
    this.templateEngine = new TemplateEngine(this);
    this.templateModal = new TemplateModal(this.sync, this.em, this.cm);
    this.root.querySelector('#templates-btn')?.addEventListener('click', () => {
      this.templateModal.show();
    });

    // 11.7 Comment Panel
    this.commentPanel = new CommentPanel(this.sync, this.em, this.app.auth);

    // Wire comment bubbles: clicking a CommentElement opens the panel
    const origGetElementAt = this.em.getElementAt.bind(this.em);
    this.ih.on?.('element_clicked', (el) => {
      if (el?.type === 'comment') this.commentPanel.open(el);
    });

    // 11.8 UI Builder Panel — floating sidebar
    this._initUIBuilderPanel();

    // 11.9 Background Settings button
    this._initBackgroundSettings();

    // 11.10 Share Modal
    this.shareModal = new ShareModal(this.app, this.boardId, this.boardData);
    this._initShareButton();

    // 11.11 Comment Tool button — places a comment bubble on canvas
    this._initCommentTool();

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
    // Register room_state callback so presence bar refreshes when we first join
    this.sync._onPresenceUpdate = () => {
      this._updatePresenceBar();
      this._updatePeerCount();
    };

    this.sync.ws.on('peer_joined', (msg) => {
      // activeUsers is updated by SyncManager before this fires,
      // so we can safely read it now
      this._updatePresenceBar();
      this._updatePeerCount();
      if (msg.userName && msg.userId !== this.sync.userId) {
        Toast.show(`${msg.userName} joined the canvas`, 'info', 3000);
      }
      // Also update after WebRTC settles
      setTimeout(() => this._updatePeerCount(), 1500);
    });
    this.sync.ws.on('peer_left', (msg) => {
      this._updatePresenceBar();
      this._updatePeerCount();
      if (msg.userName && msg.userId !== this.sync.userId) {
        import('../ui/Toast.js').then(({ Toast }) => {
          Toast.show(`${msg.userName} left the canvas`, 'warning', 3000);
        });
      }
    });

    // 13.5 Access Request Handling
    this.sync.ws.on('access_request', (msg) => {
      const data = JSON.parse(msg.payload);
      import('../ui/Toast.js').then(({ Toast }) => {
        const toast = Toast.showHTML(`
          <div class="toast-icon"><span class="material-symbols-outlined" style="color:var(--tertiary)">person_add</span></div>
          <div class="toast-content" style="display:flex;flex-direction:column;gap:8px;">
            <div style="font-weight:600;">${data.userName} requested Edit Access</div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-primary" style="padding:4px 8px;font-size:12px;height:auto;" id="approve-${data.requestId}">Approve</button>
              <button class="btn btn-outline" style="padding:4px 8px;font-size:12px;height:auto;" id="reject-${data.requestId}">Reject</button>
            </div>
          </div>
          <button class="toast-close"><span class="material-symbols-outlined" style="font-size: 18px;">close</span></button>
        `, 0); // No timeout

        const approveBtn = toast.querySelector(`#approve-${data.requestId}`);
        const rejectBtn = toast.querySelector(`#reject-${data.requestId}`);

        approveBtn.onclick = async () => {
          approveBtn.disabled = true;
          try {
            await this.app.auth.apiFetch(`/api/boards/${this.boardId}/access/approve`, {
              method: 'POST', body: JSON.stringify({ requestId: data.requestId })
            });
            Toast.dismiss(toast);
          } catch(e) { approveBtn.disabled = false; }
        };

        rejectBtn.onclick = async () => {
          rejectBtn.disabled = true;
          try {
            await this.app.auth.apiFetch(`/api/boards/${this.boardId}/access/reject`, {
              method: 'POST', body: JSON.stringify({ requestId: data.requestId })
            });
            Toast.dismiss(toast);
          } catch(e) { rejectBtn.disabled = false; }
        };
      });
    });

    this.sync.ws.on('access_decision', (msg) => {
      const data = JSON.parse(msg.payload);
      import('../ui/Toast.js').then(({ Toast }) => {
        if (data.status === 'approved') {
          Toast.show('Your edit access was approved! Reloading...', 'success', 3000);
          setTimeout(() => window.location.reload(), 1500);
        } else if (data.status === 'rejected') {
          Toast.show('Your edit access request was declined.', 'error', 5000);
          const reqBtn = document.getElementById('request-access-btn');
          if (reqBtn) {
            reqBtn.disabled = false;
            reqBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px">lock_open</span><span>Request Edit Access</span>`;
          }
        }
      });
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

  async _requestAccess(btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px">hourglass_empty</span><span>Requesting...</span>`;
    try {
      const res = await this.app.auth.apiFetch(`/api/boards/${this.boardId}/access/request`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      import('../ui/Toast.js').then(({ Toast }) => {
        Toast.show('Access requested. Waiting for owner approval.', 'success');
      });
      btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px">schedule</span><span>Pending...</span>`;
    } catch (e) {
      import('../ui/Toast.js').then(({ Toast }) => {
        const errorMsg = JSON.parse(e.message).error || e.message;
        Toast.show('Request failed: ' + errorMsg, 'error');
      });
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px">lock_open</span><span>Request Edit Access</span>`;
    }
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

    const localUser = this.app.auth.getUser();
    if (!localUser) return;

    const localName = localUser.displayName || localUser.name || 'You';
    const localInitials = localName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    // BUG-012 fix: build avatars for local user AND all active remote peers
    const colors = ['#c0c1ff', '#4cd7f6', '#ffb2b7', '#8083ff', '#03b5d3', '#ff516a'];
    const getUserColor = (id) => {
      let hash = 0;
      for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
      return colors[Math.abs(hash) % colors.length];
    };

    let html = `
      <div class="presence-avatar" title="${localName} (You)" style="background:#c0c1ff;">
        ${localInitials}
      </div>
    `;

    // Add remote peer avatars from activeUsers map
    for (const [userId] of this.sync.activeUsers.entries()) {
      // Skip own userId
      if (userId === this.sync.userId) continue;
      const color = getUserColor(userId);
      const initial = userId.charAt(0).toUpperCase();
      html += `
        <div class="presence-avatar" title="Collaborator" style="background:${color};">
          ${initial}
        </div>
      `;
    }

    bar.innerHTML = html;
  }

  _updatePeerCount() {
    if (!this.sync) return;
    const count = this.sync.uniqueUserCount;
    // Add 1 to include the local user in the total count
    const totalPeople = count + 1;
    const badge = document.getElementById('peer-count');
    const num = document.getElementById('peer-count-num');
    if (badge && num) {
      num.textContent = totalPeople;
      badge.style.display = totalPeople > 1 ? 'flex' : 'none';
    }
  }

  async _initRoomKey() {
    if (this._destroyed) return;
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
      if (this._destroyed) return; // Don't refresh after navigating away
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

    // BUG-008 fix: use a single countdown timer that also handles the refresh.
    // The old code had both a 1s interval AND a 60s interval that could fire
    // simultaneously, causing a double refresh at exactly the 60-second mark.
    if (this.keyTimerInterval) clearInterval(this.keyTimerInterval);
    this.keyTimerInterval = setInterval(() => {
      if (secondsLeft > 0) {
        secondsLeft--;
        if (timerLabel) timerLabel.textContent = `(${secondsLeft}s)`;
        // BUG-008 fix: refresh when 1 second remains so the new key arrives
        // before the display hits 0, and we no longer need keyRefreshInterval.
        if (secondsLeft === 0) refreshKey();
      }
    }, 1000);
    // BUG-008 fix: removed redundant keyRefreshInterval — the 1s countdown handles all refreshes

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

  // NOTE: The authoritative destroy() is below at the end of the class.
  // BUG-005 fix: removed the first incomplete destroy() definition that was
  // being silently overwritten by the second one, causing canvas/textEditor leaks.

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

  _initUIBuilderPanel() {
    const headerRight = this.root.querySelector('.header-right');
    if (!headerRight) return;

    // Add UI Builder toggle button
    const uiBtn = document.createElement('button');
    uiBtn.className = 'btn btn-outline';
    uiBtn.id = 'ui-builder-btn';
    uiBtn.title = 'UI Builder Mode';
    uiBtn.style.cssText = 'padding:6px 12px;height:auto;';
    uiBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;margin-right:4px;">widgets</span>UI Builder`;
    headerRight.insertBefore(uiBtn, headerRight.querySelector('#export-btn'));

    // Create UI Builder panel
    const panel = document.createElement('div');
    panel.id = 'ui-builder-panel';
    panel.className = 'glass elevation-3';
    panel.style.cssText = `
      position: fixed; left: 72px; top: 72px;
      width: 200px; border-radius: 14px; padding: 14px;
      display: none; flex-direction: column; gap: 6px;
      z-index: 9500; max-height: calc(100vh - 100px); overflow-y: auto;
    `;

    const categories = {
      'Form Controls': ['button', 'input', 'toggle', 'dropdown'],
      'Layout': ['card', 'navbar', 'modal'],
      'Display': ['badge'],
    };

    panel.innerHTML = `<div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:6px;letter-spacing:0.5px;">UI COMPONENTS</div>`;

    Object.entries(categories).forEach(([cat, items]) => {
      panel.innerHTML += `<div style="font-size:10px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.5px;margin-top:6px;margin-bottom:2px;">${cat}</div>`;
      items.forEach(component => {
        const def = UI_COMPONENTS[component];
        const btn = document.createElement('button');
        btn.className = 'cm-item';
        btn.dataset.component = component;
        btn.style.cssText = 'width:100%;border:1px solid var(--outline-variant);border-radius:8px;padding:8px 10px;margin-bottom:2px;cursor:grab;text-align:left;';
        btn.innerHTML = `
          <span class="material-symbols-outlined" style="font-size:14px;color:var(--primary)">smart_button</span>
          <span style="font-size:12px;">${def.label}</span>
        `;
        btn.title = `Drag to place ${def.label}`;
        btn.draggable = true;
        btn.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('application/json', JSON.stringify({ type: 'ui-component', component }));
          e.dataTransfer.effectAllowed = 'copy';
        });

        btn.addEventListener('click', () => {
          // Place component at center of viewport
          if (!this.cm || !this.sync || !this.em) return;
          const scale = this.cm.transform.scale;
          const cx = (this.cm.width / 2 - this.cm.transform.panX) / scale;
          const cy = (this.cm.height / 2 - this.cm.transform.panY) / scale;

          const el = new UIElement({
            id: generateId(),
            component,
            x: cx - def.defaultWidth / 2,
            y: cy - def.defaultHeight / 2,
            width: def.defaultWidth,
            height: def.defaultHeight,
            zIndex: Date.now(),
            props: { ...def.defaultProps },
            uiTheme: this._uiBuilderTheme || (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'),
          });

          this.em.setElement(el);
          this.sync.broadcastCreate(el);
          Toast.show(`${def.label} added to canvas`, 'success', 1500);
        });
        panel.appendChild(btn);
      });
    });

    // Theme toggle for UI elements
    const themeRow = document.createElement('div');
    themeRow.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid var(--outline-variant);';
    themeRow.innerHTML = `
      <div style="font-size:10px;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Component Theme</div>
      <div style="display:flex;gap:6px;">
        <button id="ui-theme-dark" class="btn-primary" style="flex:1;font-size:11px;padding:6px;">Dark</button>
        <button id="ui-theme-light" class="btn btn-outline" style="flex:1;font-size:11px;padding:6px;">Light</button>
      </div>
    `;
    panel.appendChild(themeRow);

    document.body.appendChild(panel);
    this._uiBuilderTheme = 'dark';

    panel.querySelector('#ui-theme-dark')?.addEventListener('click', () => { this._uiBuilderTheme = 'dark'; });
    panel.querySelector('#ui-theme-light')?.addEventListener('click', () => { this._uiBuilderTheme = 'light'; });

    let panelVisible = false;
    uiBtn.addEventListener('click', () => {
      panelVisible = !panelVisible;
      panel.style.display = panelVisible ? 'flex' : 'none';
      uiBtn.style.background = panelVisible ? 'rgba(192,193,255,0.15)' : '';
      uiBtn.style.borderColor = panelVisible ? 'var(--primary)' : '';
    });

    // Handle drag and drop on canvas container
    const container = this.root.querySelector('#canvas-container');
    if (container) {
      container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      });

      container.addEventListener('drop', (e) => {
        e.preventDefault();
        const dataStr = e.dataTransfer.getData('application/json');
        if (!dataStr) return;
        
        try {
          const data = JSON.parse(dataStr);
          if (data.type === 'ui-component' && this.cm && this.sync && this.em) {
            const component = data.component;
            const def = UI_COMPONENTS[component];
            if (!def) return;

            const rect = container.getBoundingClientRect();
            const coords = this.cm.transform.screenToCanvas(e.clientX - rect.left, e.clientY - rect.top);

            const el = new UIElement({
              id: generateId(),
              component,
              x: coords.x - def.defaultWidth / 2,
              y: coords.y - def.defaultHeight / 2,
              width: def.defaultWidth,
              height: def.defaultHeight,
              zIndex: Date.now(),
              props: { ...def.defaultProps },
              uiTheme: this._uiBuilderTheme || (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'),
            });

            this.em.setElement(el);
            this.sync.broadcastCreate(el);
            import('../ui/Toast.js').then(({ Toast }) => {
              Toast.show(`${def.label} dropped`, 'success', 1500);
            });
          }
        } catch (err) {
          console.error('Drop error', err);
        }
      });
    }
  }

  _initBackgroundSettings() {
    const headerRight = this.root.querySelector('.header-right');
    if (!headerRight) return;

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'icon-btn';
    settingsBtn.id = 'bg-settings-btn';
    settingsBtn.title = 'Canvas Settings';
    settingsBtn.innerHTML = `<span class="material-symbols-outlined">tune</span>`;
    headerRight.insertBefore(settingsBtn, headerRight.firstChild);

    settingsBtn.addEventListener('click', (e) => {
      const existing = document.getElementById('bg-settings-popup');
      if (existing) { existing.remove(); return; }

      const popup = document.createElement('div');
      popup.id = 'bg-settings-popup';
      popup.className = 'glass elevation-3';
      popup.style.cssText = `
        position: fixed; z-index: 9800;
        right: 16px; top: 64px;
        width: 220px; border-radius: 14px; padding: 16px;
      `;

      const currentBg = this.cm?.backgroundType || 'grid';
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

      popup.innerHTML = `
        <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:12px;letter-spacing:0.5px;">CANVAS SETTINGS</div>

        <div style="font-size:11px;color:var(--on-surface-variant);margin-bottom:8px;">Background</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px;">
          ${[['grid','Grid','grid_on'], ['dots','Dots','more_horiz'], ['lines','Lines','format_list_bulleted'], ['blank','None','crop_square'], ['solid-dark','Black','dark_mode'], ['solid-light','White','light_mode']].map(([val,lbl,icon]) => `
            <button data-bg="${val}" class="bg-opt-btn" style="
              padding:8px;border-radius:8px;border:2px solid ${currentBg===val?'var(--primary)':'var(--outline-variant)'};
              background:${currentBg===val?'rgba(192,193,255,0.1)':'transparent'};
              cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;
              color:${currentBg===val?'var(--primary)':'var(--on-surface-variant)'};font-size:11px;
            ">
              <span class="material-symbols-outlined" style="font-size:18px">${icon}</span>${lbl}
            </button>
          `).join('')}
        </div>

        <div style="height:1px;background:var(--outline-variant);margin-bottom:12px;"></div>
        <div style="font-size:11px;color:var(--on-surface-variant);margin-bottom:8px;">Theme</div>
        <div style="display:flex;gap:6px;">
          <button id="theme-dark-btn" style="flex:1;padding:8px;border-radius:8px;border:2px solid ${isDark?'var(--primary)':'var(--outline-variant)'};background:${isDark?'rgba(192,193,255,0.1)':'transparent'};cursor:pointer;font-size:11px;color:${isDark?'var(--primary)':'var(--on-surface-variant)'};">
            🌙 Dark
          </button>
          <button id="theme-light-btn" style="flex:1;padding:8px;border-radius:8px;border:2px solid ${!isDark?'var(--primary)':'var(--outline-variant)'};background:${!isDark?'rgba(192,193,255,0.1)':'transparent'};cursor:pointer;font-size:11px;color:${!isDark?'var(--primary)':'var(--on-surface-variant)'};">
            ☀️ Light
          </button>
        </div>
      `;

      document.body.appendChild(popup);

      popup.querySelectorAll('.bg-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.cm?.setBackground(btn.dataset.bg);
          popup.querySelectorAll('.bg-opt-btn').forEach(b => {
            b.style.borderColor = b === btn ? 'var(--primary)' : 'var(--outline-variant)';
            b.style.background = b === btn ? 'rgba(192,193,255,0.1)' : 'transparent';
            b.style.color = b === btn ? 'var(--primary)' : 'var(--on-surface-variant)';
          });
        });
      });

      popup.querySelector('#theme-dark-btn')?.addEventListener('click', () => {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('canvasflow-theme', 'dark');
        popup.remove();
      });
      popup.querySelector('#theme-light-btn')?.addEventListener('click', () => {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('canvasflow-theme', 'light');
        popup.remove();
      });

      const dismiss = (ev) => {
        if (!popup.contains(ev.target) && ev.target !== settingsBtn) {
          popup.remove();
          document.removeEventListener('pointerdown', dismiss);
        }
      };
      setTimeout(() => document.addEventListener('pointerdown', dismiss), 50);
    });
  }

  _initShareButton() {
    const headerRight = this.root.querySelector('.header-right');
    if (!headerRight) return;

    const shareBtn = document.createElement('button');
    shareBtn.className = 'btn btn-outline';
    shareBtn.id = 'share-btn';
    shareBtn.style.cssText = 'padding:6px 12px;height:auto;';
    shareBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;margin-right:4px;">share</span>Share`;

    // Insert before export button
    const exportBtn = headerRight.querySelector('#export-btn');
    if (exportBtn) {
      headerRight.insertBefore(shareBtn, exportBtn);
    } else {
      headerRight.appendChild(shareBtn);
    }

    shareBtn.addEventListener('click', () => {
      this.shareModal.show(this.boardData);
    });
  }

  _initCommentTool() {
    // Add a comment button to the toolbar
    const toolbar = this.root.querySelector('.toolbar');
    if (!toolbar) return;

    const divider = document.createElement('div');
    divider.className = 'toolbar-divider';
    toolbar.appendChild(divider);

    const commentBtn = document.createElement('button');
    commentBtn.className = 'toolbar-btn';
    commentBtn.id = 'comment-tool-btn';
    commentBtn.title = 'Add Comment';
    commentBtn.innerHTML = `
      <span class="material-symbols-outlined">comment</span>
      <span class="toolbar-btn-label">Comment</span>
    `;
    toolbar.appendChild(commentBtn);

    commentBtn.addEventListener('click', () => {
      if (!this.cm || !this.sync || !this.em) return;

      const scale = this.cm.transform.scale;
      const cx = (this.cm.width / 2 - this.cm.transform.panX) / scale;
      const cy = (this.cm.height / 2 - this.cm.transform.panY) / scale;

      const user = this.app.auth.getUser();
      const el = new CommentElement({
        id: generateId(),
        x: cx,
        y: cy,
        text: '',
        authorName: user?.displayName || user?.name || 'You',
        authorId: user?.id || user?.$id || 'anon',
        parentId: null,
        zIndex: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      this.em.setElement(el);
      this.sync.broadcastCreate(el);
      this.cm.requestStaticRender();

      // Immediately open the comment panel so user can type
      this.commentPanel?.open(el);
      Toast.show('Comment placed! Add your text in the panel.', 'info', 2500);
    });
  }

  // Lifecycle: marks this page as destroyed and tears down all managers.
  // MUST set _destroyed first so any in-flight async render() calls abort.
  destroy() {
    console.log('[BoardPage] Destroying...');

    // Set destroyed flag IMMEDIATELY — this is the critical line.
    // Any pending async operations in render() will check this and bail out
    // before creating InputHandler / SyncManager, preventing ghost connections.
    this._destroyed = true;

    // Clean up intervals
    if (this._peerCountInterval) clearInterval(this._peerCountInterval);
    if (this.keyTimerInterval) clearInterval(this.keyTimerInterval);

    // Clean up global listeners
    if (this.handleBeforeUnload) {
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }

    // Stop the canvas render loop first to prevent rendering on torn-down state
    if (this.cm) this.cm.stopRenderLoop();

    // Destroy all UI managers that own DOM nodes / window listeners
    if (this.textEditor) this.textEditor.destroy();
    if (this.contextMenu) this.contextMenu.destroy();
    if (this.commandPalette) this.commandPalette.destroy();
    if (this.templateEngine && typeof this.templateEngine.destroy === 'function') {
      this.templateEngine.destroy();
    }

    // Destroy network managers last (closes sockets + WebRTC connections)
    if (this.ih) this.ih.destroy();
    if (this.sync) this.sync.destroy();

    // Clear DOM
    this.root.innerHTML = '';
  }
}
