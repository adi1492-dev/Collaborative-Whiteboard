/**
 * CommandPalette — Quick action search modal (Ctrl+K / Cmd+K).
 */
export class CommandPalette {
  constructor(boardPage, inputHandler, canvasManager) {
    this.boardPage = boardPage;
    this.ih = inputHandler;
    this.cm = canvasManager;
    
    this.isOpen = false;
    this.container = null;
    this.input = null;
    this.resultsList = null;
    this.selectedIndex = 0;
    
    this.commands = this._buildCommands();
    this.filteredCommands = [];
    
    this._injectUI();
    this._bindEvents();
  }
  
  _buildCommands() {
    return [
      { id: 'tool:select', label: 'Select Tool', icon: 'near_me', action: () => this.ih.setActiveTool('select') },
      { id: 'tool:pan', label: 'Pan Tool', icon: 'pan_tool', action: () => this.ih.setActiveTool('pan') },
      { id: 'tool:pen', label: 'Pen Tool', icon: 'draw', action: () => this.ih.setActiveTool('pen') },
      { id: 'tool:text', label: 'Text Tool', icon: 'text_fields', action: () => this.ih.setActiveTool('text') },
      { id: 'tool:sticky', label: 'Sticky Note', icon: 'sticky_note_2', action: () => this.ih.setActiveTool('sticky') },
      { id: 'tool:rectangle', label: 'Rectangle', icon: 'rectangle', action: () => this.ih.setActiveTool('rectangle') },
      { id: 'tool:circle', label: 'Circle / Ellipse', icon: 'circle', action: () => this.ih.setActiveTool('ellipse') },
      { id: 'tool:arrow', label: 'Arrow', icon: 'arrow_forward', action: () => this.ih.setActiveTool('arrow') },
      { id: 'tool:eraser', label: 'Eraser', icon: 'ink_eraser', action: () => this.ih.setActiveTool('eraser') },
      
      { id: 'view:zoom-in', label: 'Zoom In', icon: 'zoom_in', action: () => { this.cm.transform.zoom(0.1, this.cm.width/2, this.cm.height/2); this.cm.requestStaticRender(); this._updateZoomDisplay(); } },
      { id: 'view:zoom-out', label: 'Zoom Out', icon: 'zoom_out', action: () => { this.cm.transform.zoom(-0.1, this.cm.width/2, this.cm.height/2); this.cm.requestStaticRender(); this._updateZoomDisplay(); } },
      { id: 'view:zoom-fit', label: 'Zoom to Fit', icon: 'fit_screen', action: () => { this.cm.zoomToFit(); this._updateZoomDisplay(); } },
      
      { id: 'action:export', label: 'Export Board', icon: 'download', action: () => {
          const exportBtn = document.getElementById('export-btn');
          if (exportBtn && this.boardPage.exportMgr) {
            this.boardPage.exportMgr.showExportMenu(exportBtn, this.boardPage.boardData?.title);
          }
      }},
      { id: 'action:theme', label: 'Toggle Dark/Light Theme', icon: 'dark_mode', action: () => this.boardPage.app.toggleTheme() },
      { id: 'action:clear', label: 'Clear Selection', icon: 'deselect', action: () => this.boardPage.em.clearSelection() },
      { id: 'action:delete', label: 'Delete Selection', icon: 'delete', action: () => this.boardPage.em.deleteSelection() },
      { id: 'action:undo', label: 'Undo', icon: 'undo', action: () => this.boardPage.history.undo() },
      { id: 'action:redo', label: 'Redo', icon: 'redo', action: () => this.boardPage.history.redo() }
    ];
  }
  
  _updateZoomDisplay() {
    const el = document.getElementById('zoom-display');
    if (el) el.textContent = `${Math.round(this.cm.transform.scale * 100)}%`;
  }
  
