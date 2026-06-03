/**
 * ExportManager — Export the whiteboard as PNG or JSON.
 */
export class ExportManager {
  constructor(canvasManager, elementManager) {
    this.cm = canvasManager;
    this.em = elementManager;
  }

  /**
   * Export the entire board as a PNG image.
   */
  async exportAsPNG(filename = 'board.png') {
    const { Toast } = await import('../ui/Toast.js');

    if (!this.em || !this.em.elements) {
      Toast.show('Export failed: board not fully loaded yet.', 'error', 4000);
      return;
    }

    const elements = Array.from(this.em.elements.values()).filter(el => el.visible);
    if (elements.length === 0) {
      Toast.show('Nothing to export! Draw something first.', 'warning', 3000);
      return;
    }

    // Compute tight bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elements) {
      const ex = isFinite(el.x) ? el.x : 0;
      const ey = isFinite(el.y) ? el.y : 0;
      const ew = isFinite(el.width) ? el.width : 0;
      const eh = isFinite(el.height) ? el.height : 0;
      minX = Math.min(minX, ex);
      minY = Math.min(minY, ey);
      maxX = Math.max(maxX, ex + ew);
      maxY = Math.max(maxY, ey + eh);
    }

    // Guard against degenerate bounds
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      Toast.show('Could not compute board bounds for export.', 'error', 4000);
      return;
    }

    const padding = 48;
    const exportW = Math.max(10, (maxX - minX) + padding * 2);
    const exportH = Math.max(10, (maxY - minY) + padding * 2);
    const dpr = 2;

    // Wait for fonts
    try { await document.fonts.ready; } catch (_) {}

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    const drawToCanvas = (skipImages) => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(exportW * dpr);
      canvas.height = Math.round(exportH * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.scale(dpr, dpr);
      ctx.fillStyle = isDark ? '#131313' : '#f8f9ff';
      ctx.fillRect(0, 0, exportW, exportH);
      ctx.translate(padding - minX, padding - minY);

      const sorted = [...this.em.sortedElements];
      for (const el of sorted) {
        if (!el.visible) continue;
        if (skipImages && el.type === 'image') continue;

        ctx.save();
        try {
          if (el.rotation !== 0) {
            const cx = el.x + el.width / 2;
            const cy = el.y + el.height / 2;
            ctx.translate(cx, cy);
            ctx.rotate(el.rotation);
            ctx.translate(-cx, -cy);
          }
          ctx.globalAlpha = el.opacity ?? 1;
          el.render(ctx);
        } catch (renderErr) {
          console.warn('[Export] Skipping element', el.id, 'due to render error:', renderErr.message);
        }
        ctx.restore();
      }

      return canvas;
    };

    // Try with images first, then without if tainted
    const download = (dataUrl) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    // First attempt: all elements
    try {
      const canvas = drawToCanvas(false);
      if (!canvas) throw new Error('Could not create canvas context');

      let dataUrl;
      try {
        dataUrl = canvas.toDataURL('image/png');
      } catch (taintErr) {
        // Canvas is tainted — retry without images
        console.warn('[Export] Canvas tainted, retrying without images:', taintErr.message);
        const canvas2 = drawToCanvas(true);
        if (!canvas2) throw new Error('Could not create fallback canvas');
        dataUrl = canvas2.toDataURL('image/png');
        download(dataUrl);
        Toast.show('Exported PNG (images excluded — cross-origin restriction)', 'warning', 5000);
        return;
      }

      if (!dataUrl || dataUrl === 'data:,') {
        throw new Error('Empty canvas data URL');
      }

      download(dataUrl);
      Toast.show('Exported as PNG!', 'success', 2000);
    } catch (err) {
      console.error('[Export] PNG export failed:', err);
      Toast.show(`PNG export failed: ${err.message}`, 'error', 5000);
    }
  }

  /**
   * Export board data as JSON.
   */
  async exportAsJSON(filename = 'board.json') {
    const { Toast } = await import('../ui/Toast.js');

    const elements = Array.from(this.em.elements.values()).map(el => {
      try { return el.toJSON(); } catch (_) { return null; }
    }).filter(Boolean);

    if (elements.length === 0) {
      Toast.show('Nothing to export! Draw something first.', 'warning', 3000);
      return;
    }

    try {
      const data = { version: '1.0', exportedAt: new Date().toISOString(), elements };
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      Toast.show('Exported as JSON!', 'success', 2000);
    } catch (err) {
      console.error('[Export] JSON export failed:', err);
      Toast.show('JSON export failed. Please try again.', 'error', 3000);
    }
  }

  /**
   * Show export dropdown menu.
   */
  showExportMenu(anchorEl, boardTitle) {
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

    const rect = anchorEl.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    document.body.appendChild(menu);

    menu.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(192,193,255,0.1)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
    });

    menu.querySelector('[data-action="png"]').addEventListener('click', () => {
      menu.remove();
      this.exportAsPNG(`${boardTitle || 'board'}.png`);
    });
    menu.querySelector('[data-action="json"]').addEventListener('click', () => {
      menu.remove();
      this.exportAsJSON(`${boardTitle || 'board'}.json`);
    });

    const dismiss = (e) => {
      if (!menu.contains(e.target) && e.target !== anchorEl) {
        menu.remove();
        document.removeEventListener('pointerdown', dismiss);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', dismiss), 50);
  }
}
