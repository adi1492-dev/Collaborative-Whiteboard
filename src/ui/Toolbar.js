/**
 * Toolbar — Renders the floating tool palette.
 * Matches Stitch Kinetic Canvas designs (glass panel, pill shape).
 */
export class Toolbar {
  constructor(root, inputHandler) {
    this.root = root;
    this.ih = inputHandler;
    this.container = null;
    this.activeBtn = null;
    this.render();
  }

  render() {
    this.container = document.createElement('div');
    this.container.className = 'canvas-toolbar glass elevation-2 anim-slide-up';
    
    // Tools array mapping to InputHandler tool names
    const tools = [
      { id: 'select', icon: 'near_me', tooltip: 'Select (V)' },
      { id: 'pan', icon: 'back_hand', tooltip: 'Pan (H / Space)' },
      { separator: true },
      { id: 'pen', icon: 'draw', tooltip: 'Pen (P)' },
      { id: 'rectangle', icon: 'rectangle', tooltip: 'Rectangle (R)' },
      { id: 'ellipse', icon: 'circle', tooltip: 'Ellipse (O)' },
      { id: 'arrow', icon: 'arrow_right_alt', tooltip: 'Arrow (A)' },
      { id: 'line', icon: 'horizontal_rule', tooltip: 'Line (L)' },
      { separator: true },
      { id: 'sticky', icon: 'sticky_note_2', tooltip: 'Sticky Note (S)' },
      { id: 'text', icon: 'title', tooltip: 'Text (T)' },
      { separator: true },
      { id: 'eraser', icon: 'ink_eraser', tooltip: 'Eraser (E)' }
    ];

    let html = '';
    for (const tool of tools) {
      if (tool.separator) {
        html += `<div class="toolbar-divider"></div>`;
      } else {
        html += `
          <button class="toolbar-btn" data-tool="${tool.id}" aria-label="${tool.tooltip}" title="${tool.tooltip}">
            <span class="material-symbols-outlined">${tool.icon}</span>
          </button>
        `;
      }
    }

    this.container.innerHTML = html;
    this.root.appendChild(this.container);

    this._bindEvents();
    this.setActive('select'); // Default tool
  }

  _bindEvents() {
    const btns = this.container.querySelectorAll('.toolbar-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const toolId = btn.dataset.tool;
        this.ih.setActiveTool(toolId);
        this.setActive(toolId);
      });
    });

    // Listen for keyboard shortcut tool changes from InputHandler
    // We could use an event emitter, but for now we'll just poll or wrap the setter
    const originalSet = this.ih.setActiveTool.bind(this.ih);
    this.ih.setActiveTool = (name) => {
      originalSet(name);
      this.setActive(name);
    };
  }

  setActive(toolId) {
    if (this.activeBtn) {
      this.activeBtn.classList.remove('active');
    }
    this.activeBtn = this.container.querySelector(`.toolbar-btn[data-tool="${toolId}"]`);
    if (this.activeBtn) {
      this.activeBtn.classList.add('active');
    }
  }
}
