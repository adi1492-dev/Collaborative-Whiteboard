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
      Toast.show('Export failed: board not fully loaded.', 'error', 4000);
      return;
    }

    const elements = Array.from(this.em.elements.values()).filter(el => el.visible);
    if (elements.length === 0) {
      Toast.show('Nothing to export! Draw something first.', 'warning', 3000);
      return;
    }

    // Compute bounding box with NaN/Infinity guards
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

    if (!isFinite(minX)) { minX = 0; maxX = 800; }
    if (!isFinite(minY)) { minY = 0; maxY = 600; }

    const padding = 48;
    let exportW = (maxX - minX) + padding * 2;
    let exportH = (maxY - minY) + padding * 2;

    // -------------------------------------------------------------------
    // CRITICAL: Browsers cap canvas at ~16384px per side. If the canvas
    // exceeds this, the browser silently sets its size to 0 and
    // toDataURL() returns 'data:,' (an empty result).
    // We scale down to fit within the limit while preserving aspect ratio.
    // -------------------------------------------------------------------
    const MAX_CANVAS_PX = 8192; // Safe limit (half of absolute max)
    let pixelRatio = 2; // Default 2× for retina quality

    const rawW = exportW * pixelRatio;
    const rawH = exportH * pixelRatio;

    if (rawW > MAX_CANVAS_PX || rawH > MAX_CANVAS_PX) {
      // Scale down so the larger dimension fits within MAX_CANVAS_PX
      pixelRatio = MAX_CANVAS_PX / Math.max(exportW, exportH);
    }

    const canvasW = Math.max(1, Math.floor(exportW * pixelRatio));
    const canvasH = Math.max(1, Math.floor(exportH * pixelRatio));

    // Wait for fonts
    try { await document.fonts.ready; } catch (_) {}

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    const drawToCanvas = (skipImages) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.scale(pixelRatio, pixelRatio);
      ctx.fillStyle = isDark ? '#131313' : '#f8f9ff';
      ctx.fillRect(0, 0, exportW, exportH);
      ctx.translate(padding - minX, padding - minY);

      for (const el of this.em.sortedElements) {
        if (!el.visible) continue;
        if (skipImages && el.type === 'image') continue;
        ctx.save();
        try {
          if (el.rotation) {
            const cx = el.x + el.width / 2;
            const cy = el.y + el.height / 2;
            ctx.translate(cx, cy);
            ctx.rotate(el.rotation);
            ctx.translate(-cx, -cy);
          }
          ctx.globalAlpha = el.opacity ?? 1;
          el.render(ctx);
        } catch (e) {
          console.warn('[Export] Skipped element', el.id, e.message);
        }
        ctx.restore();
      }

      return canvas;
    };

    try {
      let dataUrl;
      let skippedImages = false;

      try {
        const canvas = drawToCanvas(false);
        if (!canvas) throw new Error('Canvas context unavailable');
        dataUrl = canvas.toDataURL('image/png');
      } catch (e) {
        // SecurityError = canvas tainted by cross-origin image
        console.warn('[Export] Canvas tainted, retrying without images:', e.message);
        const canvas2 = drawToCanvas(true);
        if (!canvas2) throw new Error('Canvas context unavailable');
        dataUrl = canvas2.toDataURL('image/png');
        skippedImages = true;
      }

      // 'data:,' means the canvas was still 0×0 — something is very wrong
      if (!dataUrl || dataUrl === 'data:,' || dataUrl.length < 100) {
        throw new Error(`Canvas produced empty output (size: ${canvasW}×${canvasH})`);
      }

      // Trigger download
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (skippedImages) {
        Toast.show('Exported PNG (images excluded — cross-origin)', 'warning', 5000);
      } else {
        Toast.show('Exported as PNG!', 'success', 2000);
      }
    } catch (err) {
      console.error('[Export] PNG export failed:', err);
      Toast.show(`PNG export failed: ${err.message}`, 'error', 6000);
    }
  }

  /**
   * Export board data as JSON.
   */
  async exportAsJSON(filename = 'board.json') {
    const { Toast } = await import('../ui/Toast.js');

    if (!this.em || !this.em.elements) {
      Toast.show('Export failed: board not fully loaded.', 'error', 4000);
      return;
    }

    const elements = Array.from(this.em.elements.values()).map(el => {
      try { return el.toJSON(); } catch (_) { return null; }
    }).filter(Boolean);

    if (elements.length === 0) {
      Toast.show('Nothing to export!', 'warning', 3000);
      return;
    }

    try {
      const data = { version: '1.0', exportedAt: new Date().toISOString(), elements };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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
