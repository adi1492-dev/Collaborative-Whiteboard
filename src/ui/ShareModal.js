/**
 * ShareModal — Beautiful share dialog with:
 * - Public View-Only link toggle (generates a JWT link)
 * - Email-based collaborator invite
 * - Collaborator list with remove button (owner only)
 */
export class ShareModal {
  constructor(app, boardId, boardData) {
    this.app = app;
    this.boardId = boardId;
    this.boardData = boardData;
    this._el = null;
    this._injectStyles();
  }

  show(boardData) {
    if (boardData) this.boardData = boardData;
    if (this._el) this.hide();

    this._el = document.createElement('div');
    this._el.className = 'sm-overlay';
    document.body.appendChild(this._el);

    this._render();
    requestAnimationFrame(() => this._el?.classList.add('visible'));
  }

  hide() {
    if (!this._el) return;
    this._el.classList.remove('visible');
    setTimeout(() => { this._el?.remove(); this._el = null; }, 250);
  }

  _render() {
    const board = this.boardData;
    const isOwner = board?.ownerId === this.app.auth.getUser()?.id ||
                    board?.ownerId === this.app.auth.getUser()?.$id;
    const publicEnabled = board?.publicViewEnabled;
    const viewToken = board?.publicViewToken;
    const frontendOrigin = window.location.origin;
    const viewUrl = viewToken ? `${frontendOrigin}/#/view/${this.boardId}?token=${viewToken}` : '';
    const collabs = board?.collaborators || [];

    this._el.innerHTML = `
      <div class="sm-modal glass elevation-3">
        <div class="sm-header">
          <div>
            <h2 class="sm-title">Share Board</h2>
            <p class="sm-subtitle">Control who can view and edit this board</p>
          </div>
          <button class="icon-btn" id="sm-close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Public View-Only Link -->
        <div class="sm-section">
          <div class="sm-section-header">
            <div>
              <div class="sm-section-title">
                <span class="material-symbols-outlined" style="color:var(--primary)">public</span>
                Public View-Only Link
              </div>
              <div class="sm-section-desc">Anyone with this link can view the board (read-only)</div>
            </div>
            ${isOwner ? `
            <label class="sm-toggle" title="${publicEnabled ? 'Disable' : 'Enable'} public view">
              <input type="checkbox" id="sm-public-toggle" ${publicEnabled ? 'checked' : ''}>
              <span class="sm-toggle-track"></span>
            </label>
            ` : `<span class="sm-badge ${publicEnabled ? 'sm-badge-on' : 'sm-badge-off'}">${publicEnabled ? 'Enabled' : 'Disabled'}</span>`}
          </div>
          ${publicEnabled && viewUrl ? `
            <div class="sm-link-box">
              <span class="sm-link-text" title="${viewUrl}">${viewUrl}</span>
              <button class="icon-btn sm-copy-btn" id="sm-copy-view-url" title="Copy link">
                <span class="material-symbols-outlined" style="font-size:16px">content_copy</span>
              </button>
            </div>
          ` : ''}
        </div>

        <!-- Email Invite (Editor) -->
        ${isOwner ? `
        <div class="sm-section">
          <div class="sm-section-title">
            <span class="material-symbols-outlined" style="color:var(--tertiary)">person_add</span>
            Invite as Editor
          </div>
          <div class="sm-section-desc">They must already have a CanvasFlow account</div>
          <div class="sm-invite-row" style="margin-top:10px;">
            <input type="email" id="sm-invite-email" class="sm-input" placeholder="collaborator@example.com">
            <button class="btn-primary sm-invite-btn" id="sm-invite-btn" style="flex-shrink:0;padding:8px 16px;font-size:13px;">
              <span class="material-symbols-outlined" style="font-size:15px">send</span> Invite
            </button>
          </div>
          <div id="sm-invite-status" style="font-size:12px;margin-top:6px;min-height:16px;"></div>
        </div>
        ` : ''}

        <!-- Collaborators List -->
        <div class="sm-section">
          <div class="sm-section-title">
            <span class="material-symbols-outlined" style="color:#34d399">group</span>
            Current Editors (${collabs.length})
          </div>
          ${collabs.length === 0
            ? `<div class="sm-empty">No collaborators yet. Invite someone above!</div>`
            : `<div class="sm-collab-list">
              ${collabs.map(col => `
                <div class="sm-collab-item">
                  <div class="sm-collab-avatar">${this._initials(col.displayName || col.email || '?')}</div>
                  <div class="sm-collab-info">
                    <div class="sm-collab-name">${col.displayName || 'Collaborator'}</div>
                    <div class="sm-collab-email">${col.email || ''}</div>
                  </div>
                  ${isOwner ? `
                  <button class="icon-btn sm-remove-btn" data-userid="${col.userId}" title="Remove">
                    <span class="material-symbols-outlined" style="font-size:16px;color:var(--error,#f87171)">person_remove</span>
                  </button>` : ''}
                </div>
              `).join('')}
            </div>`
          }
        </div>
      </div>
    `;

    // Bind close
    this._el.querySelector('#sm-close')?.addEventListener('click', () => this.hide());
    this._el.addEventListener('click', (e) => { if (e.target === this._el) this.hide(); });

    // Public toggle
    const toggle = this._el.querySelector('#sm-public-toggle');
    if (toggle) {
      toggle.addEventListener('change', async () => {
        try {
          if (toggle.checked) {
            const res = await this.app.auth.apiFetch(`/api/boards/${this.boardId}/share`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
              this.boardData.publicViewEnabled = true;
              this.boardData.publicViewToken = data.publicViewToken;
              this._render();
            } else {
              toggle.checked = false;
              this._showStatus(data.error || 'Failed', 'error');
            }
          } else {
            const res = await this.app.auth.apiFetch(`/api/boards/${this.boardId}/share`, { method: 'DELETE' });
            if (res.ok) {
              this.boardData.publicViewEnabled = false;
              this.boardData.publicViewToken = '';
              this._render();
            } else {
              toggle.checked = true;
            }
          }
        } catch (e) {
          toggle.checked = !toggle.checked;
        }
      });
    }

    // Copy view URL
    this._el.querySelector('#sm-copy-view-url')?.addEventListener('click', () => {
      navigator.clipboard.writeText(viewUrl).then(() => {
        import('./Toast.js').then(({ Toast }) => Toast.show('View link copied!', 'success', 2000));
      });
    });

    // Invite
    const inviteBtn = this._el.querySelector('#sm-invite-btn');
    const emailInput = this._el.querySelector('#sm-invite-email');
    const statusEl = this._el.querySelector('#sm-invite-status');
    if (inviteBtn && emailInput) {
      const doInvite = async () => {
        const email = emailInput.value.trim();
        if (!email) return;
        inviteBtn.disabled = true;
        if (statusEl) statusEl.style.color = 'var(--on-surface-variant)';
        if (statusEl) statusEl.textContent = 'Sending invite...';

        try {
          const res = await this.app.auth.apiFetch(`/api/boards/${this.boardId}/invite`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          const data = await res.json();
          if (res.ok) {
            emailInput.value = '';
            if (statusEl) { statusEl.style.color = '#34d399'; statusEl.textContent = `✅ ${data.displayName} added as editor!`; }
            // Refresh board data and re-render
            this._refreshAndRender();
          } else {
            if (statusEl) { statusEl.style.color = '#f87171'; statusEl.textContent = `❌ ${data.error}`; }
          }
        } catch (e) {
          if (statusEl) { statusEl.style.color = '#f87171'; statusEl.textContent = 'Request failed'; }
        }
        inviteBtn.disabled = false;
      };
      inviteBtn.addEventListener('click', doInvite);
      emailInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doInvite(); });
    }

