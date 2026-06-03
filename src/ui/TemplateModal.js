/**
 * TemplateModal — Beautiful template picker modal.
 * Shows 4 templates with animated previews, descriptions, and a Load button.
 */
import { TEMPLATES } from '../templates/TemplateData.js';
import { generateId } from '../utils/uid.js';

export class TemplateModal {
  constructor(syncManager, elementManager, canvasManager) {
    this.sync = syncManager;
    this.em = elementManager;
    this.cm = canvasManager;
    this._el = null;
    this._injectStyles();
  }

  show() {
    if (this._el) this.hide();
    
    this._el = document.createElement('div');
    this._el.className = 'tm-overlay';
    this._el.innerHTML = `
      <div class="tm-modal glass elevation-3">
        <div class="tm-header">
          <div>
            <h2 class="tm-title">Board Templates</h2>
            <p class="tm-subtitle">Start with a pre-built layout and customize it your way</p>
          </div>
          <button class="icon-btn tm-close" id="tm-close-btn" title="Close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="tm-grid">
          ${Object.values(TEMPLATES).map(t => `
            <div class="tm-card" data-template="${t.id}" tabindex="0" role="button">
              <div class="tm-card-preview tm-preview-${t.id}">
                <span class="tm-emoji">${t.icon}</span>
              </div>
              <div class="tm-card-body">
                <div class="tm-card-name">${t.name}</div>
                <div class="tm-card-desc">${t.description}</div>
                <button class="btn-primary tm-load-btn" data-template="${t.id}">
                  <span class="material-symbols-outlined" style="font-size:16px">add</span>
                  Load Template
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    document.body.appendChild(this._el);
    requestAnimationFrame(() => this._el?.classList.add('visible'));

    // Bind events
    this._el.querySelector('#tm-close-btn').addEventListener('click', () => this.hide());
    this._el.addEventListener('click', (e) => {
      if (e.target === this._el) this.hide();
    });
    this._el.querySelectorAll('.tm-load-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._loadTemplate(btn.dataset.template);
      });
    });
  }

  hide() {
    if (!this._el) return;
    this._el.classList.remove('visible');
    setTimeout(() => {
      this._el?.remove();
      this._el = null;
    }, 250);
  }

  _loadTemplate(templateId) {
    const template = TEMPLATES[templateId];
    if (!template) return;

    const { Toast } = window.__Toast || {};

    // Offset all elements so they appear centered in the current viewport
    const viewCenterX = this.cm ? this.cm.width / 2 : 400;
    const viewCenterY = this.cm ? this.cm.height / 2 : 300;

    // Compute template bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of template.elements) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }
    const templateCenterX = (minX + maxX) / 2;
    const templateCenterY = (minY + maxY) / 2;

    // World offset based on current transform
    const scale = this.cm?.transform?.scale || 1;
    const panX = this.cm?.transform?.panX || 0;
    const panY = this.cm?.transform?.panY || 0;
    const worldCenterX = (viewCenterX - panX) / scale;
    const worldCenterY = (viewCenterY - panY) / scale;
    const offsetX = worldCenterX - templateCenterX;
    const offsetY = worldCenterY - templateCenterY;

    // Create each element with a fresh ID and offset position
    let created = 0;
    for (const rawEl of template.elements) {
      const el = {
        ...rawEl,
        id: generateId(),
        x: rawEl.x + offsetX,
        y: rawEl.y + offsetY,
        updatedAt: Date.now(),
        createdAt: Date.now(),
      };

      // Hydrate via SyncManager so it goes through the correct factory
      const hydrated = this.sync._hydrateElement(el);
      if (hydrated) {
        this.em.setElement(hydrated);
        this.sync.broadcastCreate(hydrated);
        created++;
      }
    }

    this.cm?.requestStaticRender();
    this.hide();

    import('../ui/Toast.js').then(({ Toast }) => {
      Toast.show(`✨ ${template.name} template loaded (${created} elements)`, 'success', 3000);
    });
  }

  _injectStyles() {
    if (document.getElementById('tm-styles')) return;
    const style = document.createElement('style');
    style.id = 'tm-styles';
    style.textContent = `
      .tm-overlay {
        position: fixed; inset: 0; z-index: 10000;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        opacity: 0; transition: opacity 0.25s ease;
      }
      .tm-overlay.visible { opacity: 1; }
      .tm-modal {
        width: min(960px, 96vw); max-height: 90vh;
        border-radius: 20px; padding: 32px;
        overflow-y: auto;
        transform: translateY(20px); transition: transform 0.25s ease;
      }
      .tm-overlay.visible .tm-modal { transform: translateY(0); }
      .tm-header {
        display: flex; justify-content: space-between; align-items: flex-start;
        margin-bottom: 28px;
      }
      .tm-title { font-size: 24px; font-weight: 700; color: var(--on-surface); margin: 0 0 4px; }
      .tm-subtitle { font-size: 14px; color: var(--on-surface-variant); margin: 0; }
      .tm-close { flex-shrink: 0; }
      .tm-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
      }
      .tm-card {
        border-radius: 14px; overflow: hidden;
        border: 1.5px solid var(--outline-variant);
        background: var(--surface-container);
        cursor: pointer; transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
        outline: none;
      }
      .tm-card:hover, .tm-card:focus { 
        transform: translateY(-4px); 
        border-color: var(--primary); 
        box-shadow: 0 8px 24px rgba(192,193,255,0.15);
      }
      .tm-card-preview {
        height: 140px; display: flex; align-items: center; justify-content: center;
        position: relative; overflow: hidden;
      }
      .tm-preview-brainstorming { background: radial-gradient(ellipse at center, rgba(192,193,255,0.15) 0%, rgba(192,193,255,0.03) 70%); }
      .tm-preview-wireframe { background: radial-gradient(ellipse at center, rgba(156,163,175,0.15) 0%, rgba(156,163,175,0.03) 70%); }
      .tm-preview-retro { background: linear-gradient(135deg, rgba(52,211,153,0.1) 0%, rgba(248,113,113,0.1) 50%, rgba(96,165,250,0.1) 100%); }
      .tm-preview-mindmap { background: radial-gradient(ellipse at center, rgba(192,193,255,0.2) 0%, rgba(251,191,36,0.05) 70%); }
      .tm-emoji { font-size: 52px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3)); }
      .tm-card-body { padding: 16px; }
      .tm-card-name { font-size: 15px; font-weight: 600; color: var(--on-surface); margin-bottom: 6px; }
      .tm-card-desc { font-size: 12px; color: var(--on-surface-variant); line-height: 1.5; margin-bottom: 12px; min-height: 54px; }
      .tm-load-btn {
        display: flex; align-items: center; gap: 6px;
        width: 100%; justify-content: center; font-size: 13px; padding: 8px;
      }
    `;
    document.head.appendChild(style);
  }
}
