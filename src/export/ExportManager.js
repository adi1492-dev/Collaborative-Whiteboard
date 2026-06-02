/**
 * ExportManager — Export the whiteboard as PNG, SVG, or JSON.
 */
import { FreehandElement } from '../elements/FreehandElement.js';
import { ShapeElement } from '../elements/ShapeElement.js';
import { StickyNote } from '../elements/StickyNote.js';
import { TextElement } from '../elements/TextElement.js';

export class ExportManager {
  constructor(canvasManager, elementManager) {
    this.cm = canvasManager;
    this.em = elementManager;
  }

  /**
   * Export the entire board as a PNG image.
   */
  exportAsPNG(filename = 'board.png') {
    const elements = Array.from(this.em.elements.values()).filter(el => el.visible);
    if (elements.length === 0) {
      alert('Nothing to export! Draw something first.');
      return;
    }

    // Compute bounding box of all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elements) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }

    const padding = 40;
    const exportW = (maxX - minX) + padding * 2;
    const exportH = (maxY - minY) + padding * 2;
    const dpr = 2; // Export at 2x for clarity

    const canvas = document.createElement('canvas');
    canvas.width = exportW * dpr;
    canvas.height = exportH * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Fill background
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.fillStyle = isDark ? '#131313' : '#f8f9ff';
    ctx.fillRect(0, 0, exportW, exportH);

    // Translate so elements start at padding
    ctx.translate(padding - minX, padding - minY);

    // Render all elements
    for (const el of this.em.sortedElements) {
      if (!el.visible) continue;
      ctx.save();
      if (el.rotation !== 0) {
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(el.rotation);
        ctx.translate(-cx, -cy);
      }
      ctx.globalAlpha = el.opacity;
      el.render(ctx);
      ctx.restore();
    }

    // Trigger download
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  /**
   * Export board data as JSON (for backup/import).
   */
  exportAsJSON(filename = 'board.json') {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      elements: Array.from(this.em.elements.values()).map(el => el.toJSON())
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Show export dropdown menu.
   */
  showExportMenu(anchorEl, boardTitle) {
    // Remove any existing dropdown
    const existing = document.getElementById('export-dropdown');
    if (existing) { existing.remove(); return; }

    const menu = document.createElement('div');
    menu.id = 'export-dropdown';
    menu.className = 'glass elevation-3';
    menu.style.cssText = `
      position: fixed; z-index: 9000; min-width: 200px; padding: 6px; border-radius: 10px;
    `;

    const items = [
      { icon: 'image', label: 'Export as PNG', action: 'png' },
      { icon: 'data_object', label: 'Export as JSON', action: 'json' },
    ];

    menu.innerHTML = items.map(item => `
      <button class="cm-item" data-action="${item.action}" style="width:100%;display:flex;align-items:center;gap:10px;padding:8px 12px;background:transparent;border:none;cursor:pointer;color:var(--on-surface);font-size:13px;font-family:var(--font-body);border-radius:6px;text-align:left;transition:background 0.15s;">
        <span class="material-symbols-outlined" style="font-size:16px">${item.icon}</span>
        <span>${item.label}</span>
      </button>
    `).join('');

    // Position below anchor
    const rect = anchorEl.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    document.body.appendChild(menu);

    // Wire hover styles
    menu.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(192,193,255,0.1)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
    });

    // Wire actions
    menu.querySelector('[data-action="png"]').addEventListener('click', () => {
      this.exportAsPNG(`${boardTitle || 'board'}.png`);
      menu.remove();
    });
    menu.querySelector('[data-action="json"]').addEventListener('click', () => {
      this.exportAsJSON(`${boardTitle || 'board'}.json`);
      menu.remove();
    });

    // Dismiss on outside click
    const dismiss = (e) => {
      if (!menu.contains(e.target) && e.target !== anchorEl) {
        menu.remove();
        document.removeEventListener('pointerdown', dismiss);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', dismiss), 50);
  }
}
