/**
 * BoardPage — The main whiteboard workspace.
 * Initializes the CanvasEngine, Tools, UI, and SyncManager.
 */
import { CanvasManager } from '../canvas/CanvasManager.js';
import { ElementManager } from '../elements/ElementManager.js';
import { InputHandler } from '../canvas/InputHandler.js';
import { SyncManager } from '../sync/SyncManager.js';
import { Toolbar } from '../ui/Toolbar.js';
import { AIManager } from '../ai/AIManager.js';

// Tools
import { SelectTool } from '../tools/SelectTool.js';
import { PenTool } from '../tools/PenTool.js';
import { ShapeTool } from '../tools/ShapeTool.js';
import { StickyTool } from '../tools/StickyTool.js';
import { TextTool } from '../tools/TextTool.js';
import { Tool } from '../tools/Tool.js';

// Simple Pan and Eraser stubs
class PanTool extends Tool {
  constructor() { super('pan'); }
  onActivate() { this.cm.container.style.cursor = 'grab'; }
  onPointerDown(pt, e) {
    this.isPanning = true;
    this.lastPt = { x: e.clientX, y: e.clientY };
    this.cm.container.style.cursor = 'grabbing';
  }
  onPointerMove(pt, e) {
    if (this.isPanning && this.lastPt) {
      const dx = e.clientX - this.lastPt.x;
      const dy = e.clientY - this.lastPt.y;
      this.cm.transform.panBy(dx, dy);
      this.cm.requestStaticRender();
      this.lastPt = { x: e.clientX, y: e.clientY };
    }
  }
  onPointerUp() {
    this.isPanning = false;
    this.cm.container.style.cursor = 'grab';
  }
}

