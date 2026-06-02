/**
 * EraserTool — Erases elements by clicking or dragging over them.
 */
import { Tool } from './Tool.js';

export class EraserTool extends Tool {
  constructor() { 
    super('eraser'); 
  }
  
  onActivate() { 
    this.cm.container.style.cursor = 'cell'; 
  }
  
  onPointerDown(pt) { 
    this.eraseAt(pt); 
  }
  
  onPointerMove(pt, e) { 
    if (e.buttons === 1) this.eraseAt(pt); 
  }
  
  eraseAt(pt) {
    const el = this.em.getElementAt(pt.x, pt.y);
    if (el && !el.locked) {
      this.em.removeElement(el.id);
      if (this.cm.syncManager) {
        this.cm.syncManager.broadcastDelete(el.id);
      }
    }
  }
}
