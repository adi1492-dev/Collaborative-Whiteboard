/**
 * SelectTool — Handles selecting, moving, and resizing elements.
 * Supports: single/multi select, drag move, corner resize, double-click to edit text.
 */
import { Tool } from './Tool.js';

const HANDLE_SIZE = 10; // pixels at scale=1, adjusted for zoom
const HANDLES = ['nw', 'ne', 'se', 'sw']; // clockwise from top-left

export class SelectTool extends Tool {
  constructor() {
    super('select');
    this.isDragging = false;
    this.isResizing = false;
    this.isSelecting = false;
    this.activeHandle = null; // 'nw'|'ne'|'se'|'sw'
    this.startPt = null;
    this.selectionRect = null;
    this.dragStartPositions = new Map(); // id -> {x, y}
    this.resizeStartState = null; // {x, y, width, height, el}
    this._lastPointerDownTime = 0;
    this._lastPointerDownEl = null;
  }

  onActivate() {
    this.cm.container.style.cursor = 'default';
  }

  /** Get which resize handle is at pointer, or null. */
  _getResizeHandle(pt) {
    if (this.em.selectedIds.size !== 1) return null;
    const el = this.em.elements.get([...this.em.selectedIds][0]);
    if (!el || el.locked) return null;

    const scale = this.cm.transform.scale;
    const hs = HANDLE_SIZE / scale;
    const pad = 4 / scale;

    const corners = {
      nw: { x: el.x - pad, y: el.y - pad },
      ne: { x: el.x + el.width + pad, y: el.y - pad },
      se: { x: el.x + el.width + pad, y: el.y + el.height + pad },
      sw: { x: el.x - pad, y: el.y + el.height + pad }
    };

    for (const [name, c] of Object.entries(corners)) {
      if (Math.abs(pt.x - c.x) <= hs && Math.abs(pt.y - c.y) <= hs) {
        return { handle: name, el, corners };
      }
    }
    return null;
  }

  onPointerDown(pt, e) {
    this.startPt = { x: pt.x, y: pt.y };

    // --- Double-click: open text editor ---
    const now = Date.now();
    const hitEl = this.em.getElementAt(pt.x, pt.y);
    if (now - this._lastPointerDownTime < 400 && this._lastPointerDownEl === hitEl) {
      if (hitEl && (hitEl.type === 'sticky' || hitEl.type === 'text' || hitEl.type === 'shape' || hitEl.type === 'ui')) {
        if (this.cm.textEditor) {
          this.cm.textEditor.open(hitEl, this.cm.syncManager);
          return;
        }
      }
    }
    this._lastPointerDownTime = now;
    this._lastPointerDownEl = hitEl;

    // --- Check resize handles ---
    const handleResult = this._getResizeHandle(pt);
    if (handleResult) {
      this.isResizing = true;
      this.activeHandle = handleResult.handle;
      const el = handleResult.el;
      this.resizeStartState = { x: el.x, y: el.y, width: el.width, height: el.height, el };
      return;
    }

    // --- Check if clicked on a selected element (to drag) ---
    let clickedSelected = false;
    for (const id of this.em.selectedIds) {
      const el = this.em.elements.get(id);
      if (el && !el.locked && el.hitTest(pt.x, pt.y)) {
        clickedSelected = true;
        break;
      }
    }

    if (clickedSelected) {
      this.isDragging = true;
      this.dragStartPositions.clear();
      for (const id of this.em.selectedIds) {
        const el = this.em.elements.get(id);
        if (el && !el.locked) {
          this.dragStartPositions.set(id, { x: el.x, y: el.y });
        }
      }
      return;
    }

    if (hitEl) {
      if (e.shiftKey) {
        if (this.em.selectedIds.has(hitEl.id)) {
          this.em.selectedIds.delete(hitEl.id);
        } else {
          this.em.selectedIds.add(hitEl.id);
        }
      } else {
        this.em.select(hitEl.id, true);
        if (!hitEl.locked) {
          this.isDragging = true;
          this.dragStartPositions.clear();
          this.dragStartPositions.set(hitEl.id, { x: hitEl.x, y: hitEl.y });
        }
      }
      this.cm.requestStaticRender();
    } else {
      if (!e.shiftKey) this.em.clearSelection();
      this.isSelecting = true;
      this.selectionRect = { x: pt.x, y: pt.y, width: 0, height: 0 };
      this.cm.requestStaticRender();
    }
  }

