/**
 * HistoryManager — Command-pattern Undo/Redo for local operations.
 * Each action has an `apply` (redo) and `revert` (undo) function.
 * IMPORTANT: push() does NOT call apply() — the caller is expected to have
 * already performed the action. This prevents double-execution.
 */
export class HistoryManager {
  constructor(syncManager) {
    this.sync = syncManager;
    this.stack = [];      // Array of { apply, revert, description }
    this.pointer = -1;    // Points to last applied action
    this.maxSize = 100;
  }

  /**
   * Record a completed action for undo/redo.
   * The action has ALREADY been performed by the caller — do NOT call apply() here.
   * Clears any redo history above the current pointer.
   */
  push(action) {
    if (!action || typeof action.apply !== 'function' || typeof action.revert !== 'function') {
      console.warn('[History] Invalid action pushed:', action);
      return;
    }
    // Remove any "redo" history above the current pointer
    this.stack = this.stack.slice(0, this.pointer + 1);

    // Trim oldest entry when over limit
    if (this.stack.length >= this.maxSize) {
      this.stack.shift();
      // pointer stays at end after trim since we sliced above
    }

    this.stack.push(action);
    this.pointer = this.stack.length - 1;

    // NOTE: Do NOT call action.apply() here — caller already performed the action.
    this._updateUI();
  }

  /**
   * Take a snapshot of current canvas state as a single undoable bulk action.
   * Used by import to allow Ctrl+Z to undo all imported elements at once.
   * @param {string} description - Label for the history entry
   */
  snapshot(description = 'snapshot') {
    if (!this.sync || !this.sync.em) return;
    const elementsBefore = new Map(
      [...this.sync.em.elements.entries()].map(([id, el]) => [id, el.toJSON()])
    );

    // The revert re-hydrates the snapshot
    this.push({
      description,
      apply: () => { /* Future redo: no-op, import already happened */ },
      revert: () => {
        if (!this.sync || !this.sync.em) return;
        // Remove all elements added AFTER the snapshot
        const keysAfter = new Set(this.sync.em.elements.keys());
        for (const id of keysAfter) {
          if (!elementsBefore.has(id)) {
            this.sync.em.removeElement(id);
            this.sync.broadcastDelete(id);
          }
        }
        // Restore any elements that were removed (edge case)
        for (const [id, data] of elementsBefore) {
          if (!this.sync.em.elements.has(id)) {
            const el = this.sync._hydrateElement(data);
            if (el) { this.sync.em.setElement(el); this.sync.broadcastCreate(el); }
          }
        }
        this.sync.em.cm.requestStaticRender();
      }
    });
  }

  /**
   * Undo the last action.
   */
  undo() {
    if (!this.canUndo()) return;
    const action = this.stack[this.pointer];
    if (!action) return;
    try {
      action.revert();
    } catch (err) {
      console.error('[History] Undo error:', err);
    }
    this.pointer--;
    this._updateUI();
    console.log('[History] Undo:', action.description);
  }

  /**
   * Redo the next action.
   */
  redo() {
    if (!this.canRedo()) return;
    this.pointer++;
    const action = this.stack[this.pointer];
    if (!action) return;
    try {
      action.apply();
    } catch (err) {
      console.error('[History] Redo error:', err);
    }
    this._updateUI();
    console.log('[History] Redo:', action.description);
  }

  canUndo() {
    return this.pointer >= 0;
  }

  canRedo() {
    return this.pointer < this.stack.length - 1;
  }

  clear() {
    this.stack = [];
    this.pointer = -1;
    this._updateUI();
  }

  _updateUI() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = !this.canUndo();
    if (redoBtn) redoBtn.disabled = !this.canRedo();
  }
}
