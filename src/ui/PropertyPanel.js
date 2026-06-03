/**
 * PropertyPanel — Advanced context panel for element style editing.
 * Stroke color, fill color, stroke width, opacity, font size, text alignment.
 */
export class PropertyPanel {
  constructor(root, inputHandler, elementManager, syncManager) {
    this.root = root;
    this.ih = inputHandler;
    this.em = elementManager;
    this.sync = syncManager;

    this.container = document.createElement('div');
    this.container.className = 'property-panel glass elevation-3 anim-slide-up';
    this.container.style.cssText = `
      position:absolute; bottom:88px; left:50%; transform:translateX(-50%);
      display:none; padding:10px 16px; border-radius:16px;
      gap:14px; align-items:center; pointer-events:auto; flex-wrap:wrap;
      max-width:calc(100vw - 200px);
    `;

    this.strokeColors = [
      '#e5e2e1', '#908fa0', '#c0c1ff', '#4cd7f6', '#ffb2b7',
      '#ffd166', '#06d6a0', '#ef476f', '#131313', 'transparent'
    ];

    this.fillColors = [
      'transparent', '#c0c1ff', '#4cd7f6', '#ffb2b7', '#ffd166',
      '#06d6a0', '#a8dadc', '#ffc8dd', '#e9c46a', '#264653'
    ];

    this.render();
    this.root.appendChild(this.container);
    this._bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <!-- Stroke Color -->
      <div class="pp-group">
        <span class="pp-label">Stroke</span>
        <div class="pp-swatches" id="stroke-swatches">
          ${this.strokeColors.map(c => this._swatchHTML(c, 'stroke')).join('')}
          <label class="pp-swatch pp-custom-color" title="Custom color">
            <input type="color" id="custom-stroke-color" style="opacity:0;width:0;height:0;position:absolute;">
            <span class="material-symbols-outlined" style="font-size:14px">colorize</span>
          </label>
        </div>
      </div>

      <div class="pp-divider"></div>

      <!-- Fill Color -->
      <div class="pp-group">
        <span class="pp-label">Fill</span>
        <div class="pp-swatches" id="fill-swatches">
          ${this.fillColors.map(c => this._swatchHTML(c, 'fill')).join('')}
          <label class="pp-swatch pp-custom-color" title="Custom fill">
            <input type="color" id="custom-fill-color" style="opacity:0;width:0;height:0;position:absolute;">
            <span class="material-symbols-outlined" style="font-size:14px">colorize</span>
          </label>
        </div>
      </div>

      <div class="pp-divider"></div>

      <!-- Stroke Width -->
      <div class="pp-group">
        <span class="pp-label">Width</span>
        <input type="range" id="stroke-width" min="1" max="24" value="2"
          style="width:80px;accent-color:var(--primary);">
        <span id="stroke-width-val" class="pp-val">2</span>
      </div>

      <div class="pp-divider"></div>

      <!-- Opacity -->
      <div class="pp-group">
        <span class="pp-label">Opacity</span>
        <input type="range" id="opacity-slider" min="10" max="100" value="100"
          style="width:70px;accent-color:var(--primary);">
        <span id="opacity-val" class="pp-val">100%</span>
      </div>

      <div class="pp-divider" id="font-divider" style="display:none"></div>

      <!-- Font Size (text/sticky only) -->
      <div class="pp-group" id="font-group" style="display:none">
        <span class="pp-label">Size</span>
        <input type="number" id="font-size" min="8" max="96" value="14"
          style="width:52px;background:var(--surface-container);border:1px solid var(--outline-variant);border-radius:6px;padding:3px 6px;color:var(--on-surface);font-size:12px;text-align:center;">
        <div style="display:flex;gap:2px;margin-left:4px;">
          <button class="pp-align-btn" data-align="left" title="Left">
            <span class="material-symbols-outlined" style="font-size:14px">format_align_left</span>
          </button>
          <button class="pp-align-btn" data-align="center" title="Center">
            <span class="material-symbols-outlined" style="font-size:14px">format_align_center</span>
          </button>
          <button class="pp-align-btn" data-align="right" title="Right">
            <span class="material-symbols-outlined" style="font-size:14px">format_align_right</span>
          </button>
        </div>
      </div>

      <div class="pp-divider" id="ui-divider" style="display:none"></div>

      <!-- Dynamic UI Element Properties -->
      <div class="pp-group" id="ui-props-group" style="display:none; gap: 8px;">
        <!-- Injected via JS -->
      </div>
    `;

    this._injectPPStyles();
  }

  _swatchHTML(c, type) {
    const isTransp = c === 'transparent';
    const bg = isTransp ? 'rgba(255,255,255,0.04)' : c;
    const border = isTransp ? '1px dashed var(--outline-variant)' : '1px solid rgba(255,255,255,0.12)';
    return `<button class="pp-swatch" data-color="${c}" data-type="${type}"
      style="background:${bg};border:${border};${isTransp ? 'position:relative;overflow:hidden;' : ''}"
      title="${isTransp ? 'None/Transparent' : c}">
      ${isTransp ? '<div style="position:absolute;top:11px;left:0;right:0;height:1px;background:var(--error);transform:rotate(-30deg);"></div>' : ''}
    </button>`;
  }

  _bindEvents() {
    // Swatch clicks (stroke + fill)
    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest('.pp-swatch[data-color]');
      if (!btn) return;
      this._applyColor(btn.dataset.color, btn.dataset.type);
    });

    // Custom color pickers
    this.container.querySelector('#custom-stroke-color')?.addEventListener('input', (e) => {
      this._applyColor(e.target.value, 'stroke');
    });
    this.container.querySelector('#custom-fill-color')?.addEventListener('input', (e) => {
      this._applyColor(e.target.value, 'fill');
    });

    // Stroke width
    const sw = this.container.querySelector('#stroke-width');
    const swVal = this.container.querySelector('#stroke-width-val');
    sw?.addEventListener('input', (e) => {
      swVal.textContent = e.target.value;
      this._applyStrokeWidth(parseInt(e.target.value));
    });

    // Opacity
    const op = this.container.querySelector('#opacity-slider');
    const opVal = this.container.querySelector('#opacity-val');
    op?.addEventListener('input', (e) => {
      opVal.textContent = `${e.target.value}%`;
      this._applyOpacity(parseInt(e.target.value) / 100);
    });

    // Font size
    const fs = this.container.querySelector('#font-size');
    fs?.addEventListener('change', (e) => this._applyFontSize(parseInt(e.target.value)));

    // Text alignment
    this.container.querySelectorAll('.pp-align-btn').forEach(btn => {
      btn.addEventListener('click', () => this._applyTextAlign(btn.dataset.align));
    });

    // UI Props dynamic event delegation
    this.container.addEventListener('input', (e) => {
      if (e.target.matches('.ui-prop-input')) {
        this._applyUIProp(e.target.dataset.prop, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
      }
    });
    this.container.addEventListener('change', (e) => {
      if (e.target.matches('.ui-theme-select')) {
        this._applyUITheme(e.target.value);
      }
    });
  }

  _applyUIProp(prop, value) {
    if (this.ih.activeTool?.name === 'select') {
      for (const id of this.em.selectedIds) {
        const el = this.em.elements.get(id);
        if (el && el.type === 'ui') {
          el.props = { ...el.props, [prop]: value };
          if (this.sync) this.sync.broadcastUpdate(el);
        }
      }
      this.em.cm.requestStaticRender();
    }
  }

  _applyUITheme(theme) {
    if (this.ih.activeTool?.name === 'select') {
      for (const id of this.em.selectedIds) {
        const el = this.em.elements.get(id);
        if (el && el.type === 'ui') {
          el.uiTheme = theme;
          if (this.sync) this.sync.broadcastUpdate(el);
        }
      }
      this.em.cm.requestStaticRender();
    }
  }

  _applyColor(color, type) {
    const isSelect = this.ih.activeTool?.name === 'select';
    if (isSelect) {
      for (const id of this.em.selectedIds) {
        const el = this.em.elements.get(id);
        if (!el) continue;
        if (type === 'stroke') el.style.strokeColor = color;
        else el.style.fillColor = color;
        if (this.sync) this.sync.broadcastUpdate(el);
      }
      this.em.cm.requestStaticRender();
    } else if (this.ih.activeTool) {
      if (type === 'stroke') this.ih.activeTool.color = color;
      else this.ih.activeTool.fillColor = color;
    }
  }

  _applyStrokeWidth(w) {
    if (this.ih.activeTool?.name === 'select') {
      for (const id of this.em.selectedIds) {
        const el = this.em.elements.get(id);
        if (el) { el.style.strokeWidth = w; if (this.sync) this.sync.broadcastUpdate(el); }
      }
      this.em.cm.requestStaticRender();
    } else if (this.ih.activeTool) {
      this.ih.activeTool.strokeWidth = w;
    }
  }

  _applyOpacity(val) {
    if (this.ih.activeTool?.name === 'select') {
      for (const id of this.em.selectedIds) {
        const el = this.em.elements.get(id);
        if (el) { el.opacity = val; if (this.sync) this.sync.broadcastUpdate(el); }
      }
      this.em.cm.requestStaticRender();
    }
  }

  _applyFontSize(size) {
    if (this.ih.activeTool?.name === 'select') {
      for (const id of this.em.selectedIds) {
        const el = this.em.elements.get(id);
        if (el && (el.type === 'sticky' || el.type === 'text')) {
          el.style.fontSize = size;
          if (this.sync) this.sync.broadcastUpdate(el);
        }
      }
      this.em.cm.requestStaticRender();
    }
  }

  _applyTextAlign(align) {
    if (this.ih.activeTool?.name === 'select') {
      for (const id of this.em.selectedIds) {
        const el = this.em.elements.get(id);
        if (el && (el.type === 'sticky' || el.type === 'text')) {
          el.style.textAlign = align;
          if (this.sync) this.sync.broadcastUpdate(el);
        }
      }
      this.em.cm.requestStaticRender();
    }
    // Update active button
    this.container.querySelectorAll('.pp-align-btn').forEach(btn => {
      btn.style.background = btn.dataset.align === align ? 'rgba(192,193,255,0.2)' : 'transparent';
    });
  }

  /** Sync panel state to the currently selected element */
  syncToSelection() {
    if (this.ih.activeTool?.name !== 'select' || this.em.selectedIds.size === 0) return;
    const id = [...this.em.selectedIds][0];
    const el = this.em.elements.get(id);
    if (!el) return;

    // Show/hide font controls
    const hasText = el.type === 'sticky' || el.type === 'text';
    const fontGroup = this.container.querySelector('#font-group');
    const fontDivider = this.container.querySelector('#font-divider');
    if (fontGroup) fontGroup.style.display = hasText ? 'flex' : 'none';
    if (fontDivider) fontDivider.style.display = hasText ? 'block' : 'none';

    // Sync slider values
    const sw = this.container.querySelector('#stroke-width');
    const swVal = this.container.querySelector('#stroke-width-val');
    if (sw && el.style.strokeWidth !== undefined) {
      sw.value = el.style.strokeWidth;
      if (swVal) swVal.textContent = el.style.strokeWidth;
    }

    const op = this.container.querySelector('#opacity-slider');
    const opVal = this.container.querySelector('#opacity-val');
    if (op) {
      op.value = Math.round(el.opacity * 100);
      if (opVal) opVal.textContent = `${Math.round(el.opacity * 100)}%`;
    }

    const fs = this.container.querySelector('#font-size');
    if (fs && el.style.fontSize) fs.value = el.style.fontSize;

    // Show/hide UI Element controls
    const isUI = el.type === 'ui';
    const uiGroup = this.container.querySelector('#ui-props-group');
    const uiDivider = this.container.querySelector('#ui-divider');
    if (uiGroup) uiGroup.style.display = isUI ? 'flex' : 'none';
    if (uiDivider) uiDivider.style.display = isUI ? 'block' : 'none';
    
    if (isUI && uiGroup) {
      this._renderUIProps(el, uiGroup);
    }
  }

  _renderUIProps(el, container) {
    let html = '';
    const textInput = (prop, label, width='80px') => `
      <div style="display:flex;flex-direction:column;gap:2px;">
        <span style="font-size:9px;color:var(--on-surface-variant);text-transform:uppercase;">${label}</span>
        <input type="text" class="ui-prop-input" data-prop="${prop}" value="${(el.props[prop] || '').replace(/"/g, '&quot;')}" 
               style="width:${width};background:var(--surface-container);border:1px solid var(--outline-variant);border-radius:4px;padding:4px;color:var(--on-surface);font-size:11px;">
      </div>
    `;
    const selectInput = (prop, label, options) => `
      <div style="display:flex;flex-direction:column;gap:2px;">
        <span style="font-size:9px;color:var(--on-surface-variant);text-transform:uppercase;">${label}</span>
        <select class="ui-prop-input" data-prop="${prop}" style="background:var(--surface-container);border:1px solid var(--outline-variant);border-radius:4px;padding:3px;color:var(--on-surface);font-size:11px;">
          ${options.map(o => `<option value="${o}" ${el.props[prop] === o ? 'selected' : ''}>${o}</option>`).join('')}
        </select>
      </div>
    `;
    const checkInput = (prop, label) => `
      <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--on-surface);cursor:pointer;margin-top:12px;">
        <input type="checkbox" class="ui-prop-input" data-prop="${prop}" ${el.props[prop] ? 'checked' : ''}>
        ${label}
      </label>
    `;

    // Component-specific fields
    switch (el.component) {
      case 'button':
      case 'badge':
        html += textInput('label', 'Label');
        html += selectInput('variant', 'Variant', ['primary', 'outlined', 'ghost', 'success', 'warning', 'error']);
        break;
      case 'input':
        html += textInput('placeholder', 'Placeholder', '120px');
        break;
      case 'card':
        html += textInput('title', 'Title', '100px');
        html += textInput('body', 'Body', '140px');
        break;
      case 'dropdown':
        html += textInput('label', 'Label');
        break;
      case 'navbar':
        html += textInput('title', 'Brand');
        break;
      case 'modal':
        html += textInput('title', 'Title', '100px');
        html += textInput('body', 'Message', '140px');
        break;
      case 'toggle':
        html += checkInput('checked', 'Checked');
        break;
    }

    // Theme selector
    html += `
      <div style="width:1px;height:24px;background:rgba(255,255,255,0.08);margin:0 4px;"></div>
      <div style="display:flex;flex-direction:column;gap:2px;">
        <span style="font-size:9px;color:var(--on-surface-variant);text-transform:uppercase;">Theme</span>
        <select class="ui-theme-select" style="background:var(--surface-container);border:1px solid var(--outline-variant);border-radius:4px;padding:3px;color:var(--on-surface);font-size:11px;">
          <option value="dark" ${el.uiTheme === 'dark' ? 'selected' : ''}>Dark</option>
          <option value="light" ${el.uiTheme === 'light' ? 'selected' : ''}>Light</option>
        </select>
      </div>
    `;

    container.innerHTML = html;
  }

  show() {
    this.container.style.display = 'flex';
    this.syncToSelection();
  }

  hide() {
    this.container.style.display = 'none';
  }

  _injectPPStyles() {
    if (document.getElementById('pp-styles')) return;
    const style = document.createElement('style');
    style.id = 'pp-styles';
    style.textContent = `
      .pp-group { display:flex; align-items:center; gap:6px; }
      .pp-label { font-size:10px; color:var(--on-surface-variant); font-family:var(--font-label); text-transform:uppercase; letter-spacing:0.05em; white-space:nowrap; }
      .pp-val { font-size:11px; color:var(--on-surface-variant); font-family:var(--font-mono); min-width:28px; }
      .pp-divider { width:1px; height:28px; background:rgba(255,255,255,0.08); flex-shrink:0; }
      [data-theme="light"] .pp-divider { background:var(--outline-variant); }
      .pp-swatches { display:flex; gap:4px; align-items:center; flex-wrap:wrap; }
      .pp-swatch {
        width:22px; height:22px; border-radius:50%; cursor:pointer;
        flex-shrink:0; transition:transform 0.15s, box-shadow 0.15s;
        position:relative; overflow:hidden;
      }
      .pp-swatch:hover { transform:scale(1.25); box-shadow:0 0 0 2px var(--primary); }
      .pp-custom-color {
        width:22px; height:22px; border-radius:50%; cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        background:rgba(255,255,255,0.05); border:1px dashed var(--outline);
        color:var(--on-surface-variant); transition:all 0.15s;
      }
      .pp-custom-color:hover { background:rgba(192,193,255,0.15); color:var(--primary); }
      .pp-align-btn {
        width:24px; height:24px; border-radius:4px; border:none; background:transparent;
        cursor:pointer; color:var(--on-surface-variant); display:flex; align-items:center; justify-content:center;
        transition:all 0.15s;
      }
      .pp-align-btn:hover { background:rgba(255,255,255,0.08); color:var(--primary); }
    `;
    document.head.appendChild(style);
  }
}
