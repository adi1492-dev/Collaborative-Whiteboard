/**
 * Tool — Base class for all canvas interaction tools.
 */
export class Tool {
  constructor(name) {
    this.name = name;
    this.inputHandler = null; // Injected
  }

  setInputHandler(handler) {
    this.inputHandler = handler;
  }

  get cm() { return this.inputHandler.cm; }
  get em() { return this.inputHandler.em; }

  // Lifecycle
  onActivate() {}
  onDeactivate() {}

  // Pointer Events (pt is in canvas world coordinates)
  onPointerDown(pt, e) {}
  onPointerMove(pt, e) {}
  onPointerUp(pt, e) {}

  // Keyboard Events
  onKeyDown(e) {}
  onKeyUp(e) {}

  // Active rendering (previewing the tool action on the top canvas layer)
  renderActive(ctx) {}
}
