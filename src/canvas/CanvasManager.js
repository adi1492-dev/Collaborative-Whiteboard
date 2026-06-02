/**
 * CanvasManager — Core rendering engine.
 * Uses a dual-canvas approach:
 * 1. Static canvas (bottom): For committed elements (drawn infrequently)
 * 2. Active canvas (top): For the element currently being drawn/dragged, selection box, remote cursors (drawn every frame)
 */
import { Transform } from './Transform.js';
import { GridRenderer } from './GridRenderer.js';
// InputHandler and ElementManager will be injected or imported

export class CanvasManager {
  constructor(container, boardId) {
    this.container = container;
    this.boardId = boardId;
    
    // Core components
    this.transform = new Transform();
    this.gridRenderer = new GridRenderer(this);
    this.backgroundType = 'grid'; // Default
    this.isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

    // External dependencies (injected)
    this.elementManager = null;
    this.inputHandler = null;
    this.syncManager = null;

    // State
    this.width = 0;
    this.height = 0;
    this.needsStaticRender = true;
    this.renderLoopId = null;

    this._initCanvases();
    this._bindEvents();
    this.startRenderLoop();
  }

  _initCanvases() {
    this.container.style.position = 'relative';
    this.container.style.overflow = 'hidden';
    this.container.style.width = '100%';
    this.container.style.height = '100%';

    // Static canvas (Background + committed elements)
    this.staticCanvas = document.createElement('canvas');
    this.staticCanvas.style.position = 'absolute';
    this.staticCanvas.style.top = '0';
    this.staticCanvas.style.left = '0';
    this.staticCtx = this.staticCanvas.getContext('2d', { alpha: false });

    // Active canvas (Current tool + cursors)
    this.activeCanvas = document.createElement('canvas');
    this.activeCanvas.style.position = 'absolute';
    this.activeCanvas.style.top = '0';
    this.activeCanvas.style.left = '0';
    this.activeCanvas.style.pointerEvents = 'none'; // Let events pass to the container overlay if needed, or handle directly
    this.activeCtx = this.activeCanvas.getContext('2d');

    this.container.appendChild(this.staticCanvas);
    this.container.appendChild(this.activeCanvas);

    this.resize();
  }

  _bindEvents() {
    window.addEventListener('resize', () => this.resize());
    
    // Listen for theme changes to trigger re-render
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          this.isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
          this.requestStaticRender();
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.width = rect.width;
    this.height = rect.height;

    // Setup High-DPI support
    [this.staticCanvas, this.activeCanvas].forEach(canvas => {
      canvas.width = this.width * dpr;
      canvas.height = this.height * dpr;
      canvas.style.width = `${this.width}px`;
      canvas.style.height = `${this.height}px`;
    });

    [this.staticCtx, this.activeCtx].forEach(ctx => {
      ctx.scale(dpr, dpr);
    });

    this.requestStaticRender();
  }

  setBackground(type) {
    this.backgroundType = type;
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
    }
  }

  render() {
    // 1. Render static layer if dirty (or zoomed/panned)
    if (this.needsStaticRender) {
      // Reset transform before clearing so we clear the whole screen
      this.transform.resetContext(this.staticCtx);
      
      // Clear with background color based on theme
      this.staticCtx.fillStyle = this.isDarkMode ? '#131313' : '#f8f9ff';
      this.staticCtx.fillRect(0, 0, this.width, this.height);

      // Draw grid
      this.gridRenderer.render(this.staticCtx, this.backgroundType, this.width, this.height, this.isDarkMode);

      // Apply transform for elements
      this.transform.applyToContext(this.staticCtx);

      // Draw all committed elements
      if (this.elementManager) {
        // Optimize: cull elements outside viewport
        const bounds = this.transform.getViewportBounds(this.width, this.height);
        this.elementManager.renderStatic(this.staticCtx, bounds);
      }

      this.needsStaticRender = false;
    }

    // 2. Always clear and render active layer
    this.activeCtx.clearRect(0, 0, this.width, this.height);
    this.transform.applyToContext(this.activeCtx);

    // Draw active tool preview (e.g. dragging a box)
    if (this.inputHandler && this.inputHandler.activeTool) {
      this.inputHandler.activeTool.renderActive(this.activeCtx);
    }

    // Draw selection outlines/handles
    if (this.elementManager) {
      this.elementManager.renderSelection(this.activeCtx, this.transform.scale);
    }

    // Draw remote cursors (if sync manager is attached)
    if (this.syncManager) {
      this.syncManager.presenceSync.renderCursors(this.activeCtx, this.transform.scale);
    }
    
    // Reset transform on active context to avoid compounding
    this.transform.resetContext(this.activeCtx);
  }

  // --- Convenience coordinate conversion methods ---

  screenToCanvas(screenX, screenY) {
    return this.transform.screenToCanvas(screenX, screenY);
  }

  getPointerEventCoords(e) {
    const rect = this.container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    return this.transform.screenToCanvas(screenX, screenY);
  }
}
