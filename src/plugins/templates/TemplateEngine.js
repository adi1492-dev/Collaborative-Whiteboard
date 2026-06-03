/**
 * TemplateEngine — Manages loading and inserting pre-defined templates.
 */
import { generateId } from '../../utils/uid.js';

const TEMPLATES = [
  {
    id: 'kanban',
    name: 'Kanban Board',
    icon: 'view_kanban',
    description: 'A basic Kanban board with To Do, In Progress, and Done columns.',
    elements: [
      {
        type: 'shape', shapeType: 'rectangle', x: 0, y: 0, width: 900, height: 600, locked: true, zIndex: -10,
        style: { strokeColor: 'var(--primary)', fillColor: 'transparent', strokeWidth: 2 }
      },
      // To Do Column
      {
        type: 'text', x: 20, y: 20, width: 250, height: 40, locked: true, text: 'To Do',
        style: { fontSize: 24, textAlign: 'center', strokeColor: 'var(--on-surface)' }
      },
      {
        type: 'shape', shapeType: 'line', x: 300, y: 0, width: 2, height: 600, locked: true,
        style: { strokeColor: 'rgba(192,193,255,0.3)', strokeWidth: 2 }
      },
      // In Progress Column
      {
        type: 'text', x: 320, y: 20, width: 250, height: 40, locked: true, text: 'In Progress',
        style: { fontSize: 24, textAlign: 'center', strokeColor: 'var(--on-surface)' }
      },
      {
        type: 'shape', shapeType: 'line', x: 600, y: 0, width: 2, height: 600, locked: true,
        style: { strokeColor: 'rgba(192,193,255,0.3)', strokeWidth: 2 }
      },
      // Done Column
      {
        type: 'text', x: 620, y: 20, width: 250, height: 40, locked: true, text: 'Done',
        style: { fontSize: 24, textAlign: 'center', strokeColor: 'var(--on-surface)' }
      },
      // Sample Sticky Notes
      { type: 'sticky', x: 50, y: 80, width: 200, height: 200, text: 'Task 1', style: { fillColor: '#fff9b1' } },
      { type: 'sticky', x: 350, y: 80, width: 200, height: 200, text: 'Task 2 (WIP)', style: { fillColor: '#b1ffc8' } }
    ]
  },
  {
    id: 'flowchart',
    name: 'Flowchart',
    icon: 'account_tree',
    description: 'Basic flowchart starting point.',
    elements: [
      { type: 'shape', shapeType: 'ellipse', x: 100, y: 0, width: 160, height: 80, text: 'Start', style: { fillColor: 'var(--primary)' } },
      { type: 'shape', shapeType: 'rectangle', x: 100, y: 150, width: 160, height: 80, text: 'Process 1' },
      { type: 'shape', shapeType: 'diamond', x: 100, y: 300, width: 160, height: 160, text: 'Decision?' },
      { type: 'shape', shapeType: 'ellipse', x: 100, y: 550, width: 160, height: 80, text: 'End', style: { fillColor: 'var(--primary)' } }
    ]
  }
];

export class TemplateEngine {
  constructor(boardPage) {
    this.boardPage = boardPage;
    this.em = boardPage.em;
    this.cm = boardPage.cm;
    this.sync = boardPage.sync;
    
    this.isOpen = false;
    this.container = null;
    
    this._injectUI();
  }

  getTemplates() {
    return TEMPLATES;
  }

