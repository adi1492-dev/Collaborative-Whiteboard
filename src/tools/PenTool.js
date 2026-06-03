/**
 * PenTool — Freehand drawing.
 * Fix: Only broadcast element once it has at least 2 points (visible content).
 */
import { Tool } from './Tool.js';
import { FreehandElement } from '../elements/FreehandElement.js';

export class PenTool extends Tool {
  constructor() {
    super('pen');
    this.isDrawing = false;
    this.currentElement = null;
    this.hasBroadcastCreate = false;
    this.color = '#c0c1ff'; // Default primary
    this.strokeWidth = 3;
    // BUG-002 fix: track last absolute point for correct distance check
    this._lastAbsPt = null;
  }

  onActivate() {
    this.cm.container.style.cursor = 'crosshair';
  }

  onPointerDown(pt, e) {
    this.isDrawing = true;
    this.hasBroadcastCreate = false;
    this.em.clearSelection();

    // Create new stroke — DON'T broadcast yet (no visible content)
    this.currentElement = new FreehandElement({
      points: [{ x: pt.x, y: pt.y }],
      style: { strokeColor: this.color, strokeWidth: this.strokeWidth },
      createdBy: this.cm.syncManager ? this.cm.syncManager.userId : 'local'
    });

    // BUG-002 fix: seed the last absolute point tracker
    this._lastAbsPt = { x: pt.x, y: pt.y };
  }

  onPointerMove(pt, e) {
    if (!this.isDrawing || !this.currentElement) return;

    // BUG-002 fix: compare against the last absolute position, not a
    // re-offsetted relative point (which caused double-counting of origin).
    const dx = pt.x - (this._lastAbsPt ? this._lastAbsPt.x : pt.x);
    const dy = pt.y - (this._lastAbsPt ? this._lastAbsPt.y : pt.y);

    if (dx * dx + dy * dy > 4) { // 2px minimum distance
      this.currentElement.addPoint({ x: pt.x, y: pt.y });
      this._lastAbsPt = { x: pt.x, y: pt.y };

      if (this.cm.syncManager) {
        if (!this.hasBroadcastCreate && this.currentElement.points.length >= 2) {
          // First time we have visible content — broadcast creation
          this.cm.syncManager.broadcastCreate(this.currentElement);
          this.hasBroadcastCreate = true;
        } else if (this.hasBroadcastCreate) {
          // Subsequent updates
          this.cm.syncManager.broadcastUpdate(this.currentElement);
        }
      }
    }

    this.cm.requestStaticRender();
  }

  onPointerUp(pt, e) {
    if (this.isDrawing && this.currentElement) {
      if (this.currentElement.points.length > 1) {
        // Commit element to element manager
        this.em.setElement(this.currentElement);

        if (this.cm.syncManager) {
          if (!this.hasBroadcastCreate) {
            this.cm.syncManager.broadcastCreate(this.currentElement);
          } else {
            this.cm.syncManager.broadcastUpdate(this.currentElement);
          }
        }

        // Push to history — push() does NOT call apply(), so no double-broadcast
        const el = this.currentElement;
        if (this.cm.historyManager) {
          this.cm.historyManager.push({
            description: 'Draw stroke',
            // apply() = redo: the element was removed by undo; re-add it
            apply: () => {
              this.em.setElement(el);
              this.cm.syncManager?.broadcastCreate(el);
            },
            // revert() = undo: remove the stroke
            revert: () => {
              this.em.removeElement(el.id);
              this.cm.syncManager?.broadcastDelete(el.id);
            }
          });
        }
      } else {
        // Was just a dot, discard silently
        if (this.hasBroadcastCreate && this.cm.syncManager) {
          this.cm.syncManager.broadcastDelete(this.currentElement.id);
        }
      }

      this.isDrawing = false;
      this.currentElement = null;
      this.hasBroadcastCreate = false;
      this._lastAbsPt = null;
    }
  }

  renderActive(ctx) {
    if (this.isDrawing && this.currentElement) {
      this.currentElement.render(ctx);
    }
  }
}
