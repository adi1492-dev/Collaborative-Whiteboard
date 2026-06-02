/**
 * ShapeTool — Draws rectangles, ellipses, lines, and arrows.
 * With HistoryManager integration.
 */
import { Tool } from './Tool.js';
import { ShapeElement } from '../elements/ShapeElement.js';

export class ShapeTool extends Tool {
  constructor(shapeType = 'rectangle') {
    super(shapeType);
    this.shapeType = shapeType;
    this.isDrawing = false;
    this.startPt = null;
    this.currentElement = null;
    this.color = '#c0c1ff';
    this.fillColor = 'transparent';
    this.strokeWidth = 2;
  }

  onActivate() {
    this.cm.container.style.cursor = 'crosshair';
  }

  onPointerDown(pt, e) {
    this.isDrawing = true;
    this.startPt = { x: pt.x, y: pt.y };
    this.em.clearSelection();

    this.currentElement = new ShapeElement({
      x: pt.x,
      y: pt.y,
      width: 0,
      height: 0,
      shapeType: this.shapeType,
      style: { 
        strokeColor: this.color, 
        fillColor: this.fillColor,
        strokeWidth: this.strokeWidth 
      },
      createdBy: this.cm.syncManager ? this.cm.syncManager.userId : 'local'
    });
  }

  onPointerMove(pt, e) {
    if (!this.isDrawing || !this.currentElement || !this.startPt) return;

    if (this.shapeType === 'line' || this.shapeType === 'arrow') {
      this.currentElement.width = pt.x - this.startPt.x;
      this.currentElement.height = pt.y - this.startPt.y;
    } else {
      this.currentElement.x = Math.min(pt.x, this.startPt.x);
      this.currentElement.y = Math.min(pt.y, this.startPt.y);
      
      let w = Math.abs(pt.x - this.startPt.x);
      let h = Math.abs(pt.y - this.startPt.y);
      
      if (e.shiftKey) {
        const max = Math.max(w, h);
        w = max;
        h = max;
        if (pt.x < this.startPt.x) this.currentElement.x = this.startPt.x - w;
        if (pt.y < this.startPt.y) this.currentElement.y = this.startPt.y - h;
      }
      
      this.currentElement.width = w;
      this.currentElement.height = h;
    }
    
    // Broadcast preview to peers
    if (this.cm.syncManager && (this.currentElement.width > 2 || this.currentElement.height > 2)) {
      if (!this._broadcastedCreate) {
        this.cm.syncManager.broadcastCreate(this.currentElement);
        this._broadcastedCreate = true;
      } else {
        this.cm.syncManager.broadcastUpdate(this.currentElement);
      }
    }
    
    this.cm.requestStaticRender();
  }

  onPointerUp(pt, e) {
    if (this.isDrawing && this.currentElement) {
      if (Math.abs(this.currentElement.width) > 5 || Math.abs(this.currentElement.height) > 5) {
        this.em.setElement(this.currentElement);
        
        if (this.cm.syncManager) {
          if (!this._broadcastedCreate) {
            this.cm.syncManager.broadcastCreate(this.currentElement);
          } else {
            this.cm.syncManager.broadcastUpdate(this.currentElement);
          }
        }

        // Push to history
        const el = this.currentElement;
        if (this.cm.historyManager) {
          this.cm.historyManager.push({
            description: `Draw ${this.shapeType}`,
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
        
        this.em.select(this.currentElement.id);
        this.inputHandler.setActiveTool('select');
      } else {
        if (this._broadcastedCreate && this.cm.syncManager) {
          this.cm.syncManager.broadcastDelete(this.currentElement.id);
        }
      }
      
      this.isDrawing = false;
      this.currentElement = null;
      this.startPt = null;
      this._broadcastedCreate = false;
    }
  }

  renderActive(ctx) {
    if (this.isDrawing && this.currentElement) {
      this.currentElement.render(ctx);
    }
  }
}
