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

  // ─── SVG Export ───────────────────────────────────────────────────────────────

  async exportAsSVG(filename = 'board.svg') {
    const { Toast } = await import('../ui/Toast.js');

    if (!this.em?.elements) {
      Toast.show('Export failed: board not fully loaded.', 'error', 4000);
      return;
    }

    const elements = Array.from(this.em.elements.values()).filter(el => el.visible && el.type !== 'comment');
    if (elements.length === 0) {
      Toast.show('Nothing to export! Draw something first.', 'warning', 3000);
      return;
    }

    // Bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elements) {
      const ex = isFinite(el.x) ? el.x : 0;
      const ey = isFinite(el.y) ? el.y : 0;
      const ew = isFinite(el.width) ? el.width : 0;
      const eh = isFinite(el.height) ? el.height : 0;
      minX = Math.min(minX, ex); minY = Math.min(minY, ey);
      maxX = Math.max(maxX, ex + ew); maxY = Math.max(maxY, ey + eh);
    }
    const pad = 48;
    const vw = maxX - minX + pad * 2;
    const vh = maxY - minY + pad * 2;
    const ox = minX - pad; // world origin offset
    const oy = minY - pad;

    const escape = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const svgParts = [];

    for (const el of elements.sort((a, b) => a.zIndex - b.zIndex)) {
      const x = (el.x - ox).toFixed(2);
      const y = (el.y - oy).toFixed(2);
      const w = el.width.toFixed(2);
      const h = el.height.toFixed(2);
      const stroke = el.style?.strokeColor || 'none';
      const fill = el.style?.fillColor || 'none';
      const sw = el.style?.strokeWidth || 1;
      const opacity = el.opacity || 1;
      const rot = el.rotation ? ` transform="rotate(${(el.rotation * 180 / Math.PI).toFixed(2)},${(+x + +w / 2).toFixed(2)},${(+y + +h / 2).toFixed(2)})"` : '';

      if (el.type === 'shape') {
        const shape = el.shapeType || 'rect';
        if (shape === 'ellipse') {
          svgParts.push(`<ellipse cx="${(+x + +w/2).toFixed(2)}" cy="${(+y + +h/2).toFixed(2)}" rx="${(+w/2).toFixed(2)}" ry="${(+h/2).toFixed(2)}" fill="${escape(fill)}" stroke="${escape(stroke)}" stroke-width="${sw}" opacity="${opacity}"${rot}/>`);
        } else {
          const rx = shape === 'rounded-rect' ? '8' : '0';
          svgParts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${escape(fill)}" stroke="${escape(stroke)}" stroke-width="${sw}" opacity="${opacity}"${rot}/>`);
        }
        if (el.text) {
          svgParts.push(`<text x="${(+x + +w/2).toFixed(2)}" y="${(+y + +h/2).toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-family="Inter, sans-serif" font-size="${el.style?.fontSize || 14}" fill="${escape(el.style?.strokeColor || '#ffffff')}" opacity="${opacity}"${rot}>${escape(el.text)}</text>`);
        }
      } else if (el.type === 'sticky' || el.type === 'text') {
        const bgColor = fill !== 'none' && fill !== 'transparent' ? fill : 'rgba(192,193,255,0.12)';
        if (el.type === 'sticky') {
          svgParts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${escape(bgColor)}" opacity="${opacity}"${rot}/>`);
        }
        svgParts.push(`<foreignObject x="${x}" y="${y}" width="${w}" height="${h}"${rot}><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Inter,sans-serif;font-size:${el.style?.fontSize || 14}px;color:white;padding:12px;overflow:hidden;opacity:${opacity}">${escape(el.text || '')}</div></foreignObject>`);
      } else if (el.type === 'freehand') {
        const pts = el.points || [];
        if (pts.length >= 2) {
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x - ox).toFixed(1)},${(p.y - oy).toFixed(1)}`).join(' ');
          svgParts.push(`<path d="${d}" fill="none" stroke="${escape(stroke)}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"${rot}/>`);
        }
      }
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const svgContent = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="${vw.toFixed(2)}" height="${vh.toFixed(2)}" viewBox="0 0 ${vw.toFixed(2)} ${vh.toFixed(2)}">`,
      `<rect width="100%" height="100%" fill="${isDark ? '#131313' : '#f8f9ff'}"/>`,
      ...svgParts,
      `</svg>`,
    ].join('\n');

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    this._download(url, filename, true);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    Toast.show('SVG exported! Opens crisp at any zoom level.', 'success', 3000);
  }

  // ─── SVG Import ───────────────────────────────────────────────────────────────

  async importFromSVG() {
    const { Toast } = await import('../ui/Toast.js');
    const { generateId } = await import('../utils/uid.js');

    const file = await this._pickFile('.svg,image/svg+xml');
    if (!file) return;

    const text = await file.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) {
      Toast.show('Invalid SVG file.', 'error', 3000);
      return;
    }

    const imported = [];
    const now = Date.now();

    // Calculate viewport center for centering the import
    const scale = this.cm?.transform?.scale || 1;
    const panX = this.cm?.transform?.panX || 0;
    const panY = this.cm?.transform?.panY || 0;
    const viewCX = ((this.cm?.width || 800) / 2 - panX) / scale;
    const viewCY = ((this.cm?.height || 600) / 2 - panY) / scale;

    const parseNum = (v) => parseFloat(v) || 0;

    // Convert SVG rects -> ShapeElement
    doc.querySelectorAll('rect').forEach(el => {
      if (el.closest('defs')) return;
      imported.push(this.sync._hydrateElement({
        id: generateId(), type: 'shape',
        x: viewCX + parseNum(el.getAttribute('x')),
        y: viewCY + parseNum(el.getAttribute('y')),
        width: parseNum(el.getAttribute('width')) || 100,
        height: parseNum(el.getAttribute('height')) || 60,
        shapeType: parseNum(el.getAttribute('rx')) > 0 ? 'rounded-rect' : 'rect',
        text: '', zIndex: imported.length, opacity: 1, visible: true, locked: false, rotation: 0,
        style: { fillColor: el.getAttribute('fill') || 'transparent', strokeColor: el.getAttribute('stroke') || '#c0c1ff', strokeWidth: parseNum(el.getAttribute('stroke-width')) || 1, fontSize: 14 },
        createdAt: now, updatedAt: now, createdBy: null
      }));
    });

    // Convert SVG ellipses -> ShapeElement
    doc.querySelectorAll('ellipse, circle').forEach(el => {
      if (el.closest('defs')) return;
      const rx = parseNum(el.getAttribute('rx') || el.getAttribute('r'));
      const ry = parseNum(el.getAttribute('ry') || el.getAttribute('r'));
      const cx = parseNum(el.getAttribute('cx'));
      const cy = parseNum(el.getAttribute('cy'));
      imported.push(this.sync._hydrateElement({
        id: generateId(), type: 'shape',
        x: viewCX + cx - rx, y: viewCY + cy - ry,
        width: rx * 2, height: ry * 2, shapeType: 'ellipse',
        text: '', zIndex: imported.length, opacity: 1, visible: true, locked: false, rotation: 0,
        style: { fillColor: el.getAttribute('fill') || 'transparent', strokeColor: el.getAttribute('stroke') || '#c0c1ff', strokeWidth: parseNum(el.getAttribute('stroke-width')) || 1, fontSize: 14 },
        createdAt: now, updatedAt: now, createdBy: null
      }));
    });

    // Convert SVG paths -> FreehandElement
    doc.querySelectorAll('path').forEach(el => {
      if (el.closest('defs')) return;
      const d = el.getAttribute('d') || '';
      const pts = [];
      const tokens = d.match(/[MLCQZmlcqz][^MLCQZmlcqz]*/g) || [];
      let curX = 0, curY = 0;
      for (const tok of tokens) {
        const cmd = tok[0];
        const nums = tok.slice(1).trim().split(/[,\s]+/).map(Number).filter(n => !isNaN(n));
        if (cmd === 'M' || cmd === 'L') { curX = nums[0] || 0; curY = nums[1] || 0; pts.push({ x: viewCX + curX, y: viewCY + curY, pressure: 0.5 }); }
        else if (cmd === 'm' || cmd === 'l') { curX += nums[0] || 0; curY += nums[1] || 0; pts.push({ x: viewCX + curX, y: viewCY + curY, pressure: 0.5 }); }
      }
      if (pts.length >= 2) {
        imported.push(this.sync._hydrateElement({
          id: generateId(), type: 'freehand', x: pts[0].x, y: pts[0].y, width: 1, height: 1,
          points: pts, zIndex: imported.length, opacity: 1, visible: true, locked: false, rotation: 0,
          style: { strokeColor: el.getAttribute('stroke') || '#c0c1ff', strokeWidth: parseNum(el.getAttribute('stroke-width')) || 2, fillColor: 'none', fontSize: 14 },
          createdAt: now, updatedAt: now, createdBy: null
        }));
      }
    });

    // Convert SVG text -> TextElement
    doc.querySelectorAll('text').forEach(el => {
      if (el.closest('defs')) return;
      const content = el.textContent?.trim();
      if (!content) return;
      imported.push(this.sync._hydrateElement({
        id: generateId(), type: 'text',
        x: viewCX + parseNum(el.getAttribute('x')),
        y: viewCY + parseNum(el.getAttribute('y')),
        width: 300, height: 32, text: content,
        zIndex: imported.length, opacity: 1, visible: true, locked: false, rotation: 0,
        style: { strokeColor: el.getAttribute('fill') || '#c0c1ff', fillColor: 'transparent', strokeWidth: 0, fontSize: parseNum(el.getAttribute('font-size')) || 14, fontFamily: 'Inter, sans-serif' },
        createdAt: now, updatedAt: now, createdBy: null
      }));
    });

    const valid = imported.filter(Boolean);
    if (valid.length === 0) {
      Toast.show('No supported shapes found in SVG (rect, ellipse, path, text).', 'warning', 4000);
      return;
    }

    if (this.history) this.history.snapshot('import_svg');
    for (const el of valid) {
      this.em.setElement(el);
      this.sync.broadcastCreate(el);
    }
    setTimeout(() => this.cm?.zoomToFit(), 100);
    Toast.show(`✅ Imported ${valid.length} elements from SVG!`, 'success', 3000);
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
      { icon: 'image',        label: 'Export as PNG',      action: 'png' },
      { icon: 'code',         label: 'Export as SVG',      action: 'svg' },
      { icon: 'data_object',  label: 'Export as JSON',     action: 'json' },
      { icon: 'divider' },
      { icon: 'upload_file',  label: 'Import from JSON',   action: 'import' },
      { icon: 'svg',          label: 'Import from SVG',    action: 'import-svg' },
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
    menu.querySelector('[data-action="svg"]')?.addEventListener('click', () => {
      close(); this.exportAsSVG(`${boardTitle || 'board'}.svg`);
    });
    menu.querySelector('[data-action="json"]')?.addEventListener('click', () => {
      close(); this.exportAsJSON(`${boardTitle || 'board'}.json`);
    });
    menu.querySelector('[data-action="import"]')?.addEventListener('click', () => {
      close(); this.importFromJSON();
    });
    menu.querySelector('[data-action="import-svg"]')?.addEventListener('click', () => {
      close(); this.importFromSVG();
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
