/**
 * ShapeElement — Rectangles, Ellipses, Lines, Arrows.
 */
import { Element } from './Element.js';

export class ShapeElement extends Element {
  constructor(options = {}) {
    super(options);
    this.type = 'shape';
    this.shapeType = options.shapeType || 'rectangle';
    this.text = options.text || '';
  }

  render(ctx) {
    ctx.beginPath();
    ctx.strokeStyle = this.style.strokeColor;
    ctx.fillStyle = this.style.fillColor;
    ctx.lineWidth = this.style.strokeWidth;
    
    // For shapes, we often want to center stroke on boundary
    const hw = this.style.strokeWidth / 2;

    switch (this.shapeType) {
      case 'rectangle':
        ctx.rect(this.x + hw, this.y + hw, this.width - hw*2, this.height - hw*2);
        if (this.style.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
        break;

      case 'ellipse':
        const rx = (this.width - hw*2) / 2;
        const ry = (this.height - hw*2) / 2;
        ctx.ellipse(this.x + hw + rx, this.y + hw + ry, Math.abs(rx), Math.abs(ry), 0, 0, 2 * Math.PI);
        if (this.style.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
        break;

      case 'triangle':
        ctx.moveTo(this.x + this.width / 2, this.y + hw);
        ctx.lineTo(this.x + this.width - hw, this.y + this.height - hw);
        ctx.lineTo(this.x + hw, this.y + this.height - hw);
        ctx.closePath();
        if (this.style.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
        break;

      case 'diamond':
        ctx.moveTo(this.x + this.width / 2, this.y + hw);
        ctx.lineTo(this.x + this.width - hw, this.y + this.height / 2);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height - hw);
        ctx.lineTo(this.x + hw, this.y + this.height / 2);
        ctx.closePath();
        if (this.style.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
        break;

      case 'star':
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const outerRadius = Math.max(1, (Math.min(this.width, this.height) - hw * 2) / 2);
        const innerRadius = outerRadius / 2.5;
        let rot = Math.PI / 2 * 3;
        const step = Math.PI / 5;
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
          rot += step;
          ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
          rot += step;
        }
        ctx.closePath();
        if (this.style.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
        break;

      case 'polygon': // Hexagon
        const px = this.x + this.width / 2;
        const py = this.y + this.height / 2;
        const pr = Math.max(1, (Math.min(this.width, this.height) - hw * 2) / 2);
        let prot = Math.PI / 2 * 3;
        const pstep = Math.PI / 3;
        ctx.moveTo(px, py - pr);
        for (let i = 0; i < 6; i++) {
          ctx.lineTo(px + Math.cos(prot) * pr, py + Math.sin(prot) * pr);
          prot += pstep;
        }
        ctx.closePath();
        if (this.style.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();
        break;

      case 'line':
      case 'arrow':
        // For lines, width/height act as a vector from x,y
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.stroke();
        
        if (this.shapeType === 'arrow') {
          this._drawArrowHead(ctx, this.x, this.y, this.x + this.width, this.y + this.height);
        }
        break;
    }

    // Render text label if present
    if (this.text && this.shapeType !== 'line' && this.shapeType !== 'arrow') {
      this._renderText(ctx);
    }
  }

  _renderText(ctx) {
    const fontSize = this.style.fontSize || 14;
    const fontFamily = this.style.fontFamily || 'Inter, sans-serif';
    ctx.save();
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = this.style.textColor || this.style.strokeColor || '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 1;
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    // Word wrap for small shapes
    const maxWidth = this.width - 16;
    const words = (this.text || '').split(' ');
    let line = '';
    const lines = [];
    for (const word of words) {
      const testLine = line ? line + ' ' + word : word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }
    lines.push(line);
    const lineHeight = fontSize * 1.3;
    const totalHeight = lineHeight * lines.length;
    const startY = cy - totalHeight / 2 + lineHeight / 2;
    lines.forEach((l, i) => {
      ctx.fillText(l, cx, startY + i * lineHeight);
    });
    ctx.restore();
  }

  _drawArrowHead(ctx, x1, y1, x2, y2) {
    const headlen = 15; // length of head in pixels
    const angle = Math.atan2(y2 - y1, x2 - x1);
    
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  toJSON() {
    const data = super.toJSON();
    data.shapeType = this.shapeType;
    data.text = this.text;
    return data;
  }
}
