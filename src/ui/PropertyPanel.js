/**
 * PropertyPanel — Context menu for changing colors, stroke width, etc.
 */
export class PropertyPanel {
  constructor(root, inputHandler, elementManager, syncManager) {
    this.root = root;
    this.ih = inputHandler;
    this.em = elementManager;
    this.sync = syncManager;
    
    this.container = document.createElement('div');
    this.container.className = 'property-panel glass elevation-3 anim-slide-up';
    this.container.style.position = 'absolute';
    this.container.style.bottom = '96px';
    this.container.style.left = '50%';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.display = 'none';
    this.container.style.padding = '8px 16px';
    this.container.style.borderRadius = 'var(--radius-xl)';
    this.container.style.gap = '16px';
    this.container.style.alignItems = 'center';
    this.container.style.pointerEvents = 'auto';
    
    // Preset colors from DESIGN.md
    this.colors = [
      '#e5e2e1', // White/text
      '#908fa0', // Gray
      '#c0c1ff', // Primary Indigo
      '#4cd7f6', // Secondary Cyan
      '#ffb2b7', // Tertiary Rose
      '#ffb4ab', // Error Red
      'transparent'
    ];
    
    this.render();
    this.root.appendChild(this.container);
    
    this._bindEvents();
  }

  render() {
    let html = `
      <div style="display:flex; flex-direction:column; gap:6px;">
        <span class="label-sm" style="color:var(--on-surface-variant)">Color</span>
        <div style="display:flex; gap:6px;" id="color-swatches">
    `;
    
    for (const c of this.colors) {
      const isTransparent = c === 'transparent';
      const style = isTransparent 
        ? `background: rgba(255,255,255,0.05); border: 1px dashed var(--outline-variant); position:relative;` 
        : `background: ${c}; border: 1px solid rgba(255,255,255,0.1);`;
        
      html += `
        <button class="color-btn" data-color="${c}" style="width:24px; height:24px; border-radius:50%; cursor:pointer; ${style}">
           ${isTransparent ? '<div style="position:absolute; top:11px; left:2px; right:2px; height:1px; background:var(--error); transform:rotate(45deg);"></div>' : ''}
        </button>
      `;
    }
    
    html += `
        </div>
      </div>
      <div class="toolbar-divider" style="height: 32px;"></div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        <span class="label-sm" style="color:var(--on-surface-variant)">Stroke Thickness</span>
        <input type="range" id="stroke-width" min="1" max="20" value="3" style="width: 100px; accent-color: var(--primary);">
      </div>
    `;
    
    this.container.innerHTML = html;
  }
  
  _bindEvents() {
    const colorBtns = this.container.querySelectorAll('.color-btn');
    colorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const c = btn.dataset.color;
        this._updateColor(c);
      });
    });
    
    const strokeSlider = this.container.querySelector('#stroke-width');
    strokeSlider.addEventListener('input', (e) => {
      this._updateStroke(parseInt(e.target.value));
    });
  }
  
  _updateColor(c) {
    if (this.ih.activeTool && this.ih.activeTool.name === 'select') {
      const selectedIds = Array.from(this.em.selectedIds);
      if (selectedIds.length > 0) {
        for (const id of selectedIds) {
          const el = this.em.elements.get(id);
          if (el) {
            if (el.type === 'text' || el.type === 'sticky') {
              el.style.fillColor = c;
            } else if (el.type === 'freehand' || el.type === 'line' || el.type === 'arrow') {
              el.style.strokeColor = c;
            } else {
              // Shapes can have fill or stroke. Let's do fill if it's currently transparent?
              // Standard behavior: clicking a color changes the stroke, unless it's a sticky note
              // Actually, let's change stroke color, and if they click transparent, we change fill.
              // For simplicity, change strokeColor.
              el.style.strokeColor = c;
            }
            if (this.sync) this.sync.broadcastUpdate(el);
          }
        }
        this.em.cm.requestStaticRender();
      }
    } else {
      if (this.ih.activeTool) {
        this.ih.activeTool.color = c;
      }
    }
  }
  
  _updateStroke(w) {
    if (this.ih.activeTool && this.ih.activeTool.name === 'select') {
      const selectedIds = Array.from(this.em.selectedIds);
      if (selectedIds.length > 0) {
        for (const id of selectedIds) {
          const el = this.em.elements.get(id);
          if (el) {
            el.style.strokeWidth = w;
            if (this.sync) this.sync.broadcastUpdate(el);
          }
        }
        this.em.cm.requestStaticRender();
      }
    } else {
      if (this.ih.activeTool) {
        this.ih.activeTool.strokeWidth = w;
      }
    }
  }
  
  show() {
    this.container.style.display = 'flex';
  }
  
  hide() {
    this.container.style.display = 'none';
  }
}
