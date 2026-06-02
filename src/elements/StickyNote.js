/**
 * StickyNote — A classic sticky note with text content.
 * Has a background color, slight shadow, and text wrapping.
 */
import { Element } from './Element.js';

export class StickyNote extends Element {
  constructor(options = {}) {
    super(options);
    this.type = 'sticky';
    this.text = options.text || '';
    
    // Default sticky size if not provided
    if (!options.width) this.width = 160;
    if (!options.height) this.height = 160;

    // Default sticky style
    this.style.fillColor = options.style?.fillColor || '#c0c1ff'; // Primary tone
    this.style.strokeColor = options.style?.strokeColor || 'transparent';
    this.style.fontSize = options.style?.fontSize || 14;
    this.style.textAlign = options.style?.textAlign || 'center';
  }

  render(ctx) {
    // Draw note body
    ctx.beginPath();
    ctx.fillStyle = this.style.fillColor;
    
    // Convert hex to rgba for shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 5;
    
    // Slight border radius for modern feel
    ctx.roundRect(this.x, this.y, this.width, this.height, 4);
    ctx.fill();

    // Reset shadow for text
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Draw text
    if (this.text) {
      // Auto-adjust text color based on background luminance (simplified: use dark for most stickies)
      ctx.fillStyle = '#131313'; 
      ctx.font = `${this.style.fontSize}px ${this.style.fontFamily}`;
      ctx.textAlign = this.style.textAlign;
      ctx.textBaseline = 'top';

      const padding = 16;
      let startX = this.x;
      if (this.style.textAlign === 'center') startX = this.x + this.width / 2;
      if (this.style.textAlign === 'right') startX = this.x + this.width - padding;
      if (this.style.textAlign === 'left') startX = this.x + padding;

      this._wrapText(ctx, this.text, startX, this.y + padding, this.width - padding*2, this.style.fontSize * 1.5);
    }
  }

  _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const lines = text.split('\n');
    let currentY = y;

    for (let i = 0; i < lines.length; i++) {
      const words = lines[i].split(' ');
      let line = '';

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line, x, currentY);
          line = words[n] + ' ';
          currentY += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, currentY);
      currentY += lineHeight;
    }
  }

  toJSON() {
    const data = super.toJSON();
    data.text = this.text;
    return data;
  }
}
