/**
 * ExportManager — Export the whiteboard as PNG / JSON, and import from JSON.
 */
export class ExportManager {
  constructor(canvasManager, elementManager, syncManager, historyManager) {
    this.cm = canvasManager;
    this.em = elementManager;
    this.sync = syncManager;
    this.history = historyManager;
  }

  // ─── PNG Export ──────────────────────────────────────────────────────────────

  async exportAsPNG(filename = 'board.png') {
    const { Toast } = await import('../ui/Toast.js');

    if (!this.em?.elements) {
      Toast.show('Export failed: board not fully loaded.', 'error', 4000);
      return;
    }

    const elements = Array.from(this.em.elements.values()).filter(el => el.visible);
    if (elements.length === 0) {
      Toast.show('Nothing to export! Draw something first.', 'warning', 3000);
      return;
    }

    // Bounding box with NaN / Infinity guards
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
    const exportW = (maxX - minX) + padding * 2;
    const exportH = (maxY - minY) + padding * 2;

    // Cap pixel ratio so canvas never exceeds browser's max size (~16384px)
    const MAX_CANVAS_PX = 8192;
    let dpr = 2;
    if (exportW * dpr > MAX_CANVAS_PX || exportH * dpr > MAX_CANVAS_PX) {
      dpr = MAX_CANVAS_PX / Math.max(exportW, exportH);
    }

    const canvasW = Math.max(1, Math.floor(exportW * dpr));
    const canvasH = Math.max(1, Math.floor(exportH * dpr));

    try { await document.fonts.ready; } catch (_) {}
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

    const drawToCanvas = (skipImages) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.scale(dpr, dpr);
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
      let dataUrl, skippedImages = false;
      try {
        const c = drawToCanvas(false);
        if (!c) throw new Error('Canvas context unavailable');
        dataUrl = c.toDataURL('image/png');
      } catch (e) {
        const c2 = drawToCanvas(true);
        if (!c2) throw new Error('Canvas context unavailable');
        dataUrl = c2.toDataURL('image/png');
        skippedImages = true;
      }
      if (!dataUrl || dataUrl.length < 100) {
        throw new Error(`Canvas produced empty output (${canvasW}×${canvasH}px)`);
      }
      this._download(dataUrl, filename);
      Toast.show(
        skippedImages ? 'Exported PNG (images excluded — cross-origin)' : 'Exported as PNG!',
        skippedImages ? 'warning' : 'success',
        skippedImages ? 5000 : 2000
      );
    } catch (err) {
      console.error('[Export] PNG export failed:', err);
      Toast.show(`PNG export failed: ${err.message}`, 'error', 6000);
    }
  }

  // ─── JSON Export ─────────────────────────────────────────────────────────────

  async exportAsJSON(filename = 'board.json') {
    const { Toast } = await import('../ui/Toast.js');
    if (!this.em?.elements) {
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
      this._download(url, filename, true);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      Toast.show('Exported as JSON!', 'success', 2000);
    } catch (err) {
      console.error('[Export] JSON export failed:', err);
      Toast.show('JSON export failed. Please try again.', 'error', 3000);
    }
  }

  // ─── JSON Import ─────────────────────────────────────────────────────────────

  /**
   * Open a file picker and import elements from a previously exported JSON file.
   * Imported elements get new IDs (so they don't conflict with existing elements),
   * are added to the canvas, broadcast to peers, and queued for save.
   */
  async importFromJSON() {
    const { Toast } = await import('../ui/Toast.js');

    if (!this.em || !this.sync) {
      Toast.show('Import failed: board not ready.', 'error', 4000);
      return;
    }

    // Open native file picker — no DOM pollution, works everywhere
    const file = await this._pickFile('application/json,.json');
    if (!file) return; // User cancelled

    let data;
    try {
      const text = await file.text();
      data = JSON.parse(text);
    } catch (err) {
      Toast.show('Invalid JSON file — could not parse.', 'error', 4000);
      return;
    }

    // Validate structure
    if (!data.elements || !Array.isArray(data.elements)) {
      Toast.show('Invalid board file: missing elements array.', 'error', 4000);
      return;
    }

    const rawElements = data.elements;
    if (rawElements.length === 0) {
      Toast.show('The JSON file contains no elements.', 'warning', 3000);
      return;
    }

    // Import each element — give them fresh IDs so they don't overwrite existing work
    const { generateId } = await import('../utils/uid.js');
    const importedElements = [];

    // Compute bounding box of imported elements to center them on screen
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const raw of rawElements) {
      if (isFinite(raw.x)) { minX = Math.min(minX, raw.x); maxX = Math.max(maxX, raw.x + (raw.width || 0)); }
      if (isFinite(raw.y)) { minY = Math.min(minY, raw.y); maxY = Math.max(maxY, raw.y + (raw.height || 0)); }
    }

    // Offset: place imported content at centre of current viewport
    let offsetX = 0, offsetY = 0;
    if (this.cm && isFinite(minX)) {
      const vp = this.cm.transform.getViewportBounds(this.cm.width, this.cm.height);
      const vpCX = (vp.minX + vp.maxX) / 2;
      const vpCY = (vp.minY + vp.maxY) / 2;
      const contentCX = (minX + maxX) / 2;
      const contentCY = (minY + maxY) / 2;
      offsetX = vpCX - contentCX;
      offsetY = vpCY - contentCY;
    }

    for (const raw of rawElements) {
      try {
        const cloned = { ...raw, id: generateId(), x: (raw.x || 0) + offsetX, y: (raw.y || 0) + offsetY };
        // Deep-clone arrays (e.g. freehand points) so they're not shared
        if (Array.isArray(raw.points)) cloned.points = raw.points.map(p => ({ ...p }));

        const el = this.sync._hydrateElement(cloned);
        if (el) importedElements.push(el);
      } catch (e) {
        console.warn('[Import] Skipped malformed element:', e.message);
      }
    }

    if (importedElements.length === 0) {
      Toast.show('No valid elements found in file.', 'warning', 3000);
      return;
    }

    // Record history snapshot before import (enables single Ctrl+Z to undo all)
    if (this.history) {
      this.history.snapshot('import_json');
    }

    // Add to canvas and broadcast to peers
    for (const el of importedElements) {
      this.em.setElement(el);
      this.sync.broadcastCreate(el);
    }

    // Zoom to fit the imported content
    setTimeout(() => this.cm?.zoomToFit(), 100);

    Toast.show(
      `Imported ${importedElements.length} element${importedElements.length !== 1 ? 's' : ''}!`,
      'success',
      3000
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Create and click a download anchor. Pass isUrl=true for blob URLs, false for data URLs. */
  _download(urlOrDataUrl, filename, isUrl = false) {
    const a = document.createElement('a');
    a.href = urlOrDataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /** Open a native file picker and resolve with the selected File, or null if cancelled. */
  _pickFile(accept = '*') {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.display = 'none';
      document.body.appendChild(input);
      input.onchange = () => {
        const file = input.files?.[0] ?? null;
        document.body.removeChild(input);
        resolve(file);
      };
      // Handle cancel (focus returns to window without change event)
      window.addEventListener('focus', () => {
        setTimeout(() => {
          if (!input.files?.length) {
            document.body.contains(input) && document.body.removeChild(input);
            resolve(null);
          }
        }, 500);
      }, { once: true });
      input.click();
    });
  }

  // ─── Dropdown Menu ───────────────────────────────────────────────────────────

  showExportMenu(anchorEl, boardTitle) {
    const existing = document.getElementById('export-dropdown');
    if (existing) { existing.remove(); return; }

    const menu = document.createElement('div');
    menu.id = 'export-dropdown';
    menu.className = 'glass elevation-3';
    menu.style.cssText = `
      position: fixed; z-index: 9000; min-width: 210px; padding: 6px; border-radius: 10px;
    `;

    const items = [
      { icon: 'image',       label: 'Export as PNG',      action: 'png' },
      { icon: 'data_object', label: 'Export as JSON',     action: 'json' },
      { icon: 'divider' },
      { icon: 'upload_file', label: 'Import from JSON',   action: 'import' },
    ];

    menu.innerHTML = items.map(item => {
      if (item.icon === 'divider') {
        return `<div style="height:1px;background:rgba(255,255,255,0.08);margin:4px 0;"></div>`;
      }
      return `
        <button class="cm-item" data-action="${item.action}"
          style="width:100%;display:flex;align-items:center;gap:10px;padding:8px 12px;
                 background:transparent;border:none;cursor:pointer;color:var(--on-surface);
                 font-size:13px;font-family:var(--font-body);border-radius:6px;
                 text-align:left;transition:background 0.15s;">
          <span class="material-symbols-outlined" style="font-size:16px">${item.icon}</span>
          <span>${item.label}</span>
        </button>`;
    }).join('');

    const rect = anchorEl.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    document.body.appendChild(menu);

    menu.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(192,193,255,0.1)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'transparent');
    });

    const close = () => menu.remove();

    menu.querySelector('[data-action="png"]')?.addEventListener('click', () => {
      close(); this.exportAsPNG(`${boardTitle || 'board'}.png`);
    });
    menu.querySelector('[data-action="json"]')?.addEventListener('click', () => {
      close(); this.exportAsJSON(`${boardTitle || 'board'}.json`);
    });
    menu.querySelector('[data-action="import"]')?.addEventListener('click', () => {
      close(); this.importFromJSON();
    });

    const dismiss = (e) => {
      if (!menu.contains(e.target) && e.target !== anchorEl) {
        close();
        document.removeEventListener('pointerdown', dismiss);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', dismiss), 50);
  }
}
