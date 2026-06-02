/**
 * TextEditor — Floating textarea overlay for editing sticky notes and text elements.
 * Positions itself over the canvas element using canvas transform coordinates.
 */
export class TextEditor {
  constructor(canvasManager) {
    this.cm = canvasManager;
    this.currentElement = null;
    this.onCommit = null; // Callback(element) when text is committed

    this._el = document.createElement('div');
    this._el.style.cssText = `
      position: absolute;
      z-index: 1000;
      display: none;
      pointer-events: auto;
    `;

    this._textarea = document.createElement('textarea');
    this._textarea.style.cssText = `
      width: 100%;
      height: 100%;
      background: transparent;
      border: none;
      outline: none;
      resize: none;
      padding: 12px;
      color: #131313;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      line-height: 1.5;
      text-align: center;
      word-break: break-word;
      overflow: hidden;
    `;

    this._el.appendChild(this._textarea);
    document.body.appendChild(this._el);

    this._bindEvents();
  }

  /**
   * Open the editor over the given element.
   */
  open(element, syncManager) {
    this.currentElement = element;
    this.sync = syncManager;

    this._position();

    // Set text content
    this._textarea.value = element.text || '';
    this._textarea.style.fontSize = `${(element.style?.fontSize || 14) * this.cm.transform.scale}px`;
    this._textarea.style.color = element.type === 'sticky' ? '#131313' :
      (document.documentElement.getAttribute('data-theme') === 'dark' ? '#e5e2e1' : '#0b1c30');
    this._textarea.style.textAlign = element.style?.textAlign || 'center';

    this._el.style.display = 'block';
    this._textarea.focus();
    this._textarea.select();
  }

  close(commit = true) {
    if (!this.currentElement) return;

    if (commit) {
      const newText = this._textarea.value;
      if (newText !== this.currentElement.text) {
        this.currentElement.text = newText;
        this.currentElement.updatedAt = Date.now();
        this.cm.requestStaticRender();

        if (this.sync) {
          this.sync.broadcastUpdate(this.currentElement);
        }
      }
    }

    this._el.style.display = 'none';
    this.currentElement = null;
    this.onCommit && this.onCommit();
  }

  _position() {
    if (!this.currentElement) return;
    const el = this.currentElement;
    const t = this.cm.transform;

    // Convert canvas coords to screen coords
    const rect = this.cm.container.getBoundingClientRect();
    const screenX = el.x * t.scale + t.panX + rect.left;
    const screenY = el.y * t.scale + t.panY + rect.top;
    const screenW = el.width * t.scale;
    const screenH = el.height * t.scale;

    this._el.style.left = `${screenX}px`;
    this._el.style.top = `${screenY}px`;
    this._el.style.width = `${screenW}px`;
    this._el.style.height = `${screenH}px`;
    this._el.style.borderRadius = '4px';
    this._el.style.boxShadow = '0 0 0 2px var(--primary, #c0c1ff), 0 8px 32px rgba(0,0,0,0.3)';
    this._el.style.background = el.type === 'sticky' ? (el.style?.fillColor || '#c0c1ff') : 'transparent';
  }

  _bindEvents() {
    // Commit on Enter (without shift), cancel on Escape
    this._textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.close(false);
      } else if (e.key === 'Enter' && !e.shiftKey && this.currentElement?.type !== 'sticky') {
        e.preventDefault();
        this.close(true);
      }
    });

    // Commit when clicking outside
    document.addEventListener('pointerdown', (e) => {
      if (this.currentElement && !this._el.contains(e.target)) {
        this.close(true);
      }
    });
  }

  destroy() {
    this._el.remove();
  }
}