class EraserTool extends Tool {
  constructor() { super('eraser'); }
  onActivate() { this.cm.container.style.cursor = 'cell'; }
  onPointerDown(pt) { this.eraseAt(pt); }
  onPointerMove(pt, e) { if (e.buttons === 1) this.eraseAt(pt); }
  eraseAt(pt) {
    const el = this.em.getElementAt(pt.x, pt.y);
    if (el && !el.locked) {
      this.em.removeElement(el.id);
      if (this.cm.syncManager) this.cm.syncManager.broadcastDelete(el.id);
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
    // Basic Layout shell
    this.root.innerHTML = `
      <div class="board-layout">
        <header class="board-header glass">
          <div class="header-left">
            <a href="#/dashboard" class="icon-btn" aria-label="Back to dashboard">
              <span class="material-symbols-outlined">arrow_back</span>
            </a>
            <div class="board-title-group">
              <h1 class="headline-sm truncate" id="board-title" style="font-size: 16px;">Loading...</h1>
              <div id="latency-indicator" class="status-dot status-yellow" title="Connecting..."></div>
            </div>
          </div>
          <div class="header-right">
            <!-- Presence avatars will go here -->
            <div id="presence-bar" class="presence-bar"></div>
            
            
            <!-- AI Assist Button (Phase 4) -->
            <button class="btn btn-ghost ai-assist-btn" id="ai-assist-btn" style="color: var(--tertiary); padding: 6px 12px; height: auto;">
              <span class="material-symbols-outlined" style="font-size:16px; margin-right:4px;">auto_awesome</span> 
              AI Assist
            </button>
            
            <button class="btn btn-outline" style="padding: 6px 12px; height: auto;" id="share-btn">
              <span class="material-symbols-outlined" style="font-size:16px;">share</span> Share
            </button>
          </div>
        </header>

        <div class="board-workspace">
          <!-- Canvas Container -->
          <div id="canvas-container" class="canvas-container"></div>
          
          <!-- UI Overlays -->
          <div id="ui-container" class="ui-container"></div>
        </div>
      </div>
    `;

    this._injectStyles();

    // Fetch Board Data
    try {
      const res = await this.app.auth.apiFetch(`/api/boards/${this.boardId}`);
      if (!res.ok) throw new Error('Board not found');
      
      const data = await res.json();
      this.boardData = data.board;
      this.root.querySelector('#board-title').textContent = this.boardData.title;
      
      this._initEngine(data.elements || []);
    } catch (err) {
      alert("Failed to load board: " + err.message);
      this.app.navigate('/dashboard');
    }
  }

  _initEngine(initialElements) {
    const canvasContainer = this.root.querySelector('#canvas-container');
    const uiContainer = this.root.querySelector('#ui-container');

    if (!canvasContainer) {
      console.warn("Canvas container not found, aborting engine init (page probably navigated away)");
      return;
    }

    // 1. Initialize Canvas Manager
    this.cm = new CanvasManager(canvasContainer, this.boardId);
    this.cm.setBackground(this.boardData.background);

    // 2. Initialize Element Manager
    this.em = new ElementManager(this.cm);
    this.cm.elementManager = this.em;

    // 3. Initialize Input Handler
    this.ih = new InputHandler(this.cm, this.em);
    this.cm.inputHandler = this.ih;

    // 4. Register Tools
    this.ih.registerTool('select', new SelectTool());
    this.ih.registerTool('pan', new PanTool());
    this.ih.registerTool('pen', new PenTool());
    this.ih.registerTool('rectangle', new ShapeTool('rectangle'));
    this.ih.registerTool('ellipse', new ShapeTool('ellipse'));
    this.ih.registerTool('line', new ShapeTool('line'));
    this.ih.registerTool('arrow', new ShapeTool('arrow'));
    this.ih.registerTool('sticky', new StickyTool());
    this.ih.registerTool('text', new TextTool());
    this.ih.registerTool('eraser', new EraserTool());
    
    this.ih.setActiveTool('select');

    // 5. Initialize UI
    this.toolbar = new Toolbar(uiContainer, this.ih);

    // 6. Initialize Sync Layer
    this.sync = new SyncManager(this.app, this.boardId, this.cm);
    
    // Bind HA Status UI
    const statusDot = this.root.querySelector('#latency-indicator');
    if (statusDot) {
      this.sync.ws.on('connected', () => {
        statusDot.className = 'status-dot status-green';
        statusDot.title = 'Online & Synced';
      });
      this.sync.ws.on('disconnected', () => {
        statusDot.className = 'status-dot status-red';
        statusDot.title = 'Offline (Saving Locally)';
      });
      this.sync.ws.on('syncing', () => {
        statusDot.className = 'status-dot status-yellow';
        statusDot.title = 'Syncing...';
      });
    }

    // 7. Initialize AI Manager
    this.ai = new AIManager(this.app, this);
    
    // Bind AI button
    this.root.querySelector('#ai-assist-btn')?.addEventListener('click', () => {
      // Context menu for AI
      const isShift = window.event && window.event.shiftKey;
      if (isShift) {
        this.ai.organizeSelection();
      } else {
        this.ai.summarizeBoard();
      }
    });

    // Load initial elements (these come from the REST API, not WS)
    // Needs hydration similar to SyncManager
    const hydratedElements = initialElements.map(el => this.sync._hydrateElement(el)).filter(Boolean);
    this.em.setElements(hydratedElements);

    // Zoom to fit if there are elements
    if (hydratedElements.length > 0) {
      // Very simple center pan (can be improved)
      const firstEl = hydratedElements[0];
      const rect = canvasContainer.getBoundingClientRect();
      this.cm.transform.panTo(rect.width/2 - firstEl.x, rect.height/2 - firstEl.y);
    }
  }

  destroy() {
    if (this.cm) this.cm.stopRenderLoop();
    if (this.sync) this.sync.destroy();
  }

  _injectStyles() {
    if (!document.getElementById('board-styles')) {
      const style = document.createElement('style');
      style.id = 'board-styles';
      style.textContent = `
        .board-layout { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: var(--surface); }
        
        .board-header {
          position: absolute; top: 0; left: 0; width: 100%; height: 56px;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 var(--space-md); z-index: 100;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        [data-theme="light"] .board-header { border-bottom-color: var(--outline-variant); }
        
        .header-left, .header-right { display: flex; align-items: center; gap: var(--space-md); }
        
        .icon-btn {
          width: 32px; height: 32px; border-radius: var(--radius);
          display: flex; align-items: center; justify-content: center;
          color: var(--on-surface-variant); text-decoration: none; transition: background 0.2s;
        }
        .icon-btn:hover { background: rgba(255,255,255,0.05); color: var(--on-surface); }
        
        .board-title-group { display: flex; align-items: center; gap: 8px; }
        
        .status-dot { width: 8px; height: 8px; border-radius: 50%; }
        .status-green { background: #22c55e; box-shadow: 0 0 8px rgba(34, 197, 94, 0.5); }
        .status-yellow { background: #eab308; box-shadow: 0 0 8px rgba(234, 179, 8, 0.5); }
        .status-red { background: #ef4444; box-shadow: 0 0 8px rgba(239, 68, 68, 0.5); }
        
        .board-workspace { position: relative; flex: 1; margin-top: 56px; }
        .canvas-container { position: absolute; inset: 0; z-index: 1; touch-action: none; }
        .ui-container { position: absolute; inset: 0; z-index: 10; pointer-events: none; }
        
        /* Toolbar */
        .canvas-toolbar {
          position: absolute; left: 50%; bottom: var(--space-xl); transform: translateX(-50%);
          display: flex; align-items: center; padding: 6px; border-radius: var(--radius-xl);
          pointer-events: auto; background: var(--surface-container); border: 1px solid rgba(255,255,255,0.1);
        }
        [data-theme="light"] .canvas-toolbar { background: var(--surface-container-lowest); border-color: var(--outline-variant); }
        
        .toolbar-btn {
          width: 40px; height: 40px; border-radius: 50%; border: none; background: transparent;
          color: var(--on-surface-variant); cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; position: relative;
        }
        .toolbar-btn:hover { color: var(--on-surface); background: rgba(255,255,255,0.05); }
        [data-theme="light"] .toolbar-btn:hover { background: rgba(0,0,0,0.04); }
        
        .toolbar-btn.active { color: var(--primary); background: rgba(192,193,255,0.1); }
        [data-theme="light"] .toolbar-btn.active { background: rgba(63, 59, 189, 0.08); }
        
        .toolbar-divider { width: 1px; height: 24px; background: rgba(255,255,255,0.1); margin: 0 4px; }
        [data-theme="light"] .toolbar-divider { background: var(--outline-variant); }
        
        .presence-bar { display: flex; }
      `;
      document.head.appendChild(style);
    }
  }
}
