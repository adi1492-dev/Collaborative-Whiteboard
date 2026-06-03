/**
 * EraserTool — Erases elements by clicking or dragging over them.
 * Stores deep copies of erased elements for undo restoration.
 */
import { Tool } from './Tool.js';

export class EraserTool extends Tool {
  constructor() {
    super('eraser');
    this.erasedInSession = [];
    this._erasedIds = new Set(); // Prevent double-erase of same element in one stroke
  }

  onActivate() {
    this.cm.container.style.cursor = 'cell';
    this.erasedInSession = [];
    this._erasedIds.clear();
  }

  onDeactivate() {
    this.erasedInSession = [];
    this._erasedIds.clear();
  }

  onPointerDown(pt) {
    this.erasedInSession = [];
    this._erasedIds.clear();
    this.eraseAt(pt);
  }

  onPointerMove(pt, e) {
    if (e.buttons === 1) this.eraseAt(pt);
  }

  onPointerUp() {
    if (this.erasedInSession && this.erasedInSession.length > 0) {
      const items = [...this.erasedInSession];
      // Note: elements are ALREADY removed from canvas at this point.
      // push() does NOT call apply(), so no double-removal.
      this.cm.historyManager?.push({
        description: `Erase ${items.length} item${items.length !== 1 ? 's' : ''}`,
        // apply() = redo: elements were restored by a prior undo, re-erase them
        apply: () => {
          items.forEach(el => {
            this.em.removeElement(el.id);
            if (this.cm.syncManager) this.cm.syncManager.broadcastDelete(el.id);
          });
          this.cm.requestStaticRender();
        },
        // revert() = undo: restore erased elements back to canvas
        revert: () => {
          items.forEach(el => {
            this.em.setElement(el);
            if (this.cm.syncManager) this.cm.syncManager.broadcastCreate(el);
          });
          this.cm.requestStaticRender();
        }
      });
      this.erasedInSession = [];
      this._erasedIds.clear();
    }
  }

  eraseAt(pt) {
    const el = this.em.getElementAt(pt.x, pt.y);
    if (el && !el.locked && !this._erasedIds.has(el.id)) {
      this._erasedIds.add(el.id);

      // Deep-copy the element before deletion (needed for undo restore)
      const elCopy = this.cm.syncManager
        ? this.cm.syncManager._hydrateElement(el.toJSON())
        : el;
      if (elCopy) this.erasedInSession.push(elCopy);

      this.em.removeElement(el.id);
      if (this.cm.syncManager) {
        this.cm.syncManager.broadcastDelete(el.id);
      }
    }
  }
}
