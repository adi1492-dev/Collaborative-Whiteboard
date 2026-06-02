/**
 * TextTool — Drops a freestanding text element and opens the text editor.
 */
import { Tool } from './Tool.js';
import { TextElement } from '../elements/TextElement.js';

export class TextTool extends Tool {
  constructor() {
    super('text');
    this.fontSize = 18;
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
      width: 200,
      height: 40,
      text: '',
      style: { fillColor: color, fontSize: this.fontSize },
      createdBy: this.cm.syncManager ? this.cm.syncManager.userId : 'local'
    });

    this.em.setElement(textEl);
    
    if (this.cm.syncManager) {
      this.cm.syncManager.broadcastCreate(textEl);
    }

    // Push to history
    if (this.cm.historyManager) {
      this.cm.historyManager.push({
        description: 'Add text',
        apply: () => {
          this.em.setElement(textEl);
          this.cm.syncManager?.broadcastCreate(textEl);
        },
        revert: () => {
          this.em.removeElement(textEl.id);
          this.cm.syncManager?.broadcastDelete(textEl.id);
        }
      });
    }
    
    this.em.select(textEl.id);
    this.inputHandler.setActiveTool('select');
    
    // Open text editor immediately
    if (this.cm.textEditor) {
      setTimeout(() => this.cm.textEditor.open(textEl, this.cm.syncManager), 50);
    }
  }
}
