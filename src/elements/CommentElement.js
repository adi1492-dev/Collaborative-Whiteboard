/**
 * CommentElement — A canvas-attached comment thread anchor.
 * Renders as a speech bubble icon at a specific world position.
 * Replies are stored as separate CommentElement instances with parentId set.
 */
import { Element } from './Element.js';

export class CommentElement extends Element {
  constructor(options = {}) {
    super(options);
    this.type = 'comment';
    this.width = 36;
    this.height = 36;
    this.text = options.text || '';
    this.authorName = options.authorName || 'Anonymous';
    this.authorId = options.authorId || null;
    this.parentId = options.parentId || null; // null = root comment, set = reply
    this.resolved = options.resolved || false;
    this.replies = []; // local cache, not serialized — reconstructed by manager
  }

  render(ctx) {
    if (this.resolved) return; // resolved comments invisible on canvas

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const r = this.width / 2;

    ctx.save();

    // Bubble background
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = this.parentId ? 'transparent' : 'rgba(251,191,36,0.9)'; // only roots visible
    ctx.fill();

    // Bubble border
    ctx.strokeStyle = this.parentId ? 'transparent' : '#fbbf24';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Speech bubble tail (root comments only)
    if (!this.parentId) {
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + r - 2);
      ctx.lineTo(cx - 10, cy + r + 8);
      ctx.lineTo(cx + 4, cy + r - 4);
      ctx.fillStyle = 'rgba(251,191,36,0.9)';
      ctx.fill();

      // Icon (comment symbol)
      ctx.fillStyle = '#1a1a2e';
      ctx.font = `bold ${Math.round(r)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💬', cx, cy);
    }

    ctx.restore();
  }

  hitTest(x, y) {
    if (this.resolved || this.parentId) return false;
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= (this.width / 2) * (this.width / 2);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      text: this.text,
      authorName: this.authorName,
      authorId: this.authorId,
      parentId: this.parentId,
      resolved: this.resolved,
    };
  }
}
