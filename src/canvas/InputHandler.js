/**
 * InputHandler — Centralizes pointer, touch, and keyboard events.
 * Delegates actions to the currently active tool or handles global shortcuts (pan, zoom).
 */
export class InputHandler {
  constructor(canvasManager, elementManager) {
    this.cm = canvasManager;
    this.em = elementManager;
    
    this.activeTool = null;
    this.tools = new Map();
    
    this.isSpaceDown = false;
    this.isPanning = false;
    this.lastPanPoint = null;

    this._bindEvents();
  }

  registerTool(name, toolInstance) {
    toolInstance.setInputHandler(this);
    this.tools.set(name, toolInstance);
  }

  setActiveTool(name) {
    if (this.activeTool) {
      this.activeTool.onDeactivate();
    }
    this.activeTool = this.tools.get(name);
    if (this.activeTool) {
      this.activeTool.onActivate();
    }
  }

  _bindEvents() {
    const container = this.cm.container;

    // Pointer Events (Mouse, Pen, Touch)
    container.addEventListener('pointerdown', this._onPointerDown.bind(this));
    window.addEventListener('pointermove', this._onPointerMove.bind(this));
    window.addEventListener('pointerup', this._onPointerUp.bind(this));
    
    // Prevent context menu
    container.addEventListener('contextmenu', e => e.preventDefault());

    // Wheel (Zoom & Pan)
    container.addEventListener('wheel', this._onWheel.bind(this), { passive: false });

    // Keyboard Shortcuts
    window.addEventListener('keydown', this._onKeyDown.bind(this));
    window.addEventListener('keyup', this._onKeyUp.bind(this));
  }

  _onPointerDown(e) {
    // Only handle left click or primary touch/pen
    if (e.button !== 0 && e.pointerType === 'mouse' && e.button !== 1) return;
    
    e.preventDefault();
    this.cm.container.setPointerCapture(e.pointerId);

    const pt = this.cm.getPointerEventCoords(e);
    
    // Middle click or Space+Click initiates panning regardless of tool
    if (e.button === 1 || this.isSpaceDown) {
      this.isPanning = true;
      this.lastPanPoint = { x: e.clientX, y: e.clientY };
      this.cm.container.style.cursor = 'grabbing';
      return;
    }

    if (this.activeTool) {
      this.activeTool.onPointerDown(pt, e);
    }
  }

  _onPointerMove(e) {
    const pt = this.cm.getPointerEventCoords(e);

    // Broadcast cursor position (throttled inside PresenceSync)
    if (this.cm.syncManager) {
      this.cm.syncManager.presenceSync.updateCursor(pt.x, pt.y);
    }

    if (this.isPanning && this.lastPanPoint) {
      const dx = e.clientX - this.lastPanPoint.x;
      const dy = e.clientY - this.lastPanPoint.y;
      this.cm.transform.panBy(dx, dy);
      this.cm.requestStaticRender();
      this.lastPanPoint = { x: e.clientX, y: e.clientY };
      return;
    }

    if (this.activeTool) {
      this.activeTool.onPointerMove(pt, e);
    }
  }

  _onPointerUp(e) {
    this.cm.container.releasePointerCapture(e.pointerId);

    if (this.isPanning) {
      this.isPanning = false;
      this.lastPanPoint = null;
      this.cm.container.style.cursor = this.isSpaceDown ? 'grab' : 'default';
      return;
    }

    const pt = this.cm.getPointerEventCoords(e);
    if (this.activeTool) {
      this.activeTool.onPointerUp(pt, e);
    }
  }

  _onWheel(e) {
    e.preventDefault();

    const rect = this.cm.container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomFactor = -e.deltaY * 0.01;
      this.cm.transform.zoom(zoomFactor, screenX, screenY);
    } else {
      // Pan (trackpad)
      this.cm.transform.panBy(-e.deltaX, -e.deltaY);
    }
    
    this.cm.requestStaticRender();
  }

  _onKeyDown(e) {
    // Don't trigger shortcuts if user is typing in an input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    if (e.code === 'Space' && !this.isSpaceDown) {
      this.isSpaceDown = true;
      this.cm.container.style.cursor = 'grab';
    }

    // Global keyboard shortcuts
    switch (e.key.toLowerCase()) {
      case 'v': this.setActiveTool('select'); break;
      case 'p': this.setActiveTool('pen'); break;
      case 'r': this.setActiveTool('rectangle'); break;
      case 'o': this.setActiveTool('ellipse'); break;
      case 'l': this.setActiveTool('line'); break;
      case 's': this.setActiveTool('sticky'); break;
      case 't': this.setActiveTool('text'); break;
      case 'e': this.setActiveTool('eraser'); break;
      case 'backspace':
      case 'delete':
        if (this.em) this.em.deleteSelection();
        break;
      case 'z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.shiftKey) {
            // this.em.history.redo(); // TODO: Implement HistoryManager
          } else {
            // this.em.history.undo();
          }
        }
        break;
    }

    if (this.activeTool) {
      this.activeTool.onKeyDown(e);
    }
  }

  _onKeyUp(e) {
    if (e.code === 'Space') {
      this.isSpaceDown = false;
      this.cm.container.style.cursor = 'default';
    }

    if (this.activeTool) {
      this.activeTool.onKeyUp(e);
    }
  }
}
