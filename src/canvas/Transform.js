/**
 * Transform — Handles coordinate space transformations for pan and zoom.
 * Converts between screen coordinates (viewport) and canvas coordinates (world).
 */
export class Transform {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.scale = 1;
    this.minScale = 0.1;
    this.maxScale = 5;
  }

  /**
   * Convert screen coordinates to canvas world coordinates.
   */
  screenToCanvas(screenX, screenY) {
    return {
      x: (screenX - this.x) / this.scale,
      y: (screenY - this.y) / this.scale
    };
  }

  /**
   * Convert canvas world coordinates to screen coordinates.
   */
  canvasToScreen(canvasX, canvasY) {
    return {
      x: (canvasX * this.scale) + this.x,
      y: (canvasY * this.scale) + this.y
    };
  }

  /**
   * Pan the canvas by a delta amount.
   */
  panBy(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  /**
   * Pan the canvas to a specific coordinate.
   */
  panTo(x, y) {
    this.x = x;
    this.y = y;
  }

  /**
   * Zoom centered on a specific screen point.
   */
  zoom(deltaScale, centerX, centerY) {
    const oldScale = this.scale;
    let newScale = this.scale + deltaScale;
    
    // Clamp scale
    newScale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
    
    if (newScale === oldScale) return false; // No change

    // Adjust translation so the zoom is centered on the cursor
    const scaleRatio = newScale / oldScale;
    this.x = centerX - (centerX - this.x) * scaleRatio;
    this.y = centerY - (centerY - this.y) * scaleRatio;
    this.scale = newScale;

    return true; // Transform changed
  }
  
  /**
   * Set absolute zoom level centered on a point.
   */
  setZoom(newScale, centerX, centerY) {
    return this.zoom(newScale - this.scale, centerX, centerY);
  }

  /**
   * Apply transform to a canvas context.
   */
  applyToContext(ctx) {
    ctx.setTransform(this.scale, 0, 0, this.scale, this.x, this.y);
  }

  /**
   * Reset context transform to identity.
   */
  resetContext(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /**
   * Get bounding box of the visible viewport in canvas coordinates.
   */
  getViewportBounds(width, height) {
    const topLeft = this.screenToCanvas(0, 0);
    const bottomRight = this.screenToCanvas(width, height);
    return {
      minX: topLeft.x,
      minY: topLeft.y,
      maxX: bottomRight.x,
      maxY: bottomRight.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y
    };
  }
}
