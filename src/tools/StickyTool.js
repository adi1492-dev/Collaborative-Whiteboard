/**
 * StickyTool — Drops a sticky note on click and opens text editor.
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

    const width = 200;
    const height = 200;

    // Snap colors from a sticky palette
    const stickyColors = ['#c0c1ff', '#4cd7f6', '#ffb2b7', '#ffd6a5', '#caffbf', '#fdffb6'];
    const sticky = new StickyNote({
      x: pt.x - width / 2,
      y: pt.y - height / 2,
      width,
      height,
      style: { fillColor: this.color },
      createdBy: this.cm.syncManager ? this.cm.syncManager.userId : 'local'
    });

    this.em.setElement(sticky);
    
    if (this.cm.syncManager) {
      this.cm.syncManager.broadcastCreate(sticky);
    }

    // Push to history
    if (this.cm.historyManager) {
      this.cm.historyManager.push({
        description: 'Add sticky note',
        apply: () => {
          this.em.setElement(sticky);
          this.cm.syncManager?.broadcastCreate(sticky);
        },
        revert: () => {
          this.em.removeElement(sticky.id);
          this.cm.syncManager?.broadcastDelete(sticky.id);
        }
      });
    }
    
    this.em.select(sticky.id);
    this.inputHandler.setActiveTool('select');
    
    // Open text editor immediately
    if (this.cm.textEditor) {
      setTimeout(() => this.cm.textEditor.open(sticky, this.cm.syncManager), 50);
    }
  }
}
