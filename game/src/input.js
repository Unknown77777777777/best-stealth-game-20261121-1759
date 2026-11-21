// The Quiet Gallery — keyboard and mouse input.
// Tracks held keys by code, the mouse position in screen pixels, and
// click-to-throw. The game converts screen pixels to world coordinates
// with the camera, so this file never needs to know where the view is.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, inside: false };
    this.clicked = false; // true for one frame after a mouse press
    this.clickedAt = { x: 0, y: 0 };
    this.pressed = new Set(); // keys pressed since the last consume
    this.onFirstGesture = null; // called once, on the first key/click
    this._gestured = false;
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
      this._gesture();
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    this._onMouseMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
      this.mouse.inside = true;
    };
    this._onMouseDown = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.clickedAt.x = e.clientX - rect.left;
      this.clickedAt.y = e.clientY - rect.top;
      this.clicked = true;
      this._gesture();
    };
    this._onBlur = () => {
      this.keys.clear();
    };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    // Mouse on the window, not the canvas: the menu overlay covers the
    // canvas, and a click on it still has to start the game.
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
  }

  _gesture() {
    if (this._gestured) return;
    this._gestured = true;
    if (this.onFirstGesture) this.onFirstGesture();
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // True once for a key pressed since the last call to endFrame.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Clear the per-frame edges (pressed keys, click flag).
  endFrame() {
    this.pressed.clear();
    this.clicked = false;
  }
}
