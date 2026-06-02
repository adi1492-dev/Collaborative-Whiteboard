/**
 * ShapeElement — Rectangles, Ellipses, Lines, Arrows.
 */
import { Element } from './Element.js';

export class ShapeElement extends Element {
  constructor(options = {}) {
    super(options);
    this.type = 'shape';
    this.shapeType = options.shapeType || 'rectangle'; // rectangle, ellipse, line, arrow
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
    return data;
  }
}
