/**
 * HistoryManager — Command-pattern Undo/Redo for local and synced operations.
 * Each action has a `do` and `undo` function.
 * Collaborative: undo/redo only affects the local user's history.
 */
export class HistoryManager {
  constructor(syncManager) {
    this.sync = syncManager;
    this.stack = [];      // Array of { apply, revert, description }
    this.pointer = -1;    // Points to last applied action
    this.maxSize = 100;
  }

  /**
   * Push a new action and execute it.
   * Clears any redo history above the current pointer.
   */
  push(action) {
    // Remove any "redo" history
    this.stack = this.stack.slice(0, this.pointer + 1);
    
    // Trim if over limit
    if (this.stack.length >= this.maxSize) {
      this.stack.shift();
    }
    
    this.stack.push(action);
    this.pointer = this.stack.length - 1;
    
    // Execute the action
    action.apply();
    
    this._updateUI();
  }

  /**
   * Undo the last action.
   */
  undo() {
    if (!this.canUndo()) return;
    const action = this.stack[this.pointer];
    action.revert();
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
    action.apply();
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
