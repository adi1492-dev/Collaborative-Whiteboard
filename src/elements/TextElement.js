/**
 * TextElement — Freestanding text without a background.
 */
import { Element } from './Element.js';

export class TextElement extends Element {
  constructor(options = {}) {
    super(options);
    this.type = 'text';
    this.text = options.text || '';
    
    // Inherit text color from theme and canvas background
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const canvasBg = document.documentElement.getAttribute('data-canvas-bg') || 'grid';
    let defaultColor = isDarkMode ? '#e5e2e1' : '#0b1c30';
    if (canvasBg === 'solid-dark') defaultColor = '#e5e2e1';
    if (canvasBg === 'solid-light') defaultColor = '#0b1c30';
    
    this.style.fillColor = options.style?.fillColor || defaultColor;
    this.style.fontSize = options.style?.fontSize || 24;
    
    if (!options.width) this.width = 200;
    if (!options.height) this.height = this.style.fontSize * 1.5;
  }

  render(ctx) {
    if (!this.text) return;

    ctx.fillStyle = this.style.fillColor;
    ctx.font = `${this.style.fontSize}px ${this.style.fontFamily}`;
    ctx.textAlign = this.style.textAlign;
    ctx.textBaseline = 'top';

    const lines = this.text.split('\n');
    const lineHeight = this.style.fontSize * 1.2;
    
    let x = this.x;
    if (this.style.textAlign === 'center') x = this.x + this.width / 2;
    if (this.style.textAlign === 'right') x = this.x + this.width;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, this.y + (i * lineHeight));
    }
  }

  toJSON() {
    const data = super.toJSON();
    data.text = this.text;
    return data;
  }
}
