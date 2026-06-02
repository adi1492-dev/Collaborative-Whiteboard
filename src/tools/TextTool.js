/**
 * TextTool — Drops a freestanding text element on click.
 */
import { Tool } from './Tool.js';
import { TextElement } from '../elements/TextElement.js';

export class TextTool extends Tool {
  constructor() {
    super('text');
  }

  onActivate() {
    this.cm.container.style.cursor = 'text';
  }

  onPointerDown(pt, e) {
    this.em.clearSelection();

    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const color = isDarkMode ? '#e5e2e1' : '#0b1c30';

    const textEl = new TextElement({
      x: pt.x,
      y: pt.y,
      text: 'Text',
      style: { fillColor: color },
      createdBy: this.cm.syncManager ? this.cm.syncManager.userId : 'local'
    });

    this.em.setElement(textEl);
    
    if (this.cm.syncManager) {
      this.cm.syncManager.broadcastCreate(textEl);
    }
    
    this.em.select(textEl.id);
    this.inputHandler.setActiveTool('select');
    
    // TODO: Trigger text editing mode
  }
}
