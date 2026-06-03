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
    this.erasedInSession = [];
  }
  
  onPointerDown(pt) { 
    this.erasedInSession = [];
    this.eraseAt(pt); 
  }
  
  onPointerMove(pt, e) { 
    if (e.buttons === 1) this.eraseAt(pt); 
  }
  
  onPointerUp() {
    if (this.erasedInSession && this.erasedInSession.length > 0) {
      const items = [...this.erasedInSession];
      this.cm.historyManager?.push({
        description: `Erase ${items.length} items`,
        apply: () => {
          items.forEach(el => {
            this.em.removeElement(el.id);
            if (this.cm.syncManager) this.cm.syncManager.broadcastDelete(el.id);
          });
          this.cm.requestStaticRender();
        },
        revert: () => {
          items.forEach(el => {
            this.em.setElement(el);
            if (this.cm.syncManager) this.cm.syncManager.broadcastCreate(el);
          });
          this.cm.requestStaticRender();
        }
      });
      this.erasedInSession = [];
    }
  }
  
  eraseAt(pt) {
    const el = this.em.getElementAt(pt.x, pt.y);
    if (el && !el.locked) {
      // Create a deep copy of the element before deleting it
      const elCopy = this.cm.syncManager ? this.cm.syncManager._hydrateElement(el.toJSON()) : el;
      if (elCopy) this.erasedInSession.push(elCopy);
      
      this.em.removeElement(el.id);
      if (this.cm.syncManager) {
        this.cm.syncManager.broadcastDelete(el.id);
      }
    }
  }
}
