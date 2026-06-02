/**
 * PenTool — Freehand drawing.
 */
import { Tool } from './Tool.js';
import { FreehandElement } from '../elements/FreehandElement.js';

export class PenTool extends Tool {
  constructor() {
    super('pen');
    this.isDrawing = false;
    this.currentElement = null;
    this.color = '#c0c1ff'; // Default primary
    this.strokeWidth = 3;
  }

  onActivate() {
    this.cm.container.style.cursor = 'crosshair';
  }

  onPointerDown(pt, e) {
    this.isDrawing = true;
    this.em.clearSelection();
    
    // Create new stroke
    this.currentElement = new FreehandElement({
      points: [{ x: pt.x, y: pt.y }],
      style: { strokeColor: this.color, strokeWidth: this.strokeWidth },
      createdBy: this.cm.syncManager ? this.cm.syncManager.userId : 'local'
    });
  }

  onPointerMove(pt, e) {
    if (!this.isDrawing || !this.currentElement) return;

    // Add point
    // Optimization: only add point if distance is > threshold
    const lastPt = this.currentElement.points[this.currentElement.points.length - 1];
    const dx = pt.x - lastPt.x;
    const dy = pt.y - lastPt.y;
    
    if (dx*dx + dy*dy > 4) { // 2px distance
      this.currentElement.addPoint({ x: pt.x, y: pt.y });
    }
  }

  onPointerUp(pt, e) {
    if (this.isDrawing && this.currentElement) {
      if (this.currentElement.points.length > 1) {
        // Commit element
        this.em.setElement(this.currentElement);
        
        // Broadcast
        if (this.cm.syncManager) {
          this.cm.syncManager.broadcastCreate(this.currentElement);
        }
      }
      
      this.isDrawing = false;
      this.currentElement = null;
    }
  }

  renderActive(ctx) {
    if (this.isDrawing && this.currentElement) {
      this.currentElement.render(ctx);
    }
  }
}
