/**
 * HighlighterTool — Freehand drawing with a thick, translucent stroke.
 */
import { Tool } from './Tool.js';
import { FreehandElement } from '../elements/FreehandElement.js';

export class HighlighterTool extends Tool {
  constructor() {
    super('highlighter');
    this.isDrawing = false;
    this.currentElement = null;
    this.hasBroadcastCreate = false;
    this.color = '#ffd166'; // Default highlighter yellow
    this.strokeWidth = 24;
    this._lastAbsPt = null;
  }

  onActivate() {
    this.cm.container.style.cursor = 'crosshair';
  }

  onPointerDown(pt, e) {
    this.isDrawing = true;
    this.hasBroadcastCreate = false;
    this.em.clearSelection();

    // Create new stroke with 0.4 opacity
    this.currentElement = new FreehandElement({
      points: [{ x: pt.x, y: pt.y }],
      style: { strokeColor: this.color, strokeWidth: this.strokeWidth },
      opacity: 0.4,
      createdBy: this.cm.syncManager ? this.cm.syncManager.userId : 'local'
    });

    this._lastAbsPt = { x: pt.x, y: pt.y };
  }

  onPointerMove(pt, e) {
    if (!this.isDrawing || !this.currentElement) return;

    const dx = pt.x - (this._lastAbsPt ? this._lastAbsPt.x : pt.x);
    const dy = pt.y - (this._lastAbsPt ? this._lastAbsPt.y : pt.y);

    if (dx * dx + dy * dy > 4) {
      this.currentElement.addPoint({ x: pt.x, y: pt.y });
      this._lastAbsPt = { x: pt.x, y: pt.y };

      if (this.cm.syncManager) {
        if (!this.hasBroadcastCreate && this.currentElement.points.length >= 2) {
          this.cm.syncManager.broadcastCreate(this.currentElement);
          this.hasBroadcastCreate = true;
        } else if (this.hasBroadcastCreate) {
          this.cm.syncManager.broadcastUpdate(this.currentElement);
        }
      }
    }

    this.cm.requestStaticRender();
  }

  onPointerUp(pt, e) {
    if (this.isDrawing && this.currentElement) {
      if (this.currentElement.points.length > 1) {
        this.em.setElement(this.currentElement);

        if (this.cm.syncManager) {
          if (!this.hasBroadcastCreate) {
            this.cm.syncManager.broadcastCreate(this.currentElement);
          } else {
            this.cm.syncManager.broadcastUpdate(this.currentElement);
          }
        }

        const el = this.currentElement;
        if (this.cm.historyManager) {
          this.cm.historyManager.push({
            description: 'Draw highlight',
            apply: () => {
              this.em.setElement(el);
              this.cm.syncManager?.broadcastCreate(el);
            },
            revert: () => {
              this.em.removeElement(el.id);
              this.cm.syncManager?.broadcastDelete(el.id);
            }
          });
        }
      } else {
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
