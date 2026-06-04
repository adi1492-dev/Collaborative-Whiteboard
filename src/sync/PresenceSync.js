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
    this.ws.on('laser_pointer', this._onRemoteLaser.bind(this));
    this.lasers = new Map(); // userId -> { points: [], color, lastSeen }
  }

  updateCursor(worldX, worldY) {
    this.localX = worldX;
    this.localY = worldY;

    const now = Date.now();
    if (now - this.lastSendTime > this.sendThrottle) {
      const user = this.cm.syncManager?.app.auth.getUser();
      const userName = user ? (user.displayName || user.name || 'Collaborator') : 'Collaborator';
      const userId = user ? (user.id || user.$id || user.uid) : (this.ws?.clientId || 'unknown');
      const payload = { x: worldX, y: worldY, userName, userId };

      if (this.p2p) {
        const sent = this.p2p.broadcast('cursor_move', payload);
        // Fallback to WS if any peer is missing from P2P network
        if (this.cm.syncManager && this.cm.syncManager._getMissingP2PCount(sent) > 0) {
          this.ws.send('cursor_move', payload);
        }
      } else {
        this.ws.send('cursor_move', payload);
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
        // BUG-006 fix: default to empty string so we can always safely update
        userName: msg.userName || msg.payload?.userName || 'Collaborator',
        color: this._getUserColor(userId),
        lastSeen: Date.now()
      });
    } else {
      const cursor = this.cursors.get(userId);
      // Set target for smooth interpolation
      cursor.targetX = pt.x;
      cursor.targetY = pt.y;
      cursor.lastSeen = Date.now();
      // BUG-006 fix: always update userName in case it changed or arrived late
      if (msg.userName || msg.payload?.userName) {
        cursor.userName = msg.userName || msg.payload.userName;
      }
    }
  }

  sendLaserPoint(worldX, worldY) {
    const user = this.cm.syncManager?.app.auth.getUser();
    const userId = user ? (user.id || user.$id || user.uid) : (this.ws?.clientId || 'unknown');
    const payload = { x: worldX, y: worldY, userId };

    if (this.p2p) {
      const sent = this.p2p.broadcast('laser_pointer', payload);
      if (this.cm.syncManager && this.cm.syncManager._getMissingP2PCount(sent) > 0) {
        this.ws.send('laser_pointer', payload);
      }
    } else {
      this.ws.send('laser_pointer', payload);
    }

    this._addLaserPoint(userId, worldX, worldY, '#ef476f'); // Local laser is red
  }

  _onRemoteLaser(msg) {
    const userId = msg.userId || msg.clientId;
    const pt = msg.payload;
    this._addLaserPoint(userId, pt.x, pt.y, this._getUserColor(userId));
  }

  _addLaserPoint(userId, x, y, color) {
    if (!this.lasers.has(userId)) {
      this.lasers.set(userId, { points: [], color, lastSeen: Date.now() });
    }
    const laser = this.lasers.get(userId);
    laser.points.push({ x, y, time: Date.now() });
    laser.lastSeen = Date.now();
  }

  removeCursor(userId) {
    this.cursors.delete(userId);
  }

  renderCursors(ctx, currentScale) {
    const now = Date.now();
    let hasChanges = false;

    // BUG-013 fix: collect stale cursor IDs first, then delete after loop
    // to avoid mutating the Map during iteration
    const staleIds = [];

    for (const [userId, cursor] of this.cursors.entries()) {
      // Remove stale cursors (no update in 5 seconds)
      if (now - cursor.lastSeen > 5000) {
        staleIds.push(userId);
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

    // BUG-013 fix: delete stale entries after iteration is complete
    for (const id of staleIds) {
      this.cursors.delete(id);
    }

    // Since this runs in the active render loop, returning true means we need to keep rendering
    return hasChanges;
  }

  renderLasers(ctx) {
    const now = Date.now();
    let hasChanges = false;
    const maxAge = 800; // Laser tail lasts 800ms

    for (const [userId, laser] of this.lasers.entries()) {
      const origCount = laser.points.length;
      laser.points = laser.points.filter(p => now - p.time < maxAge);
      if (laser.points.length < origCount) hasChanges = true;

      if (laser.points.length > 1) {
        hasChanges = true;
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        // Draw the tail as a segmented path with fading opacity
        for (let i = 1; i < laser.points.length; i++) {
          const p1 = laser.points[i - 1];
          const p2 = laser.points[i];
          const age = now - p2.time;
          const life = 1 - (age / maxAge);
          
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = laser.color;
          ctx.lineWidth = 4 + (life * 4); // Tail tapers
          ctx.globalAlpha = life;
          ctx.stroke();
        }
        
        // Draw glowing head
        const head = laser.points[laser.points.length - 1];
        ctx.beginPath();
        ctx.arc(head.x, head.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = laser.color;
        ctx.globalAlpha = 1;
        ctx.shadowColor = laser.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
      }

      if (laser.points.length === 0 && now - laser.lastSeen > maxAge) {
        this.lasers.delete(userId);
      }
    }
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
    const label = cursor.userName || 'Collaborator';
    const textWidth = ctx.measureText(label).width;

    // Tag background
    ctx.fillStyle = cursor.color;
    ctx.beginPath();
    ctx.roundRect(14, 20, textWidth + 12, 18, 4);
    ctx.fill();

    // Tag text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 14 + (textWidth + 12) / 2, 20 + 9);

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
