/**
 * FrameTool — Drags to create a FrameElement boundary.
 */
import { Tool } from './Tool.js';
import { FrameElement } from '../elements/FrameElement.js';

export class FrameTool extends Tool {
  constructor() {
    super('frame');
    this.isDrawing = false;
    this.startPt = null;
    this.currentElement = null;
  }

  onActivate() {
    this.cm.container.style.cursor = 'crosshair';
  }

  onPointerDown(pt, e) {
    this.isDrawing = true;
    this.startPt = { x: pt.x, y: pt.y };
    this.em.clearSelection();

    this.currentElement = new FrameElement({
      x: pt.x,
      y: pt.y,
      width: 0,
      height: 0,
      createdBy: this.cm.syncManager ? this.cm.syncManager.userId : 'local'
    });
  }

  onPointerMove(pt, e) {
    if (!this.isDrawing || !this.currentElement) return;

    const x = Math.min(pt.x, this.startPt.x);
    const y = Math.min(pt.y, this.startPt.y);
    const w = Math.abs(pt.x - this.startPt.x);
    const h = Math.abs(pt.y - this.startPt.y);

    this.currentElement.x = x;
    this.currentElement.y = y;
    this.currentElement.width = w;
    this.currentElement.height = h;

    this.cm.requestStaticRender();
  }

  onPointerUp(pt, e) {
    if (this.isDrawing && this.currentElement) {
      if (this.currentElement.width > 20 && this.currentElement.height > 20) {
        this.em.setElement(this.currentElement);
        if (this.cm.syncManager) {
          this.cm.syncManager.broadcastCreate(this.currentElement);
        }

        const el = this.currentElement;
        if (this.cm.historyManager) {
          this.cm.historyManager.push({
            description: 'Add frame',
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
        
        // Select it immediately
        this.em.select(el.id);
        this.inputHandler.setActiveTool('select');
      }

      this.isDrawing = false;
      this.currentElement = null;
      this.startPt = null;
    }
  }

  renderActive(ctx) {
    if (this.isDrawing && this.currentElement) {
      this.currentElement.render(ctx);
    }
  }
}
