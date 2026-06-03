/**
 * FreehandElement — Represents a drawn stroke (Pen tool).
 * Uses quadratic curves for smooth strokes with running-bounds optimization.
 */
import { Element } from './Element.js';

export class FreehandElement extends Element {
  constructor(options = {}) {
    super(options);
    this.type = 'freehand';

    // Array of points {x, y} relative to element origin
    this.points = options.points || [];

    // BUG-017 fix: use proper sentinels so the very first addPoint() always
    // updates the bounds correctly regardless of element origin offset.
    // These are reset properly during _recomputeBounds() on hydration.
    this._minX = Infinity;
    this._minY = Infinity;
    this._maxX = -Infinity;
    this._maxY = -Infinity;

    if (options.points && options.points.length > 0 && options.width === undefined) {
      this._recomputeBounds(); // Full scan only on initial hydration
    } else if (options.width !== undefined) {
      // Already hydrated with known bounds — init sentinels from existing size
      this._minX = 0;
      this._minY = 0;
      this._maxX = options.width || 1;
      this._maxY = options.height || 1;
    }
  }

  addPoint(absolutePt) {
    // Store relative to element origin (this.x, this.y)
    const relPt = {
      x: absolutePt.x - this.x,
      y: absolutePt.y - this.y
    };
    this.points.push(relPt);

    // Incrementally update running bounds — O(1) per point
    if (relPt.x < this._minX) this._minX = relPt.x;
    if (relPt.y < this._minY) this._minY = relPt.y;
    if (relPt.x > this._maxX) this._maxX = relPt.x;
    if (relPt.y > this._maxY) this._maxY = relPt.y;

    // If minX/minY shifted negative, re-anchor origin
    if (this._minX < 0 || this._minY < 0) {
      const shiftX = this._minX;
      const shiftY = this._minY;
      this.x += shiftX;
      this.y += shiftY;
      for (const p of this.points) { p.x -= shiftX; p.y -= shiftY; }
      this._maxX -= shiftX;
      this._maxY -= shiftY;
      this._minX = 0;
      this._minY = 0;
    }

    this.width = Math.max(1, this._maxX);
    this.height = Math.max(1, this._maxY);
  }

  /** Full O(n) bounds recompute — used only on hydration from JSON. */
  _recomputeBounds() {
    if (this.points.length === 0) return;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of this.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    
    if (minX !== 0 || minY !== 0) {
      this.x += minX;
      this.y += minY;
      for (const p of this.points) { p.x -= minX; p.y -= minY; }
      maxX -= minX;
      maxY -= minY;
    }
    
    this._minX = 0;
    this._minY = 0;
    this._maxX = maxX;
    this._maxY = maxY;
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

    ctx.moveTo(this.x + this.points[0].x, this.y + this.points[0].y);

    for (let i = 1; i < this.points.length - 2; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(this.x + p1.x, this.y + p1.y, this.x + mx, this.y + my);
    }

    const n = this.points.length;
    if (n >= 2) {
      const p = this.points[n - 2];
      const last = this.points[n - 1];
      ctx.quadraticCurveTo(this.x + p.x, this.y + p.y, this.x + last.x, this.y + last.y);
    }

    ctx.stroke();
  }

  hitTest(x, y) {
    const padding = Math.max(10, this.style.strokeWidth);
    if (x < this.x - padding || x > this.x + this.width + padding ||
        y < this.y - padding || y > this.y + this.height + padding) {
      return false;
    }

    for (let i = 0; i < this.points.length - 1; i++) {
      const p1 = this.points[i];
      const p2 = this.points[i + 1];
      const ax = this.x + p1.x, ay = this.y + p1.y;
      const bx = this.x + p2.x, by = this.y + p2.y;
      const l2 = (bx - ax) ** 2 + (by - ay) ** 2;
      let dist;
      if (l2 === 0) {
        dist = Math.hypot(x - ax, y - ay);
      } else {
        let t = ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / l2;
        t = Math.max(0, Math.min(1, t));
        dist = Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
      }
      if (dist <= padding) return true;
    }
    return false;
  }

  toJSON() {
    const data = super.toJSON();
    data.points = this.points;
    return data;
  }
}