  _injectUI() {
    this.container = document.createElement('div');
    this.container.className = 'cmd-palette-backdrop';
    this.container.style.cssText = `
      position: fixed; inset: 0; z-index: 10000;
      background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
      display: none; align-items: flex-start; justify-content: center;
      padding-top: 15vh; opacity: 0; transition: opacity 0.15s ease;
    `;
    
    const modal = document.createElement('div');
    modal.className = 'cmd-palette-modal glass';
    modal.style.cssText = `
      width: 100%; max-width: 600px; border-radius: 12px;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 16px 40px rgba(0,0,0,0.3);
      transform: scale(0.95); transition: transform 0.15s ease;
    `;
    
    const inputWrapper = document.createElement('div');
    inputWrapper.style.cssText = `
      display: flex; align-items: center; padding: 16px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    `;
    
    const searchIcon = document.createElement('span');
    searchIcon.className = 'material-symbols-outlined';
    searchIcon.textContent = 'search';
    searchIcon.style.cssText = 'color: var(--on-surface-variant); margin-right: 12px; font-size: 24px;';
    
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = 'Search commands...';
    this.input.style.cssText = `
      flex: 1; background: transparent; border: none; outline: none;
      font-size: 18px; color: var(--on-surface); font-family: var(--font-body);
    `;
    
    inputWrapper.appendChild(searchIcon);
    inputWrapper.appendChild(this.input);
    
    this.resultsList = document.createElement('div');
    this.resultsList.style.cssText = `
      max-height: 350px; overflow-y: auto; padding: 8px 0;
    `;
    
    modal.appendChild(inputWrapper);
    modal.appendChild(this.resultsList);
    this.container.appendChild(modal);
    document.body.appendChild(this.container);
  }
  
  _bindEvents() {
    this._boundKeyDown = (e) => {
      // Toggle on Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.toggle();
      }
      
      if (!this.isOpen) return;
      
      if (e.key === 'Escape') {
        this.close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredCommands.length - 1);
        this._renderResults();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this._renderResults();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this._executeSelected();
      }
    };
    
    window.addEventListener('keydown', this._boundKeyDown);
    
    this.input.addEventListener('input', () => {
      this.selectedIndex = 0;
      this._filter(this.input.value);
    });
    
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) this.close();
    });
  }
  
  _filter(query) {
    if (!query.trim()) {
      this.filteredCommands = [...this.commands];
    } else {
      const q = query.toLowerCase();
      this.filteredCommands = this.commands.filter(cmd => 
        cmd.label.toLowerCase().includes(q) || cmd.id.toLowerCase().includes(q)
      );
    }
    this._renderResults();
  }
  
  _renderResults() {
    this.resultsList.innerHTML = '';
    
    if (this.filteredCommands.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding: 16px 20px; color: var(--on-surface-variant); text-align: center;';
      empty.textContent = 'No commands found';
      this.resultsList.appendChild(empty);
      return;
    }
    
    this.filteredCommands.forEach((cmd, index) => {
      const item = document.createElement('div');
      item.className = 'cmd-palette-item';
      
      const isSelected = index === this.selectedIndex;
      const bg = isSelected ? 'rgba(192,193,255,0.15)' : 'transparent';
      const color = isSelected ? 'var(--primary)' : 'var(--on-surface)';
      
      item.style.cssText = `
        display: flex; align-items: center; padding: 12px 20px;
        cursor: pointer; background: ${bg}; color: ${color};
        transition: background 0.1s;
      `;
      
      const isLightMode = document.documentElement.getAttribute('data-theme') === 'light';
      if (isSelected && isLightMode) {
         item.style.background = 'rgba(63,59,189,0.1)';
      }
      
      item.onmouseover = () => {
        this.selectedIndex = index;
        this._renderResults();
      };
      
      item.onclick = () => this._executeSelected();
      
      const icon = document.createElement('span');
      icon.className = 'material-symbols-outlined';
      icon.textContent = cmd.icon;
      icon.style.cssText = 'margin-right: 16px; font-size: 20px;';
      
      const label = document.createElement('span');
      label.textContent = cmd.label;
      label.style.fontSize = '14px';
      
      item.appendChild(icon);
      item.appendChild(label);
      
      // Auto-scroll logic
      if (isSelected) {
        // Delay to allow DOM update
        setTimeout(() => {
          item.scrollIntoView({ block: 'nearest' });
        }, 0);
      }
      
      this.resultsList.appendChild(item);
    });
  }
  
  _executeSelected() {
    const cmd = this.filteredCommands[this.selectedIndex];
    if (cmd) {
      this.close();
      cmd.action();
    }
  }
  
  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }
  
  open() {
    this.isOpen = true;
    this.input.value = '';
    this.selectedIndex = 0;
    this._filter('');
    
    this.container.style.display = 'flex';
    // Trigger reflow
    void this.container.offsetWidth;
    this.container.style.opacity = '1';
    this.container.querySelector('.cmd-palette-modal').style.transform = 'scale(1)';
    
    this.input.focus();
  }
  
  close() {
    this.isOpen = false;
    this.container.style.opacity = '0';
    this.container.querySelector('.cmd-palette-modal').style.transform = 'scale(0.95)';
    setTimeout(() => {
      this.container.style.display = 'none';
    }, 150);
  }
  
  destroy() {
    if (this._boundKeyDown) {
      window.removeEventListener('keydown', this._boundKeyDown);
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
