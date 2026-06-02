/**
 * InputHandler — Centralizes pointer, touch, and keyboard events.
 * Delegates actions to the currently active tool or handles global shortcuts.
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

    // External managers injected after construction
    this.historyManager = null;
    this.contextMenu = null;

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

    container.addEventListener('pointerdown', this._onPointerDown.bind(this));
    window.addEventListener('pointermove', this._onPointerMove.bind(this));
    window.addEventListener('pointerup', this._onPointerUp.bind(this));
    
    // Prevent default context menu; show custom one
    container.addEventListener('contextmenu', this._onContextMenu.bind(this));

    container.addEventListener('wheel', this._onWheel.bind(this), { passive: false });

    window.addEventListener('keydown', this._onKeyDown.bind(this));
    window.addEventListener('keyup', this._onKeyUp.bind(this));
  }

  _onContextMenu(e) {
    e.preventDefault();
    if (!this.contextMenu) return;
    const pt = this.cm.getPointerEventCoords(e);
    const el = this.em.getElementAt(pt.x, pt.y);
    if (el) this.em.select(el.id, true);
    this.contextMenu.show(e.clientX, e.clientY, el || null);
  }

  _onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse' && e.button !== 1) return;
    
    e.preventDefault();
    this.cm.container.setPointerCapture(e.pointerId);

    const pt = this.cm.getPointerEventCoords(e);
    
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
      const zoomFactor = -e.deltaY * 0.005;
      this.cm.transform.zoom(zoomFactor, screenX, screenY);
    } else {
      this.cm.transform.panBy(-e.deltaX, -e.deltaY);
    }
    
    this.cm.requestStaticRender();
    this._updateZoomUI();
  }

  _updateZoomUI() {
    const zoomDisplay = document.getElementById('zoom-display');
    if (zoomDisplay) {
      zoomDisplay.textContent = `${Math.round(this.cm.transform.scale * 100)}%`;
    }
  }

  _onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    if (e.code === 'Space' && !this.isSpaceDown) {
      this.isSpaceDown = true;
      this.cm.container.style.cursor = 'grab';
    }

    const isCtrl = e.ctrlKey || e.metaKey;

    // --- Ctrl shortcuts ---
    if (isCtrl) {
      switch (e.key.toLowerCase()) {
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            this.historyManager?.redo();
          } else {
            this.historyManager?.undo();
          }
          return;
        case 'y':
          e.preventDefault();
          this.historyManager?.redo();
          return;
        case 'c':
          e.preventDefault();
          if (this.contextMenu && this.em.selectedIds.size > 0) {
            const id = [...this.em.selectedIds][0];
            const el = this.em.elements.get(id);
            if (el) this.contextMenu.setClipboard(el.toJSON());
          }
          return;
        case 'v':
          e.preventDefault();
          if (this.contextMenu) {
            const clip = this.contextMenu.getClipboard();
            if (clip && this.cm.syncManager) {
              const clone = { ...clip, id: Date.now().toString(36), x: clip.x + 20, y: clip.y + 20 };
              const hydrated = this.cm.syncManager._hydrateElement(clone);
              if (hydrated) {
                this.em.setElement(hydrated);
                this.cm.syncManager.broadcastCreate(hydrated);
              }
            }
          }
          return;
        case 'd':
          e.preventDefault();
          if (this.em.selectedIds.size > 0 && this.cm.syncManager) {
            const id = [...this.em.selectedIds][0];
            const el = this.em.elements.get(id);
            if (el) {
              const clone = { ...el.toJSON(), id: Date.now().toString(36), x: el.x + 20, y: el.y + 20 };
              const hydrated = this.cm.syncManager._hydrateElement(clone);
              if (hydrated) {
                this.em.setElement(hydrated);
                this.cm.syncManager.broadcastCreate(hydrated);
                this.em.select(hydrated.id, true);
              }
            }
          }
          return;
        case 'a':
          e.preventDefault();
          for (const id of this.em.elements.keys()) this.em.selectedIds.add(id);
          this.cm.requestStaticRender();
          return;
      }
    }

    // --- Tool shortcuts ---
    switch (e.key.toLowerCase()) {
      case 'v': this.setActiveTool('select'); break;
      case 'h': this.setActiveTool('pan'); break;
      case 'p': this.setActiveTool('pen'); break;
      case 'r': this.setActiveTool('rectangle'); break;
      case 'o': this.setActiveTool('ellipse'); break;
      case 'l': this.setActiveTool('line'); break;
      case 'a': this.setActiveTool('arrow'); break;
      case 's': this.setActiveTool('sticky'); break;
      case 't': this.setActiveTool('text'); break;
      case 'e': this.setActiveTool('eraser'); break;
      case 'backspace':
      case 'delete':
        if (this.em) this.em.deleteSelection();
        break;
      case '[':
        if (this.em.selectedIds.size > 0 && this.cm.syncManager) {
          const id = [...this.em.selectedIds][0];
          const el = this.em.elements.get(id);
          if (el) { el.zIndex--; el.updatedAt = Date.now(); this.em._sortElements(); this.cm.requestStaticRender(); this.cm.syncManager.broadcastUpdate(el); }
        }
        break;
      case ']':
        if (this.em.selectedIds.size > 0 && this.cm.syncManager) {
          const id = [...this.em.selectedIds][0];
          const el = this.em.elements.get(id);
          if (el) { el.zIndex++; el.updatedAt = Date.now(); this.em._sortElements(); this.cm.requestStaticRender(); this.cm.syncManager.broadcastUpdate(el); }
        }
        break;
      case 'escape':
        this.em.clearSelection();
        this.cm.requestStaticRender();
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
