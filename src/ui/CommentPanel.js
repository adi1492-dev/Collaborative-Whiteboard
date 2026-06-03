/**
 * CommentPanel — Floating sidebar panel for comment threads.
 * Shows threaded replies with author avatars, timestamps, and resolve actions.
 * Attaches to a CommentElement (the anchor node on the canvas).
 */
export class CommentPanel {
  constructor(syncManager, elementManager, authManager) {
    this.sync = syncManager;
    this.em = elementManager;
    this.auth = authManager;
    this._el = null;
    this._currentCommentId = null;
    this._injectStyles();
  }

  /**
   * Open the comment panel for a specific comment element.
   */
  open(commentElement) {
    this._currentCommentId = commentElement.id;
    const thread = this._buildThread(commentElement);
    
    if (!this._el) {
      this._el = document.createElement('div');
      this._el.className = 'cp-panel glass elevation-3';
      document.body.appendChild(this._el);
    }

    this._render(commentElement, thread);
    this._el.classList.add('visible');
  }

  close() {
    this._el?.classList.remove('visible');
    this._currentCommentId = null;
  }

  /**
   * Collect all replies for this comment from the element map.
   */
  _buildThread(rootComment) {
    const replies = [];
    for (const el of this.em.elements.values()) {
      if (el.type === 'comment' && el.parentId === rootComment.id) {
        replies.push(el);
      }
    }
    // Sort by creation time
    replies.sort((a, b) => a.createdAt - b.createdAt);
    return replies;
  }

  _formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  _initials(name) {
    return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  _colorFor(str) {
    const colors = ['#c0c1ff', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#f472b6', '#fb923c'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  _render(rootComment, replies) {
    const allMessages = [rootComment, ...replies];
    const color = this._colorFor(rootComment.authorId || rootComment.authorName || 'anon');

    this._el.innerHTML = `
      <div class="cp-header">
        <div class="cp-title">
          <span class="material-symbols-outlined" style="color:#fbbf24;font-size:18px">chat</span>
          Comment Thread
        </div>
        <div style="display:flex;gap:4px;">
          <button class="icon-btn cp-resolve-btn" id="cp-resolve" title="${rootComment.resolved ? 'Re-open' : 'Resolve'}" style="color:${rootComment.resolved ? '#34d399' : 'var(--on-surface-variant)'}">
            <span class="material-symbols-outlined">${rootComment.resolved ? 'refresh' : 'check_circle'}</span>
          </button>
          <button class="icon-btn" id="cp-close" title="Close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>
      <div class="cp-thread">
        ${allMessages.map((msg, i) => `
          <div class="cp-message ${i === 0 ? 'cp-root' : 'cp-reply'}">
            <div class="cp-avatar" style="background:${this._colorFor(msg.authorId || msg.authorName || 'anon')};color:#0b1c30">
              ${this._initials(msg.authorName)}
            </div>
            <div class="cp-msg-body">
              <div class="cp-msg-meta">
                <span class="cp-author">${msg.authorName}</span>
                <span class="cp-time">${this._formatTime(msg.createdAt)}</span>
              </div>
              <div class="cp-msg-text">${msg.text}</div>
            </div>
          </div>
        `).join('')}
      </div>
      ${rootComment.resolved ? '<div class="cp-resolved-badge">✅ Thread Resolved</div>' : `
      <div class="cp-compose">
        <textarea class="cp-textarea" id="cp-input" placeholder="Add a reply..." rows="2"></textarea>
        <button class="btn-primary cp-send-btn" id="cp-send" style="font-size:13px;padding:8px 16px;">
          <span class="material-symbols-outlined" style="font-size:15px">send</span> Reply
        </button>
      </div>`}
    `;

    // Bind close
    this._el.querySelector('#cp-close').addEventListener('click', () => this.close());

    // Bind resolve
    this._el.querySelector('#cp-resolve')?.addEventListener('click', () => {
      rootComment.resolved = !rootComment.resolved;
      rootComment.updatedAt = Date.now();
      this.em.cm.requestStaticRender();
      this.sync.broadcastUpdate(rootComment);
      this.close();
      import('../ui/Toast.js').then(({ Toast }) => {
        Toast.show(rootComment.resolved ? '✅ Thread resolved' : '🔄 Thread re-opened', 'success', 2000);
      });
    });

    // Bind reply
    const sendBtn = this._el.querySelector('#cp-send');
    const input = this._el.querySelector('#cp-input');
    if (sendBtn && input) {
      const doSend = () => {
        const text = input.value.trim();
        if (!text) return;

        const user = this.auth?.getUser?.();
        const { generateId } = window.__generateId || { generateId: () => Math.random().toString(36).slice(2) };

        import('../utils/uid.js').then(({ generateId }) => {
          const { CommentElement } = window.__CommentElement || {};
          // Dynamically import to avoid circular deps
          import('../elements/CommentElement.js').then(({ CommentElement }) => {
            const reply = new CommentElement({
              id: generateId(),
              x: rootComment.x,
              y: rootComment.y,
              text,
              authorName: user?.displayName || user?.name || 'Collaborator',
              authorId: user?.id || user?.$id || 'anon',
              parentId: rootComment.id,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            this.em.setElement(reply);
            this.sync.broadcastCreate(reply);
            // Re-open panel to show new reply
            this.open(rootComment);
          });
        });
      };

      sendBtn.addEventListener('click', doSend);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) doSend();
      });
    }
  }

  _injectStyles() {
    if (document.getElementById('cp-styles')) return;
    const style = document.createElement('style');
    style.id = 'cp-styles';
    style.textContent = `
      .cp-panel {
        position: fixed; right: 16px; top: 80px;
        width: 320px; max-height: calc(100vh - 96px);
        border-radius: 16px; overflow: hidden;
        display: flex; flex-direction: column;
        transform: translateX(360px); transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
        z-index: 9990;
      }
      .cp-panel.visible { transform: translateX(0); }
      .cp-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 12px 12px;
        border-bottom: 1px solid var(--outline-variant);
        flex-shrink: 0;
      }
      .cp-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--on-surface); }
      .cp-thread { overflow-y: auto; flex: 1; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
      .cp-message { display: flex; gap: 10px; }
      .cp-reply { padding-left: 16px; border-left: 2px solid var(--outline-variant); }
      .cp-avatar {
        width: 32px; height: 32px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 700; flex-shrink: 0;
      }
      .cp-msg-body { flex: 1; min-width: 0; }
      .cp-msg-meta { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
      .cp-author { font-size: 13px; font-weight: 600; color: var(--on-surface); }
      .cp-time { font-size: 11px; color: var(--on-surface-variant); }
      .cp-msg-text { font-size: 13px; color: var(--on-surface); line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
      .cp-compose { padding: 12px; border-top: 1px solid var(--outline-variant); display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
      .cp-textarea {
        width: 100%; background: var(--surface-container-low); border: 1px solid var(--outline-variant);
        border-radius: 8px; padding: 8px 12px; font-size: 13px; font-family: var(--font-body);
        color: var(--on-surface); resize: none; outline: none; box-sizing: border-box;
        transition: border-color 0.2s;
      }
      .cp-textarea:focus { border-color: var(--primary); }
      .cp-send-btn { display: flex; align-items: center; gap: 6px; justify-content: center; }
      .cp-resolved-badge { padding: 12px; text-align: center; font-size: 13px; color: #34d399; }
    `;
    document.head.appendChild(style);
  }
}
