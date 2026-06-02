/**
 * SelectTool — Handles selecting, moving, and resizing elements.
 */
import { Tool } from './Tool.js';

export class SelectTool extends Tool {
  constructor() {
    super('select');
    this.isDragging = false;
    this.isSelecting = false;
    this.startPt = null;
    this.selectionRect = null;
    this.dragStartPositions = new Map(); // id -> {x, y}
  }

  onActivate() {
    this.cm.container.style.cursor = 'default';
  }

  onPointerDown(pt, e) {
    this.startPt = { x: pt.x, y: pt.y };
    
    // Check if we clicked on a selected element (to drag it)
    let clickedSelected = false;
    for (const id of this.em.selectedIds) {
      const el = this.em.elements.get(id);
      if (el && !el.locked && el.hitTest(pt.x, pt.y)) {
        clickedSelected = true;
        break;
      }
    }

    if (clickedSelected) {
      // Start dragging selection
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

    // Otherwise, check if we clicked on any element
    const hitEl = this.em.getElementAt(pt.x, pt.y);
    
    if (hitEl) {
      // Select it and start dragging
      if (e.shiftKey) {
        // Toggle selection
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
      // Clicked on empty space — start selection box
      if (!e.shiftKey) this.em.clearSelection();
      this.isSelecting = true;
      this.selectionRect = { x: pt.x, y: pt.y, width: 0, height: 0 };
      this.cm.requestStaticRender();
    }
  }

  onPointerMove(pt, e) {
    if (this.isDragging && this.startPt) {
      const dx = pt.x - this.startPt.x;
      const dy = pt.y - this.startPt.y;

      for (const [id, startPos] of this.dragStartPositions.entries()) {
        const el = this.em.elements.get(id);
        if (el) {
          el.x = startPos.x + dx;
          el.y = startPos.y + dy;
          el.updatedAt = Date.now();
          
          // INSTANT SYNC
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
      
      // Real-time selection update (optional, can be expensive)
      // For now, we'll just draw the box and do selection on pointer up
    } else {
      // Hover effects
      const hit = this.em.getElementAt(pt.x, pt.y);
      this.cm.container.style.cursor = hit ? (hit.locked ? 'not-allowed' : 'move') : 'default';
    }
  }

  onPointerUp(pt, e) {
    if (this.isDragging) {
      // Broadcast updates
      if (this.cm.syncManager) {
        for (const id of this.dragStartPositions.keys()) {
          const el = this.em.elements.get(id);
          if (el) {
            this.cm.syncManager.broadcastUpdate(el);
          }
        }
      }
    } else if (this.isSelecting && this.selectionRect) {
      // Find all elements inside selection box
      const sr = this.selectionRect;
      for (const el of this.em.elements.values()) {
        if (!el.visible || el.locked) continue;
        
        // Simple AABB intersection
        if (
          el.x < sr.x + sr.width &&
          el.x + el.width > sr.x &&
          el.y < sr.y + sr.height &&
          el.y + el.height > sr.y
        ) {
          this.em.selectedIds.add(el.id);
        }
      }
      this.cm.requestStaticRender();
    }

    this.isDragging = false;
    this.isSelecting = false;
    this.startPt = null;
    this.selectionRect = null;
    this.dragStartPositions.clear();
  }

  renderActive(ctx) {
    if (this.isSelecting && this.selectionRect) {
      const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
      const color = isDarkMode ? 'rgba(192, 193, 255, 0.2)' : 'rgba(63, 59, 189, 0.1)';
      const stroke = isDarkMode ? '#c0c1ff' : '#3f3bbd';
      
      ctx.fillStyle = color;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1 / this.cm.transform.scale;
      
      ctx.fillRect(this.selectionRect.x, this.selectionRect.y, this.selectionRect.width, this.selectionRect.height);
      ctx.strokeRect(this.selectionRect.x, this.selectionRect.y, this.selectionRect.width, this.selectionRect.height);
    }
  }
}
