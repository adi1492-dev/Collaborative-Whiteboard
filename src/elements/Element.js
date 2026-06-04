/**
 * Element — Base class for all canvas objects.
 * Handles common properties, hit testing, and serialization.
 */
import { generateId } from '../utils/uid.js';

export class Element {
  constructor(options = {}) {
    this.id = options.id || generateId();
    this.type = 'element';
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.width = options.width || 100;
    this.height = options.height || 100;
    this.rotation = options.rotation || 0;
    this.zIndex = options.zIndex !== undefined ? options.zIndex : Date.now();
    this.locked = options.locked || false;
    this.opacity = options.opacity !== undefined ? options.opacity : 1;
    this.visible = options.visible !== false;
    
    // Default style
    this.style = {
      strokeColor: options.style?.strokeColor || '#c0c1ff', // Primary
      fillColor: options.style?.fillColor || 'transparent',
      strokeWidth: options.style?.strokeWidth || 2,
      fontSize: options.style?.fontSize || 16,
      fontFamily: options.style?.fontFamily || 'Inter, sans-serif',
      textAlign: options.style?.textAlign || 'left',
      ...options.style
    };

    this.createdBy = options.createdBy || null;
    this.createdAt = options.createdAt || Date.now();
    this.updatedAt = options.updatedAt || Date.now(); // Lamport timestamp during sync
  }

  /**
   * Draw the element onto the context. Must be implemented by subclasses.
   */
  render(ctx) {
    throw new Error('render() must be implemented');
  }

  /**
   * Check if a point (in canvas coords) hits this element.
   * Basic AABB implementation. Subclasses can override for precise checks.
   */
  hitTest(x, y) {
    // Account for rotation (simple implementation - rotate point backwards)
    if (this.rotation !== 0) {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      const dx = x - cx;
      const dy = y - cy;
      const cos = Math.cos(-this.rotation);
      const sin = Math.sin(-this.rotation);
      x = cx + dx * cos - dy * sin;
      y = cy + dx * sin + dy * cos;
    }

    return x >= this.x && x <= this.x + this.width &&
           y >= this.y && y <= this.y + this.height;
  }

  /**
   * Move the element by delta.
   */
  translate(dx, dy) {
    if (this.locked) return;
    this.x += dx;
    this.y += dy;
    this.updatedAt = Date.now();
  }

  /**
   * Resize the element.
   */
  resize(width, height) {
    if (this.locked) return;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.updatedAt = Date.now();
  }

  /**
   * Clone the element.
   */
  clone() {
    const data = this.toJSON();
    data.id = generateId(); // New ID for clone
    data.x += 20; // Offset slightly
    data.y += 20;
    
    // Abstract factory approach in ElementManager would instantiate the right class
    // For now, return the raw data object to be hydrated
    return data;
  }

  /**
   * Serialize for network/storage.
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      rotation: this.rotation,
      zIndex: this.zIndex,
      locked: this.locked,
      opacity: this.opacity,
      visible: this.visible,
      style: { ...this.style },
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
