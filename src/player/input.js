// Keyboard → movement intents. A quick tap is remembered until the player is
// free to act on it, even if the key was released long before.
const KEYS = {
  ArrowUp: 'forward', KeyW: 'forward',
  ArrowDown: 'back', KeyS: 'back',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

export class Input {
  constructor(target = window) {
    this.held = { forward: false, back: false, left: false, right: false };
    this.tapped = { ...this.held };
    this.onDown = (e) => {
      const a = KEYS[e.code];
      if (!a || e.target?.tagName === 'INPUT') return;
      e.preventDefault();
      if (!this.held[a]) this.tapped[a] = true;
      this.held[a] = true;
      this.used = true;
    };
    this.onUp = (e) => {
      const a = KEYS[e.code];
      if (a) this.held[a] = false;
    };
    this.onBlur = () => Object.keys(this.held).forEach((k) => (this.held[k] = false));
    this.target = target;
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }

  // Held keys plus taps that haven't been acted on yet.
  peek() {
    const out = {};
    for (const k in this.held) out[k] = this.held[k] || this.tapped[k];
    return out;
  }

  // Call once a move has started, so a tap isn't replayed.
  clearTaps() {
    for (const k in this.tapped) this.tapped[k] = false;
  }

  // Lets on-screen buttons drive the same intents.
  press(a, down) {
    if (down && !this.held[a]) this.tapped[a] = true;
    this.held[a] = down;
    this.used = true;
  }

  dispose() {
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
