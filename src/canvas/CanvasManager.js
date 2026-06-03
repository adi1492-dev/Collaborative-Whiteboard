/**
 * CanvasManager — Core rendering engine.
 * Dual-canvas: Static (committed elements) + Active (tool preview, cursors, selections).
 * Fix: DPI scaling reset on every resize to prevent compounding transform.
 */
import { Transform } from './Transform.js';
import { GridRenderer } from './GridRenderer.js';

export class CanvasManager {
  constructor(container, boardId) {
    this.container = container;
    this.boardId = boardId;
    
    this.transform = new Transform();
    this.gridRenderer = new GridRenderer(this);
    this.backgroundType = 'grid';
    this.isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

    // External dependencies (injected after construction)
    this.elementManager = null;
    this.inputHandler = null;
    this.syncManager = null;
    this.textEditor = null;
    this.historyManager = null;

    this.width = 0;
    this.height = 0;
    this.needsStaticRender = true;
    this.renderLoopId = null;
    this._dpr = 1;

    this._initCanvases();
    this._bindEvents();
    this.startRenderLoop();
  }

  _initCanvases() {
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.container.style.width = '100%';
    this.container.style.height = '100%';

    this.staticCanvas = document.createElement('canvas');
    this.staticCanvas.style.cssText = 'position:absolute;top:0;left:0;';
    this.staticCtx = this.staticCanvas.getContext('2d', { alpha: false });

    this.activeCanvas = document.createElement('canvas');
    this.activeCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
    this.activeCtx = this.activeCanvas.getContext('2d');

    this.container.appendChild(this.staticCanvas);
    this.container.appendChild(this.activeCanvas);

    this.resize();
  }

  _bindEvents() {
    // Store the bound handler so we can remove it on destroy
    this._boundResize = () => this.resize();
    window.addEventListener('resize', this._boundResize);

    this._themeObserver = new MutationObserver(() => {
      this.isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
      this.requestStaticRender();
    });
    this._themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this._dpr = dpr;
    
    this.width = rect.width;
    this.height = rect.height;

    // FIX: Reset context completely before re-scaling to prevent DPI compounding
    [this.staticCanvas, this.activeCanvas].forEach(canvas => {
      canvas.width = Math.round(this.width * dpr);
      canvas.height = Math.round(this.height * dpr);
      canvas.style.width = `${this.width}px`;
      canvas.style.height = `${this.height}px`;
    });

    // Apply DPI scale fresh (getContext returns identity after resizing canvas)
    this.staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.activeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.requestStaticRender();
  }

  setBackground(type) {
    this.backgroundType = type;
    document.documentElement.setAttribute('data-canvas-bg', type);
    
    // Auto-correct text element colors for contrast
    if (this.elementManager) {
      let changed = false;
      for (const el of this.elementManager.elements.values()) {
        if (el.type === 'text') {
          // If canvas is dark and text is dark
          if ((type === 'solid-dark' || this.isDarkMode) && el.style.fillColor === '#0b1c30') {
            el.style.fillColor = '#e5e2e1';
            changed = true;
            if (this.syncManager) this.syncManager.broadcastUpdate(el);
          }
          // If canvas is light and text is light
          else if ((type === 'solid-light' || type === 'blank' || (!this.isDarkMode && type !== 'solid-dark')) && el.style.fillColor === '#e5e2e1') {
            el.style.fillColor = '#0b1c30';
            changed = true;
            if (this.syncManager) this.syncManager.broadcastUpdate(el);
          }
        }
      }
    }
    
    this.requestStaticRender();
  }

  requestStaticRender() {
    this.needsStaticRender = true;
  }

  startRenderLoop() {
    const loop = () => {
      this.render();
      this.renderLoopId = requestAnimationFrame(loop);
    };
    this.renderLoopId = requestAnimationFrame(loop);
  }

  stopRenderLoop() {
    if (this.renderLoopId) {
      cancelAnimationFrame(this.renderLoopId);
      this.renderLoopId = null;
    }
    // Remove the window resize listener (was an anonymous fn before — now stored)
    if (this._boundResize) {
      window.removeEventListener('resize', this._boundResize);
      this._boundResize = null;
    }
    // Disconnect the theme mutation observer
    if (this._themeObserver) {
      this._themeObserver.disconnect();
      this._themeObserver = null;
    }
    // Null out all cross-references so nothing can trigger cursor/sync updates
    this.syncManager = null;
    this.inputHandler = null;
    this.elementManager = null;
    this.historyManager = null;
    this.textEditor = null;
  }

  render() {
    // 1. Static layer — only re-render when dirty
    if (this.needsStaticRender) {
      // Reset to DPI-scaled identity before drawing
      this.staticCtx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
      
      let baseColor = this.isDarkMode ? '#131313' : '#f8f9ff';
      if (this.backgroundType === 'solid-dark') baseColor = '#000000';
      if (this.backgroundType === 'solid-light') baseColor = '#ffffff';

      this.staticCtx.fillStyle = baseColor;
      this.staticCtx.fillRect(0, 0, this.width, this.height);

      if (this.backgroundType !== 'blank' && this.backgroundType !== 'solid-dark' && this.backgroundType !== 'solid-light') {
        this.gridRenderer.render(this.staticCtx, this.backgroundType, this.width, this.height, this.isDarkMode);
      }

      this.transform.applyToContext(this.staticCtx);

      if (this.elementManager) {
        const bounds = this.transform.getViewportBounds(this.width, this.height);
        this.elementManager.renderStatic(this.staticCtx, bounds);
      }

      this.needsStaticRender = false;
    }

    // 2. Active layer — always clear and re-render
    this.activeCtx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    this.activeCtx.clearRect(0, 0, this.width, this.height);
    this.transform.applyToContext(this.activeCtx);

    if (this.inputHandler?.activeTool) {
      this.inputHandler.activeTool.renderActive(this.activeCtx);
    }

    if (this.elementManager) {
      this.elementManager.renderSelection(this.activeCtx, this.transform.scale);
    }

    if (this.syncManager) {
      this.syncManager.presenceSync.renderCursors(this.activeCtx, this.transform.scale);
    }
  }

  screenToCanvas(screenX, screenY) {
    return this.transform.screenToCanvas(screenX, screenY);
  }

  getPointerEventCoords(e) {
    const rect = this.container.getBoundingClientRect();
    return this.transform.screenToCanvas(e.clientX - rect.left, e.clientY - rect.top);
  }

  /** Zoom to fit all elements in view */
  zoomToFit() {
    if (!this.elementManager || this.elementManager.elements.size === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of this.elementManager.elements.values()) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }
    const padding = 80;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;
    const scaleX = this.width / contentW;
    const scaleY = this.height / contentH;
    const scale = Math.min(scaleX, scaleY, 1);
    this.transform.scale = scale;
    this.transform.panX = (this.width - contentW * scale) / 2 - (minX - padding) * scale;
    this.transform.panY = (this.height - contentH * scale) / 2 - (minY - padding) * scale;
    this.requestStaticRender();
  }
}
