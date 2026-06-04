/**
 * FrameElement — Represents an artboard or logical group boundary.
 * Renders as a crisp outlined box with a label at the top left.
 */
import { Element } from './Element.js';

export class FrameElement extends Element {
  constructor(options = {}) {
    super(options);
    this.type = 'frame';
    this.title = options.title || 'Frame';
    
    // Default style
    this.style.strokeColor = options.style?.strokeColor || '#9ca3af';
    this.style.fillColor = options.style?.fillColor || 'transparent';
    this.style.strokeWidth = options.style?.strokeWidth || 1;
    
    // Ensure it falls to back inherently, though zIndex will handle this
    this.zIndex = options.zIndex || -100;
  }

  render(ctx) {
    ctx.save();
    
    // Draw background/border
    ctx.beginPath();
    ctx.rect(this.x, this.y, this.width, this.height);
    if (this.style.fillColor !== 'transparent') {
      ctx.fillStyle = this.style.fillColor;
      ctx.fill();
    }
    ctx.strokeStyle = this.style.strokeColor;
    ctx.lineWidth = this.style.strokeWidth;
    ctx.setLineDash([0]); // Solid crisp line for frames
    ctx.stroke();

    // Draw Title (Figma style, top left outside/inside edge)
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.font = '500 12px Inter, sans-serif';
    ctx.fillStyle = this.style.strokeColor !== 'transparent' ? this.style.strokeColor : (isDark ? '#e5e2e1' : '#0b1c30');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    
    // Truncate title if it's too long
    let displayTitle = this.title;
    if (ctx.measureText(displayTitle).width > this.width) {
      displayTitle = displayTitle.substring(0, 15) + '...';
    }
    
    ctx.fillText(displayTitle, this.x, this.y - 4);
    
    ctx.restore();
  }

  toJSON() {
    const data = super.toJSON();
    data.title = this.title;
    return data;
  }
}
