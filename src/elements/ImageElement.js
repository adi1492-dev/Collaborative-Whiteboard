/**
 * ImageElement — Renders uploaded images onto the canvas.
 */
import { Element } from './Element.js';

export class ImageElement extends Element {
  constructor(options = {}) {
    super(options);
    this.type = 'image';
    this.src = options.src || '';
    this.img = null;
    this.loaded = false;
    
    if (this.src) {
      this._loadImage();
    }
  }

  _loadImage() {
    this.img = new Image();
    this.img.crossOrigin = 'anonymous'; // Ensure we can export canvas with images
    this.img.onload = () => {
      this.loaded = true;
      // If width/height weren't provided initially, set them based on aspect ratio
      if (this.width === 100 && this.height === 100) {
        // Constrain max width for initial placement
        const maxWidth = 500;
        const scale = this.img.width > maxWidth ? maxWidth / this.img.width : 1;
        this.width = this.img.width * scale;
        this.height = this.img.height * scale;
      }
      // Assuming we have access to CM to request a render, but typically ElementManager handles this.
      // Easiest is to fire an event or just rely on the next render cycle.
    };
    this.img.src = this.src;
  }

  render(ctx) {
    if (!this.loaded || !this.img) return;

    ctx.save();
    ctx.globalAlpha = this.opacity;
    
    if (this.style.strokeColor !== 'transparent' && this.style.strokeWidth > 0) {
        ctx.strokeStyle = this.style.strokeColor;
        ctx.lineWidth = this.style.strokeWidth;
        const hw = this.style.strokeWidth / 2;
        ctx.strokeRect(this.x - hw, this.y - hw, this.width + hw*2, this.height + hw*2);
    }
    
    ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    
    ctx.restore();
  }

  toJSON() {
    const data = super.toJSON();
    data.src = this.src;
    return data;
  }
}
