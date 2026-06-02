/**
 * ElementManager — Manages the lifecycle and rendering of all elements.
 * Handles spatial indexing (z-index sorting), selection, and deletion.
 */
export class ElementManager {
  constructor(canvasManager) {
    this.cm = canvasManager;
    this.elements = new Map(); // id -> Element
    this.sortedElements = []; // Sorted by zIndex for rendering
    this.selectedIds = new Set();
    
    // The currently active tool might be creating an element that isn't committed yet
    this.draftElement = null; 
  }

  /**
   * Add a new element or update an existing one.
   */
  setElement(element, requestRender = true) {
    this.elements.set(element.id, element);
    this._sortElements();
    if (requestRender) this.cm.requestStaticRender();
  }

  /**
   * Add multiple elements (e.g. initial load).
   */
  setElements(elementsArray) {
    elementsArray.forEach(el => this.elements.set(el.id, el));
    this._sortElements();
    this.cm.requestStaticRender();
  }

  /**
   * Remove an element by ID.
   */
  removeElement(id, requestRender = true) {
    if (this.elements.has(id)) {
      this.elements.delete(id);
      this.selectedIds.delete(id);
      this._sortElements();
      if (requestRender) this.cm.requestStaticRender();
    }
  }

  /**
   * Find the top-most element at the given coordinates.
   */
  getElementAt(x, y) {
    // Search backwards (top to bottom)
    for (let i = this.sortedElements.length - 1; i >= 0; i--) {
      const el = this.sortedElements[i];
      if (el.visible && !el.locked && el.hitTest(x, y)) {
        return el;
      }
    }
    return null;
  }

  /**
   * Render all committed elements to the static canvas.
   * Optimizes by skipping elements entirely outside the viewport bounds.
   */
  renderStatic(ctx, viewportBounds) {
    // padding for strokes and rotation
    const padding = 100;
    
    for (const el of this.sortedElements) {
      if (!el.visible) continue;
      
      // Simple frustum culling
      const elRight = el.x + el.width;
      const elBottom = el.y + el.height;
      
      if (
        elRight < viewportBounds.minX - padding ||
        el.x > viewportBounds.maxX + padding ||
        elBottom < viewportBounds.minY - padding ||
        el.y > viewportBounds.maxY + padding
      ) {
        continue; // Skip rendering, outside viewport
      }

      ctx.save();
      
      // Apply element transforms
      if (el.rotation !== 0) {
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(el.rotation);
        ctx.translate(-cx, -cy);
      }
      
      ctx.globalAlpha = el.opacity;
      
      el.render(ctx);
      
      ctx.restore();
    }
  }

  /**
   * Render selection boxes and transform handles to the active canvas.
   */
  renderSelection(ctx, currentScale) {
    if (this.selectedIds.size === 0) return;
    
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const primaryColor = isDarkMode ? '#c0c1ff' : '#3f3bbd';
    
    // Scale-invariant handle size
    const handleSize = 8 / currentScale;
    
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 1.5 / currentScale;

    for (const id of this.selectedIds) {
      const el = this.elements.get(id);
      if (!el || !el.visible) continue;

      ctx.save();
      
      if (el.rotation !== 0) {
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(el.rotation);
        ctx.translate(-cx, -cy);
      }

      // Draw bounding box
      const padding = 4 / currentScale;
      ctx.strokeRect(
        el.x - padding, 
        el.y - padding, 
        el.width + padding * 2, 
        el.height + padding * 2
      );

      // Draw handles for single selection
      if (this.selectedIds.size === 1 && !el.locked) {
        ctx.fillStyle = isDarkMode ? '#131313' : '#ffffff';
        
        const corners = [
          { x: el.x - padding, y: el.y - padding },
          { x: el.x + el.width + padding, y: el.y - padding },
          { x: el.x - padding, y: el.y + el.height + padding },
          { x: el.x + el.width + padding, y: el.y + el.height + padding }
        ];

        for (const c of corners) {
          ctx.beginPath();
          ctx.rect(c.x - handleSize/2, c.y - handleSize/2, handleSize, handleSize);
          ctx.fill();
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  // --- Selection Management ---

  select(id, clearPrevious = true) {
    if (clearPrevious) this.selectedIds.clear();
    if (this.elements.has(id)) {
      this.selectedIds.add(id);
    }
  }

  clearSelection() {
    this.selectedIds.clear();
  }

  deleteSelection() {
    const deleted = [];
    for (const id of this.selectedIds) {
      const el = this.elements.get(id);
      if (el && !el.locked) {
        this.removeElement(id, false);
        deleted.push(id);
      }
    }
    
    this.selectedIds.clear();
    
    if (deleted.length > 0) {
      this.cm.requestStaticRender();
      
      // Notify sync manager
      if (this.cm.syncManager) {
        deleted.forEach(id => this.cm.syncManager.broadcastDelete(id));
      }
    }
  }

  _sortElements() {
    this.sortedElements = Array.from(this.elements.values()).sort((a, b) => a.zIndex - b.zIndex);
  }
}
