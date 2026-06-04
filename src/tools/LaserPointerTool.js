/**
 * LaserPointerTool — Draws a temporary fading trail synced to other users.
 * Does not create permanent elements on the canvas.
 */
import { Tool } from './Tool.js';

export class LaserPointerTool extends Tool {
  constructor() {
    super('laser');
    this.isDrawing = false;
  }

  onActivate() {
    this.cm.container.style.cursor = 'crosshair';
  }

  onPointerDown(pt, e) {
    this.isDrawing = true;
    this.em.clearSelection();
    if (this.cm.syncManager && this.cm.syncManager.presenceSync) {
      this.cm.syncManager.presenceSync.sendLaserPoint(pt.x, pt.y);
    }
  }

  onPointerMove(pt, e) {
    if (!this.isDrawing) return;
    if (this.cm.syncManager && this.cm.syncManager.presenceSync) {
      this.cm.syncManager.presenceSync.sendLaserPoint(pt.x, pt.y);
    }
  }

  onPointerUp(pt, e) {
    this.isDrawing = false;
  }
}
