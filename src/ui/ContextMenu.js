/**
 * ContextMenu — Right-click context menu for canvas elements.
 * Provides: Copy, Paste, Duplicate, Delete, Lock, Bring to Front, Send to Back.
 */
export class ContextMenu {
  constructor(elementManager, syncManager, historyManager) {
    this.em = elementManager;
    this.sync = syncManager;
    this.history = historyManager;
    this._clipboard = null;

    this._el = document.createElement('div');
    this._el.className = 'context-menu glass elevation-3';
    this._el.style.cssText = `
      position: fixed;
      z-index: 9999;
      display: none;
      min-width: 180px;
      padding: 6px;
      border-radius: 10px;
      user-select: none;
    `;
    document.body.appendChild(this._el);

    this._bindDismiss();
    this._injectStyles();
  }

  /**
   * Show the context menu at a screen position for the given element.
   */
  show(screenX, screenY, targetElement) {
    this.targetElement = targetElement;

    const items = this._buildItems(targetElement);
    this._el.innerHTML = items.map(item =>
      item.separator
        ? `<div class="cm-separator"></div>`
        : `<button class="cm-item" data-action="${item.action}" ${item.disabled ? 'disabled' : ''}>
             <span class="material-symbols-outlined" style="font-size:16px">${item.icon}</span>
             <span>${item.label}</span>
             ${item.shortcut ? `<span class="cm-shortcut">${item.shortcut}</span>` : ''}
           </button>`
    ).join('');

    // Position, keep in viewport
    this._el.style.display = 'block';
    const rect = this._el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    this._el.style.left = `${Math.min(screenX, vw - rect.width - 8)}px`;
    this._el.style.top = `${Math.min(screenY, vh - rect.height - 8)}px`;

    // Wire item clicks
    this._el.querySelectorAll('.cm-item:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        this._handleAction(btn.dataset.action);
        this.hide();
      });
    });
  }

  hide() {
    this._el.style.display = 'none';
    this.targetElement = null;
  }

  setClipboard(data) { this._clipboard = data; }
  getClipboard() { return this._clipboard; }

  _buildItems(el) {
    const hasSelection = el != null;
    return [
      { action: 'copy', icon: 'content_copy', label: 'Copy', shortcut: 'Ctrl+C', disabled: !hasSelection },
      { action: 'paste', icon: 'content_paste', label: 'Paste', shortcut: 'Ctrl+V', disabled: !this._clipboard },
      { action: 'duplicate', icon: 'copy_all', label: 'Duplicate', shortcut: 'Ctrl+D', disabled: !hasSelection },
      { separator: true },
      { action: 'bring-front', icon: 'flip_to_front', label: 'Bring to Front', disabled: !hasSelection },
      { action: 'send-back', icon: 'flip_to_back', label: 'Send to Back', disabled: !hasSelection },
      { separator: true },
      { action: 'lock', icon: el?.locked ? 'lock_open' : 'lock', label: el?.locked ? 'Unlock' : 'Lock', disabled: !hasSelection },
      { separator: true },
      { action: 'delete', icon: 'delete', label: 'Delete', shortcut: 'Del', disabled: !hasSelection },
    ];
  }

  _handleAction(action) {
    const el = this.targetElement;

    switch (action) {
      case 'copy':
        if (el) this._clipboard = el.toJSON();
        break;

      case 'paste':
        if (this._clipboard) {
          const { generateId } = window.__canvasflowUtils || {};
          const clone = { ...this._clipboard, id: Date.now().toString(36), x: this._clipboard.x + 20, y: this._clipboard.y + 20 };
          const hydrated = this.sync._hydrateElement(clone);
          if (hydrated) {
            this.em.setElement(hydrated);
            this.sync.broadcastCreate(hydrated);
          }
        }
        break;

      case 'duplicate':
        if (el) {
          const clone = { ...el.toJSON(), id: Date.now().toString(36), x: el.x + 20, y: el.y + 20 };
          const hydrated = this.sync._hydrateElement(clone);
          if (hydrated) {
            this.em.setElement(hydrated);
            this.sync.broadcastCreate(hydrated);
          }
        }
        break;

      case 'bring-front': {
        if (!el) break;
        const maxZ = Math.max(...Array.from(this.em.elements.values()).map(e => e.zIndex));
        el.zIndex = maxZ + 1;
        el.updatedAt = Date.now();
        this.em._sortElements();
        this.em.cm.requestStaticRender();
        this.sync.broadcastUpdate(el);
        break;
      }

      case 'send-back': {
        if (!el) break;
        const minZ = Math.min(...Array.from(this.em.elements.values()).map(e => e.zIndex));
        el.zIndex = minZ - 1;
        el.updatedAt = Date.now();
        this.em._sortElements();
        this.em.cm.requestStaticRender();
        this.sync.broadcastUpdate(el);
        break;
      }

      case 'lock':
        if (el) {
          el.locked = !el.locked;
          el.updatedAt = Date.now();
          this.em.cm.requestStaticRender();
          this.sync.broadcastUpdate(el);
        }
        break;

      case 'delete':
        if (el) {
          this.em.select(el.id, true);
          this.em.deleteSelection();
        }
        break;
    }
  }

  _bindDismiss() {
    document.addEventListener('pointerdown', (e) => {
      if (!this._el.contains(e.target)) this.hide();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
  }

  _injectStyles() {
    if (document.getElementById('context-menu-styles')) return;
    const style = document.createElement('style');
    style.id = 'context-menu-styles';
    style.textContent = `
      .cm-item {
        display: flex; align-items: center; gap: 10px;
        width: 100%; padding: 8px 12px;
        background: transparent; border: none; cursor: pointer;
        color: var(--on-surface); font-size: 13px; font-family: var(--font-body);
        border-radius: 6px; text-align: left; transition: background 0.15s;
      }
      .cm-item:hover:not([disabled]) { background: rgba(192,193,255,0.1); color: var(--primary); }
      .cm-item[disabled] { opacity: 0.35; cursor: default; }
      .cm-shortcut { margin-left: auto; font-size: 11px; color: var(--outline); font-family: var(--font-mono); }
      .cm-separator { height: 1px; background: var(--outline-variant); margin: 4px 8px; }
    `;
    document.head.appendChild(style);
  }

  destroy() {
    this._el.remove();
  }
}