  insertTemplate(templateId) {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    // Get center of current viewport in canvas coordinates
    const viewportCenterX = this.cm.transform.panX * -1 + (this.cm.width / 2) / this.cm.transform.scale;
    const viewportCenterY = this.cm.transform.panY * -1 + (this.cm.height / 2) / this.cm.transform.scale;

    // Calculate bounds of template
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    template.elements.forEach(el => {
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
      if (el.x + (el.width || 0) > maxX) maxX = el.x + (el.width || 0);
      if (el.y + (el.height || 0) > maxY) maxY = el.y + (el.height || 0);
    });

    const tempWidth = maxX - minX;
    const tempHeight = maxY - minY;

    // Calculate offset to place template at viewport center
    const offsetX = viewportCenterX - (tempWidth / 2) - minX;
    const offsetY = viewportCenterY - (tempHeight / 2) - minY;

    const newElements = template.elements.map(data => {
      // Create new hydrated element through sync layer
      const elData = {
        ...data,
        id: generateId(),
        x: data.x + offsetX,
        y: data.y + offsetY
      };
      return this.sync._hydrateElement(elData);
    }).filter(Boolean);

    // Auto-correct template elements to match current canvas background
    this.cm.autoCorrectElements(newElements);

    // Batch insert and sync
    newElements.forEach(el => {
      this.em.setElement(el, false);
      if (this.sync) {
        this.sync.dirtyElements.set(el.id, el.toJSON());
        this.sync.broadcastUpdate(el);
      }
    });

    // Record history
    this.boardPage.history.record({
      type: 'bulk_create',
      elements: newElements.map(el => el.toJSON())
    });

    this.cm.requestStaticRender();
    this.close();
  }

  _injectUI() {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);
      display: none; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.2s;
    `;
    
    const modal = document.createElement('div');
    modal.className = 'glass';
    modal.style.cssText = `
      width: 90%; max-width: 800px; border-radius: 16px;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 24px 48px rgba(0,0,0,0.4);
      background: var(--surface-container-high);
    `;
    
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.08);
      display: flex; justify-content: space-between; align-items: center;
    `;
    header.innerHTML = `
      <h2 style="margin:0; font-size:20px; color:var(--on-surface);">Templates Library</h2>
      <button id="close-templates-btn" class="icon-btn"><span class="material-symbols-outlined">close</span></button>
    `;
    
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px; padding: 24px; max-height: 60vh; overflow-y: auto;
    `;
    
    TEMPLATES.forEach(t => {
      const card = document.createElement('div');
      card.style.cssText = `
        background: var(--surface-container); border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px; padding: 16px; cursor: pointer;
        transition: transform 0.2s, background 0.2s, border-color 0.2s;
        display: flex; flex-direction: column; align-items: flex-start;
      `;
      card.onmouseover = () => {
        card.style.transform = 'translateY(-4px)';
        card.style.borderColor = 'var(--primary)';
        card.style.background = 'var(--surface-container-highest)';
      };
      card.onmouseout = () => {
        card.style.transform = 'translateY(0)';
        card.style.borderColor = 'rgba(255,255,255,0.08)';
        card.style.background = 'var(--surface-container)';
      };
      card.onclick = () => this.insertTemplate(t.id);
      
      card.innerHTML = `
        <div style="background:var(--primary); color:white; width:40px; height:40px; border-radius:8px; display:flex; align-items:center; justify-content:center; margin-bottom:12px;">
          <span class="material-symbols-outlined">${t.icon}</span>
        </div>
        <h3 style="margin:0 0 8px 0; font-size:16px; color:var(--on-surface);">${t.name}</h3>
        <p style="margin:0; font-size:13px; color:var(--on-surface-variant); line-height:1.4;">${t.description}</p>
      `;
      grid.appendChild(card);
    });
    
    modal.appendChild(header);
    modal.appendChild(grid);
    this.container.appendChild(modal);
    document.body.appendChild(this.container);
    
    header.querySelector('#close-templates-btn').onclick = () => this.close();
    this.container.onclick = (e) => { if (e.target === this.container) this.close(); };
  }
  
  open() {
    this.isOpen = true;
    this.container.style.display = 'flex';
    void this.container.offsetWidth; // Force reflow
    this.container.style.opacity = '1';
  }
  
  close() {
    this.isOpen = false;
    this.container.style.opacity = '0';
    setTimeout(() => { this.container.style.display = 'none'; }, 200);
  }
  
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