    // Remove collaborator
    this._el.querySelectorAll('.sm-remove-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.userid;
        const res = await this.app.auth.apiFetch(`/api/boards/${this.boardId}/collaborators/${userId}`, { method: 'DELETE' });
        if (res.ok) this._refreshAndRender();
      });
    });
  }

  async _refreshAndRender() {
    try {
      const res = await this.app.auth.apiFetch(`/api/boards/${this.boardId}`);
      if (res.ok) {
        const data = await res.json();
        this.boardData = data.board;
        this._render();
      }
    } catch (_) {}
  }

  _initials(name) {
    return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  _injectStyles() {
    if (document.getElementById('sm-styles')) return;
    const style = document.createElement('style');
    style.id = 'sm-styles';
    style.textContent = `
      .sm-overlay {
        position: fixed; inset: 0; z-index: 10000;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        opacity: 0; transition: opacity 0.25s ease;
      }
      .sm-overlay.visible { opacity: 1; }
      .sm-modal {
        width: min(520px, 96vw); max-height: 90vh;
        border-radius: 20px; overflow-y: auto;
        transform: translateY(20px); transition: transform 0.25s ease;
      }
      .sm-overlay.visible .sm-modal { transform: translateY(0); }
      .sm-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 24px 24px 0; }
      .sm-title { font-size: 20px; font-weight: 700; color: var(--on-surface); margin: 0 0 4px; }
      .sm-subtitle { font-size: 13px; color: var(--on-surface-variant); margin: 0; }
      .sm-section { padding: 16px 24px; border-bottom: 1px solid var(--outline-variant); }
      .sm-section:last-child { border-bottom: none; padding-bottom: 24px; }
      .sm-section-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
      .sm-section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--on-surface); margin-bottom: 4px; }
      .sm-section-desc { font-size: 12px; color: var(--on-surface-variant); }
      .sm-link-box { display: flex; align-items: center; gap: 8px; margin-top: 10px; background: var(--surface-container-low); border: 1px solid var(--outline-variant); border-radius: 8px; padding: 8px 12px; }
      .sm-link-text { flex: 1; font-size: 12px; color: var(--primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-mono); }
      .sm-invite-row { display: flex; gap: 8px; }
      .sm-input { flex: 1; background: var(--surface-container-low); border: 1px solid var(--outline-variant); border-radius: 8px; padding: 8px 12px; font-size: 13px; font-family: var(--font-body); color: var(--on-surface); outline: none; transition: border-color 0.2s; }
      .sm-input:focus { border-color: var(--primary); }
      .sm-invite-btn { display: flex; align-items: center; gap: 6px; }
      .sm-empty { font-size: 13px; color: var(--on-surface-variant); text-align: center; padding: 16px; }
      .sm-collab-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
      .sm-collab-item { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; background: var(--surface-container-low); }
      .sm-collab-avatar { width: 32px; height: 32px; border-radius: 50%; background: rgba(192,193,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--primary); flex-shrink: 0; }
      .sm-collab-info { flex: 1; min-width: 0; }
      .sm-collab-name { font-size: 13px; font-weight: 600; color: var(--on-surface); }
      .sm-collab-email { font-size: 11px; color: var(--on-surface-variant); }
      .sm-badge { font-size: 11px; padding: 3px 8px; border-radius: 20px; font-weight: 600; }
      .sm-badge-on { background: rgba(52,211,153,0.15); color: #34d399; }
      .sm-badge-off { background: rgba(156,163,175,0.1); color: var(--on-surface-variant); }
      .sm-toggle { position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; flex-shrink: 0; }
      .sm-toggle input { opacity: 0; width: 0; height: 0; }
      .sm-toggle-track { position: absolute; inset: 0; border-radius: 12px; background: var(--outline-variant); transition: background 0.2s; }
      .sm-toggle input:checked + .sm-toggle-track { background: var(--primary); }
      .sm-toggle-track::after { content: ''; position: absolute; width: 18px; height: 18px; border-radius: 50%; background: white; top: 3px; left: 3px; transition: transform 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.3); }
      .sm-toggle input:checked + .sm-toggle-track::after { transform: translateX(20px); }
    `;
    document.head.appendChild(style);
  }
}
