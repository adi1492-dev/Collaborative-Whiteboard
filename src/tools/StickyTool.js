/**
 * StickyTool — Drops a sticky note on click.
 */
import { Tool } from './Tool.js';
import { StickyNote } from '../elements/StickyNote.js';

export class StickyTool extends Tool {
  constructor() {
    super('sticky');
    this.color = '#c0c1ff'; // Primary
  }

  onActivate() {
    this.cm.container.style.cursor = 'crosshair';
  }

  onPointerDown(pt, e) {
    this.em.clearSelection();

    // Standard sticky size
    const width = 160;
    const height = 160;

    // Center on click
    const sticky = new StickyNote({
      x: pt.x - width / 2,
      y: pt.y - height / 2,
      width: width,
      height: height,
      style: { fillColor: this.color },
      createdBy: this.cm.syncManager ? this.cm.syncManager.userId : 'local'
    });

    this.em.setElement(sticky);
    
    if (this.cm.syncManager) {
      this.cm.syncManager.broadcastCreate(sticky);
    }
    
    // Auto-select and switch to select tool so they can start typing/moving
    this.em.select(sticky.id);
    this.inputHandler.setActiveTool('select');
    
    // TODO: Trigger text editing mode on the sticky
  }
}