  onPointerMove(pt, e) {
    if (this.isResizing && this.resizeStartState && this.startPt) {
      const { el, x: ox, y: oy, width: ow, height: oh } = this.resizeStartState;
      const dx = pt.x - this.startPt.x;
      const dy = pt.y - this.startPt.y;
      const h = this.activeHandle;

      // Calculate new bounds based on which handle is dragged
      let nx = ox, ny = oy, nw = ow, nh = oh;

      if (h === 'nw') { nx = ox + dx; ny = oy + dy; nw = ow - dx; nh = oh - dy; }
      else if (h === 'ne') { ny = oy + dy; nw = ow + dx; nh = oh - dy; }
      else if (h === 'se') { nw = ow + dx; nh = oh + dy; }
      else if (h === 'sw') { nx = ox + dx; nw = ow - dx; nh = oh + dy; }

      // Enforce minimum size
      if (nw < 10) { nw = 10; if (h === 'nw' || h === 'sw') nx = ox + ow - 10; }
      if (nh < 10) { nh = 10; if (h === 'nw' || h === 'ne') ny = oy + oh - 10; }

      // Aspect ratio lock with shift
      if (e.shiftKey && ow > 0 && oh > 0) {
        const ratio = ow / oh;
        if (Math.abs(nw - ow) > Math.abs(nh - oh)) {
          nh = nw / ratio;
        } else {
          nw = nh * ratio;
        }
      }

      el.x = nx; el.y = ny; el.width = nw; el.height = nh;
      el.updatedAt = Date.now();
      this.cm.requestStaticRender();

      if (this.cm.syncManager) {
        this.cm.syncManager.broadcastUpdate(el);
      }
      return;
    }

    if (this.isDragging && this.startPt) {
      const dx = pt.x - this.startPt.x;
      const dy = pt.y - this.startPt.y;

      for (const [id, startPos] of this.dragStartPositions.entries()) {
        const el = this.em.elements.get(id);
        if (el) {
          el.x = startPos.x + dx;
          el.y = startPos.y + dy;
          el.updatedAt = Date.now();
          if (this.cm.syncManager) {
            this.cm.syncManager.broadcastUpdate(el);
          }
        }
      }
      this.cm.requestStaticRender();
    } else if (this.isSelecting && this.startPt) {
      this.selectionRect = {
        x: Math.min(pt.x, this.startPt.x),
        y: Math.min(pt.y, this.startPt.y),
        width: Math.abs(pt.x - this.startPt.x),
        height: Math.abs(pt.y - this.startPt.y)
      };
      this.cm.requestStaticRender();
    } else {
      // Hover cursor feedback
      const handleResult = this._getResizeHandle(pt);
      if (handleResult) {
        const cursors = { nw: 'nwse-resize', ne: 'nesw-resize', se: 'nwse-resize', sw: 'nesw-resize' };
        this.cm.container.style.cursor = cursors[handleResult.handle];
      } else {
        const hit = this.em.getElementAt(pt.x, pt.y);
        this.cm.container.style.cursor = hit ? (hit.locked ? 'not-allowed' : 'move') : 'default';
      }
    }
  }

  onPointerUp(pt, e) {
    if (this.isResizing && this.resizeStartState) {
      const { el } = this.resizeStartState;
      if (this.cm.syncManager) {
        this.cm.syncManager.broadcastUpdate(el);
      }
      // Push resize to history — push() doesn't call apply(), just records it
      if (this.cm.historyManager) {
        const prev = {
          x: this.resizeStartState.x,
          y: this.resizeStartState.y,
          width: this.resizeStartState.width,
          height: this.resizeStartState.height
        };
        const next = { x: el.x, y: el.y, width: el.width, height: el.height };
        this.cm.historyManager.push({
          description: 'Resize element',
          // apply = redo: re-apply the resize after an undo
          apply: () => { Object.assign(el, next); el.updatedAt = Date.now(); this.cm.requestStaticRender(); this.cm.syncManager?.broadcastUpdate(el); },
          // revert = undo: restore pre-resize dimensions
          revert: () => { el.x = prev.x; el.y = prev.y; el.width = prev.width; el.height = prev.height; el.updatedAt = Date.now(); this.cm.requestStaticRender(); this.cm.syncManager?.broadcastUpdate(el); }
        });
      }
    } else if (this.isDragging) {
      if (this.cm.syncManager) {
        for (const id of this.dragStartPositions.keys()) {
          const el = this.em.elements.get(id);
          if (el) this.cm.syncManager.broadcastUpdate(el);
        }
      }
      // Push move to history — push() doesn't call apply(), just records it
      if (this.cm.historyManager && this.dragStartPositions.size > 0) {
        const moved = new Map([...this.dragStartPositions]);
        const after = new Map();
        for (const [id] of moved) {
          const el = this.em.elements.get(id);
          if (el) after.set(id, { x: el.x, y: el.y });
        }
        this.cm.historyManager.push({
          description: 'Move element(s)',
          // apply = redo: re-move after undo
          apply: () => { for (const [id, pos] of after) { const el = this.em.elements.get(id); if (el) { el.x = pos.x; el.y = pos.y; el.updatedAt = Date.now(); this.cm.syncManager?.broadcastUpdate(el); } } this.cm.requestStaticRender(); },
          // revert = undo: restore previous positions
          revert: () => { for (const [id, pos] of moved) { const el = this.em.elements.get(id); if (el) { el.x = pos.x; el.y = pos.y; el.updatedAt = Date.now(); this.cm.syncManager?.broadcastUpdate(el); } } this.cm.requestStaticRender(); }
        });
      }
    } else if (this.isSelecting && this.selectionRect) {
      const sr = this.selectionRect;
      for (const el of this.em.elements.values()) {
        if (!el.visible || el.locked) continue;
        if (el.x < sr.x + sr.width && el.x + el.width > sr.x &&
            el.y < sr.y + sr.height && el.y + el.height > sr.y) {
          this.em.selectedIds.add(el.id);
        }
      }
      this.cm.requestStaticRender();
    }

    this.isDragging = false;
    this.isResizing = false;
    this.isSelecting = false;
    this.activeHandle = null;
    this.startPt = null;
    this.selectionRect = null;
    this.dragStartPositions.clear();
    this.resizeStartState = null;
  }

  renderActive(ctx) {
    if (this.isSelecting && this.selectionRect) {
      const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
      ctx.fillStyle = isDarkMode ? 'rgba(192, 193, 255, 0.12)' : 'rgba(63, 59, 189, 0.08)';
      ctx.strokeStyle = isDarkMode ? '#c0c1ff' : '#3f3bbd';
      ctx.lineWidth = 1 / this.cm.transform.scale;
      ctx.setLineDash([4 / this.cm.transform.scale, 4 / this.cm.transform.scale]);
      ctx.fillRect(this.selectionRect.x, this.selectionRect.y, this.selectionRect.width, this.selectionRect.height);
      ctx.strokeRect(this.selectionRect.x, this.selectionRect.y, this.selectionRect.width, this.selectionRect.height);
      ctx.setLineDash([]);
    }
  }
}
