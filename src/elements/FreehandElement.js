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
    // Convert absolute pt to relative, based on CURRENT this.x, this.y
    const relPt = {
      x: pt.x - this.x,
      y: pt.y - this.y
    };
    this.points.push(relPt);
    this._updateBounds();
  }

  _updateBounds() {
    if (this.points.length === 0) return;
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    // Find bounds of RELATIVE points
    for (const p of this.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    
    // If the new points cause the origin to shift (e.g. minX < 0)
    // We adjust the origin and all points so that the minimum is exactly at 0,0
    if (minX !== 0 || minY !== 0) {
      this.x += minX;
      this.y += minY;
      
      // Shift all points so the minimum is at 0,0
      for (const p of this.points) {
        p.x -= minX;
        p.y -= minY;
      }
      
      // Update max after shift
      maxX -= minX;
      maxY -= minY;
    }
    
    this.width = Math.max(1, maxX);
    this.height = Math.max(1, maxY);
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

    // Smooth curve algorithm (using midpoints)
    let i;
    for (i = 1; i < this.points.length - 2; i++) {
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
    if (i < this.points.length - 1) {
      const p = this.points[i];
      const last = this.points[this.points.length - 1];
      ctx.quadraticCurveTo(
        this.x + p.x, 
        this.y + p.y, 
        this.x + last.x, 
        this.y + last.y
      );
    } else {
      const last = this.points[this.points.length - 1];
      ctx.lineTo(this.x + last.x, this.y + last.y);
    }

    ctx.stroke();
  }

  hitTest(x, y) {
    // Fast path: bounding box
    const padding = Math.max(10, this.style.strokeWidth);
    if (x < this.x - padding || x > this.x + this.width + padding ||
        y < this.y - padding || y > this.y + this.height + padding) {
      return false;
    }

    // Precise path: segment distance
    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i+1];
      const ax = this.x + p1.x;
      const ay = this.y + p1.y;
      const bx = this.x + p2.x;
      const by = this.y + p2.y;

      const l2 = (bx - ax) ** 2 + (by - ay) ** 2;
      let dist;
      if (l2 === 0) {
        dist = Math.hypot(x - ax, y - ay);
      } else {
        let t = ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projX = ax + t * (bx - ax);
        const projY = ay + t * (by - ay);
        dist = Math.hypot(x - projX, y - projY);
      }

      if (dist <= padding) {
        return true;
      }
    }
    return false;
  }

  toJSON() {
    const data = super.toJSON();
    data.points = this.points;
    return data;
  }
}
