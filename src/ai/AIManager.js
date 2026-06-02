/**
 * AIManager — Handles "unbeatable" AI features using Gemini.
 * Features: Shape recognition, Board Summarization, Content Generation.
 */
export class AIManager {
  constructor(app, boardPage) {
    this.app = app;
    this.board = boardPage;
    this.cm = boardPage.cm;
    this.em = boardPage.em;
    this.isProcessing = false;
  }

  /**
   * Summarize the current whiteboard contents into a markdown document.
   */
  async summarizeBoard() {
    if (this.isProcessing) return;
    this._setProcessing(true);

    try {
      // 1. Gather context from elements
      const context = this._extractBoardContext();
      
      // 2. Call backend AI endpoint
      const res = await this.app.auth.apiFetch(`/api/boards/${this.board.boardId}/ai/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements: context })
      });

      if (!res.ok) throw new Error('AI Summarization failed');
      const data = await res.json();
      
      // 3. Display result in a panel
      this._showSummaryPanel(data.summary);
    } catch (err) {
      alert("AI Assist error: " + err.message);
    } finally {
      this._setProcessing(false);
    }
  }

  /**
   * Smart layout: arrange selected sticky notes into a Kanban board or grid.
   */
  organizeSelection() {
    const selected = Array.from(this.em.selectedIds)
      .map(id => this.em.elements.get(id))
      .filter(el => el && el.type === 'sticky');

    if (selected.length < 2) {
      alert('Select at least 2 sticky notes to organize.');
      return;
    }

    // Sort by X, then Y
    selected.sort((a, b) => a.y - b.y || a.x - b.x);

    const cols = Math.ceil(Math.sqrt(selected.length));
    const padding = 20;
    
    // Find top-left origin
    const originX = Math.min(...selected.map(e => e.x));
    const originY = Math.min(...selected.map(e => e.y));

    let currentX = originX;
    let currentY = originY;
    let maxRowHeight = 0;

    selected.forEach((el, idx) => {
      el.x = currentX;
      el.y = currentY;
      
      maxRowHeight = Math.max(maxRowHeight, el.height);
      currentX += el.width + padding;
      
      if ((idx + 1) % cols === 0) {
        currentX = originX;
        currentY += maxRowHeight + padding;
        maxRowHeight = 0;
      }
      
      if (this.cm.syncManager) {
        this.cm.syncManager.broadcastUpdate(el);
      }
    });

    this.cm.requestStaticRender();
  }

  _extractBoardContext() {
    return Array.from(this.em.elements.values())
      .filter(el => el.type === 'sticky' || el.type === 'text')
      .map(el => ({
        type: el.type,
        text: el.text,
        x: Math.round(el.x),
        y: Math.round(el.y)
      }));
  }

  _setProcessing(isProcessing) {
    this.isProcessing = isProcessing;
    const btn = document.getElementById('ai-assist-btn');
    if (btn) {
      if (isProcessing) {
        btn.classList.add('anim-pulse-glow');
        btn.style.color = 'var(--tertiary)';
      } else {
        btn.classList.remove('anim-pulse-glow');
        btn.style.color = '';
      }
    }
  }

  _showSummaryPanel(markdown) {
    let panel = document.getElementById('ai-summary-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'ai-summary-panel';
      panel.className = 'glass elevation-3 anim-slide-up';
      panel.style.cssText = `
        position: absolute; right: 24px; top: 80px; width: 400px; max-height: 80vh;
        background: var(--surface-container); border-radius: var(--radius-lg);
        display: flex; flex-direction: column; z-index: 100;
        border: 1px solid var(--tertiary); box-shadow: 0 0 20px rgba(255, 178, 183, 0.2);
      `;
      document.querySelector('.board-workspace').appendChild(panel);
    }

    // Basic markdown to HTML (very simplified)
    const html = markdown
      .replace(/^### (.*$)/gim, '<h4>$1</h4>')
      .replace(/^## (.*$)/gim, '<h3>$1</h3>')
      .replace(/^# (.*$)/gim, '<h2>$1</h2>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\n/gim, '<br>');

    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <div style="display:flex; align-items:center; gap:8px; color: var(--tertiary);">
          <span class="material-symbols-outlined">auto_awesome</span>
          <h3 class="headline-sm">AI Summary</h3>
        </div>
        <button class="icon-btn" onclick="this.parentElement.parentElement.remove()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div style="padding: 16px; overflow-y: auto; flex:1;" class="body-sm text-content">
        ${html}
      </div>
    `;
  }
}
