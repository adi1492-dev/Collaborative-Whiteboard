/**
 * PresenceSync — Manages remote cursors and user presence.
 * Cursors are rendered on the active canvas layer for 60fps smoothness.
 */
export class PresenceSync {
  constructor(ws, canvasManager, p2pManager) {
    this.ws = ws;
    this.cm = canvasManager;
    this.p2p = p2pManager;
    this.cursors = new Map(); // userId -> { x, y, userName, color, targetX, targetY }
    
    this.lastSendTime = 0;
    this.sendThrottle = 50; // Max 20 cursor updates per second
    this.localX = 0;
    this.localY = 0;

    // Listen for fallback WS cursor events just in case
    this.ws.on('cursor_move', this._onRemoteCursor.bind(this));
  }

  updateCursor(worldX, worldY) {
    this.localX = worldX;
    this.localY = worldY;
    
    const now = Date.now();
    if (now - this.lastSendTime > this.sendThrottle) {
      if (this.p2p) {
        const user = this.cm.syncManager?.app.auth.getUser();
        const userName = user ? user.displayName : 'Collaborator';
        this.p2p.broadcast('cursor_move', { x: worldX, y: worldY, userName });
      } else {
        this.ws.send('cursor_move', { x: worldX, y: worldY });
      }
      this.lastSendTime = now;
    }
  }

  _onRemoteCursor(msg) {
    const userId = msg.userId || msg.clientId;
    const pt = msg.payload;

    if (!this.cursors.has(userId)) {
      this.cursors.set(userId, {
        x: pt.x,
        y: pt.y,
        targetX: pt.x,
        targetY: pt.y,
        userName: msg.userName,
        color: this._getUserColor(userId), // Simplified: deterministic color from ID
        lastSeen: Date.now()
      });
    } else {
      const cursor = this.cursors.get(userId);
      // Set target for smooth interpolation
      cursor.targetX = pt.x;
      cursor.targetY = pt.y;
      cursor.lastSeen = Date.now();
    }
  }

  removeCursor(userId) {
    this.cursors.delete(userId);
  }

  renderCursors(ctx, currentScale) {
    const now = Date.now();
    let hasChanges = false;

    for (const [userId, cursor] of this.cursors.entries()) {
      // Remove stale cursors (no update in 5 seconds)
      if (now - cursor.lastSeen > 5000) {
        this.cursors.delete(userId);
        continue;
      }

      // Linear interpolation (lerp) for smooth cursor movement
      // Move 30% of the way to the target each frame
      const dx = cursor.targetX - cursor.x;
      const dy = cursor.targetY - cursor.y;
      
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        cursor.x += dx * 0.3;
        cursor.y += dy * 0.3;
        hasChanges = true;
      }

      this._drawCursor(ctx, cursor, currentScale);
    }

    // Since this runs in the active render loop, returning true means we need to keep rendering
    return hasChanges;
  }

  _drawCursor(ctx, cursor, scale) {
    ctx.save();
    
    // Scale-invariant sizing
    const invScale = 1 / scale;
    
    // Translate to cursor pos
    ctx.translate(cursor.x, cursor.y);
    ctx.scale(invScale, invScale); // Keep UI size constant regardless of zoom

    // SVG Path for an arrow pointer (Material Design 'near_me')
    const pointerPath = new Path2D("M21.41 11.58l-15-7A1 1 0 0 0 5 5.53v15a1 1 0 0 0 1.7.7l4.3-4.3 2.1 4.2a1 1 0 0 0 1.35.45l2.67-1.34a1 1 0 0 0 .45-1.34l-2.1-4.2 4.67-.8a1 1 0 0 0 .27-1.72z");
    
    // Draw shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.translate(1, 2);
    ctx.fill(pointerPath);
    ctx.translate(-1, -2);

    // Draw pointer
    ctx.fillStyle = cursor.color;
    ctx.fill(pointerPath);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke(pointerPath);

    // Draw name tag
    ctx.font = '500 11px "Geist", sans-serif';
    const textWidth = ctx.measureText(cursor.userName).width;
    
    // Tag background
    ctx.fillStyle = cursor.color;
    ctx.beginPath();
    ctx.roundRect(14, 20, textWidth + 12, 18, 4);
    ctx.fill();
    
    // Tag text
    ctx.fillStyle = '#ffffff'; // Assuming dark color, standardizing for simplicity
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cursor.userName, 14 + (textWidth + 12)/2, 20 + 9);

    ctx.restore();
  }

  _getUserColor(userId) {
    const colors = ['#c0c1ff', '#4cd7f6', '#ffb2b7', '#8083ff', '#03b5d3', '#ff516a'];
    // Hash string to int
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }
}
