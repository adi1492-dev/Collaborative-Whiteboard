/**
 * FreehandElement — Represents a drawn stroke (Pen tool).
 * Uses perfect freehand algorithm (or simple quadratic curves) for smooth strokes.
 */
import { Element } from './Element.js';

export class FreehandElement extends Element {
  constructor(options = {}) {
    super(options);
    this.type = 'freehand';
    
    // Array of points {x, y, pressure}
    this.points = options.points || [];
    
    // Normalize coordinates so the bounding box starts at (x,y)
    if (options.points && options.points.length > 0 && options.width === undefined) {
      this._updateBounds();
    }
  }

  addPoint(pt) {
    this.points.push(pt);
    this._updateBounds();
  }

  _updateBounds() {
    if (this.points.length === 0) return;
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const p of this.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    
    // Update origin and size, adjusting points to be relative to the new origin
    const dx = minX - this.x;
    const dy = minY - this.y;
    
    this.x = minX;
    this.y = minY;
    this.width = Math.max(1, maxX - minX);
    this.height = Math.max(1, maxY - minY);
    
    // Make points relative to new (x,y)
    for (const p of this.points) {
      p.x -= dx;
      p.y -= dy;
    }
  }

  render(ctx) {
    if (this.points.length < 2) return;

    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.style.strokeColor;
    ctx.lineWidth = this.style.strokeWidth;

    // Move to first absolute point
    ctx.moveTo(this.x + this.points[0].x, this.y + this.points[0].y);

    // Quadratic curve smoothing
    for (let i = 1; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      
      ctx.quadraticCurveTo(
        this.x + p1.x, 
        this.y + p1.y, 
        this.x + mx, 
        this.y + my
      );
    }

    // Connect last point
    const last = this.points[this.points.length - 1];
    ctx.lineTo(this.x + last.x, this.y + last.y);

    ctx.stroke();
  }

  toJSON() {
    const data = super.toJSON();
    data.points = this.points;
    return data;
  }
}
