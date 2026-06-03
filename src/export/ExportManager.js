/**
 * ExportManager — Export the whiteboard as PNG or JSON.
 * Fixed:
 * - Waits for document.fonts.ready before rendering text to offscreen canvas
 * - Proper error handling for toBlob (was silently failing)
 * - Replaced alert() with Toast
 * - Appends anchor to body before clicking (Safari/Firefox compatibility)
 * - Guards against zero-size export canvas
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
  async exportAsPNG(filename = 'board.png') {
    const elements = Array.from(this.em.elements.values()).filter(el => el.visible);
    if (elements.length === 0) {
      const { Toast } = await import('../ui/Toast.js');
      Toast.show('Nothing to export! Draw something first.', 'warning', 3000);
      return;
    }

    // Compute tight bounding box of all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elements) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + (el.width || 0));
      maxY = Math.max(maxY, el.y + (el.height || 0));
    }

    const padding = 48;
    const exportW = Math.max(1, (maxX - minX) + padding * 2);
    const exportH = Math.max(1, (maxY - minY) + padding * 2);
    const dpr = 2; // 2× for retina clarity

    // Guard: create canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = Math.round(exportW * dpr);
    offscreen.height = Math.round(exportH * dpr);
    const ctx = offscreen.getContext('2d');
    if (!ctx) {
      const { Toast } = await import('../ui/Toast.js');
      Toast.show('Your browser does not support canvas export.', 'error', 4000);
      return;
    }
    ctx.scale(dpr, dpr);

    // Fill background matching current theme
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.fillStyle = isDark ? '#131313' : '#f8f9ff';
    ctx.fillRect(0, 0, exportW, exportH);

    // Translate so elements start at padding offset from their bounding box
    ctx.translate(padding - minX, padding - minY);

    // Wait for fonts to be fully loaded before text rendering
    // This prevents text appearing as system fallback font on the export
    try {
      await document.fonts.ready;
    } catch (_) {
      // Non-critical; proceed without guarantee of font loading
    }

    // Render all elements in z-index order
    for (const el of this.em.sortedElements) {
      if (!el.visible) continue;
      ctx.save();

      // Apply rotation if needed
      if (el.rotation !== 0) {
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(el.rotation);
        ctx.translate(-cx, -cy);
      }

      ctx.globalAlpha = el.opacity ?? 1;

      try {
        el.render(ctx);
      } catch (err) {
        console.warn('[Export] Failed to render element:', el.id, err);
      }

      ctx.restore();
    }

    // Trigger download via toBlob for best cross-browser compatibility
    try {
      const blob = await new Promise((resolve, reject) => {
        offscreen.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob returned null — canvas may be tainted by cross-origin images'));
        }, 'image/png');
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      // Must append to body first for Firefox compatibility
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      const { Toast } = await import('../ui/Toast.js');
      Toast.show('Exported as PNG!', 'success', 2000);
    } catch (err) {
      console.error('[Export] PNG export failed:', err);
      const { Toast } = await import('../ui/Toast.js');
      Toast.show(
        err.message.includes('tainted')
          ? 'Export failed: canvas contains cross-origin images.'
          : 'PNG export failed. Please try again.',
        'error',
        5000
      );
    }
  }

  /**
   * Export board data as JSON (for backup/import).
   */
  async exportAsJSON(filename = 'board.json') {
    const elements = Array.from(this.em.elements.values()).map(el => el.toJSON());
    if (elements.length === 0) {
      const { Toast } = await import('../ui/Toast.js');
      Toast.show('Nothing to export! Draw something first.', 'warning', 3000);
      return;
    }

    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      elements
    };

    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      const { Toast } = await import('../ui/Toast.js');
      Toast.show('Exported as JSON!', 'success', 2000);
    } catch (err) {
      console.error('[Export] JSON export failed:', err);
      const { Toast } = await import('../ui/Toast.js');
      Toast.show('JSON export failed. Please try again.', 'error', 3000);
    }
  }

  /**
   * Show export dropdown menu.
   */
  showExportMenu(anchorEl, boardTitle) {
    // Toggle: remove if already open
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

    // Position below anchor button
    const rect = anchorEl.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    document.body.appendChild(menu);

    // Hover effects
    menu.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(192,193,255,0.1)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
    });

    // Wire actions
    menu.querySelector('[data-action="png"]').addEventListener('click', () => {
      menu.remove();
      this.exportAsPNG(`${boardTitle || 'board'}.png`);
    });
    menu.querySelector('[data-action="json"]').addEventListener('click', () => {
      menu.remove();
      this.exportAsJSON(`${boardTitle || 'board'}.json`);
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
