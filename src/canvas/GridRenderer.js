/**
 * GridRenderer — Draws the infinite background patterns (grid, dots, lines).
 * Highly optimized to only draw within the visible viewport.
 */
export class GridRenderer {
  constructor(canvasManager) {
    this.cm = canvasManager;
    this.patternSize = 24; // Base size of a grid cell
  }

  /**
   * Draw the background pattern to the context based on current transform.
   */
  render(ctx, type, width, height, isDarkMode) {
    if (type === 'blank' || !type) return;

    // Reset transform for drawing the background
    this.cm.transform.resetContext(ctx);
    
    // Clear the background completely
    ctx.clearRect(0, 0, width, height);
    
    // Get viewport bounds in world space
    const bounds = this.cm.transform.getViewportBounds(width, height);
    const scale = this.cm.transform.scale;
    const tx = this.cm.transform.x;
    const ty = this.cm.transform.y;

    // Set colors based on theme
    const color = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(11, 28, 48, 0.05)';
    const majorColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(11, 28, 48, 0.1)';

    ctx.beginPath();
    ctx.strokeStyle = color;

    // Adjust grid density based on zoom level to prevent moiré patterns
    let effectiveSize = this.patternSize;
    if (scale < 0.25) effectiveSize *= 4;
    else if (scale < 0.5) effectiveSize *= 2;
    
    // Calculate start points aligned to grid
    const startX = Math.floor(bounds.minX / effectiveSize) * effectiveSize;
    const startY = Math.floor(bounds.minY / effectiveSize) * effectiveSize;

    if (type === 'dots') {
      ctx.fillStyle = color;
      const dotSize = Math.max(1, 1.5 / scale);
      
      for (let x = startX; x <= bounds.maxX; x += effectiveSize) {
        for (let y = startY; y <= bounds.maxY; y += effectiveSize) {
          const screenX = x * scale + tx;
          const screenY = y * scale + ty;
          
          // Draw dot in screen space
          ctx.moveTo(screenX, screenY);
          ctx.arc(screenX, screenY, dotSize, 0, Math.PI * 2);
        }
      }
      ctx.fill();
      
    } else if (type === 'grid' || type === 'lines') {
      ctx.lineWidth = 1;
      
      // Vertical lines
      if (type === 'grid') {
        for (let x = startX; x <= bounds.maxX; x += effectiveSize) {
          const screenX = Math.round(x * scale + tx) + 0.5; // Crisp lines
          ctx.moveTo(screenX, 0);
          ctx.lineTo(screenX, height);
        }
      }
      
      // Horizontal lines
      for (let y = startY; y <= bounds.maxY; y += effectiveSize) {
        const screenY = Math.round(y * scale + ty) + 0.5; // Crisp lines
        ctx.moveTo(0, screenY);
        ctx.lineTo(width, screenY);
      }
      
      ctx.stroke();

      // Draw major grid lines (every 5 cells) for 'grid'
      if (type === 'grid') {
        ctx.beginPath();
        ctx.strokeStyle = majorColor;
        ctx.lineWidth = 1;
        
        const majorSize = effectiveSize * 5;
        const majorStartX = Math.floor(bounds.minX / majorSize) * majorSize;
        const majorStartY = Math.floor(bounds.minY / majorSize) * majorSize;

        for (let x = majorStartX; x <= bounds.maxX; x += majorSize) {
          const screenX = Math.round(x * scale + tx) + 0.5;
          ctx.moveTo(screenX, 0);
          ctx.lineTo(screenX, height);
        }
        for (let y = majorStartY; y <= bounds.maxY; y += majorSize) {
          const screenY = Math.round(y * scale + ty) + 0.5;
          ctx.moveTo(0, screenY);
          ctx.lineTo(width, screenY);
        }
        
        ctx.stroke();
      }
    }

    // Restore context for elements
    this.cm.transform.applyToContext(ctx);
  }
}
