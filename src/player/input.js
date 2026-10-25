// Keyboard (and game controller) → movement intents. A quick tap is remembered until the player
// is free to act on it, even if the key was released long before.
//
// Game controllers use the browser's "standard" button layout (an 8BitDo SN30 Pro in X-input
// mode, Xbox and PlayStation pads…). By position on a Nintendo-style pad:
//   left stick / D-pad: walk and turn (fly when riding)    right stick: look around
//   A (right): talk, look, climb on/off (like E)            B (bottom): breathe (like F)
//   Y (left), R, ZR: fly up (like Space)                    X (top), L, ZL: fly down (like Shift)
const PAD_BUTTONS = {
  1: 'interact',
  0: 'breathe',
  2: 'up', 5: 'up', 7: 'up',
  3: 'down', 4: 'down', 6: 'down',
  12: 'forward', 13: 'back', 14: 'left', 15: 'right',
};
const STICK = 0.35; // how far a stick must move to count
export const PAD_START = 9;
const KEYS = {
  ArrowUp: 'forward', KeyW: 'forward',
  ArrowDown: 'back', KeyS: 'back',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'up', ShiftLeft: 'down', ShiftRight: 'down',
  KeyF: 'breathe', KeyE: 'interact',
};

export class Input {
  constructor(target = window) {
    this.held = { forward: false, back: false, left: false, right: false, up: false, down: false, breathe: false, interact: false };
    this.tapped = { ...this.held };
    this.pad = { ...this.held }; // what the game controller is holding
    this.look = 0; // right stick, left (-1) to right (1)
    this.padConnected = false;
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
      if (a && e.target?.tagName === 'BUTTON') e.preventDefault(); // Space must not click a focused button
      if (a) this.held[a] = false;
    };
    this.onBlur = () => Object.keys(this.held).forEach((k) => (this.held[k] = false));
    this.target = target;
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }

  // Held keys (and controller buttons) plus taps that haven't been acted on yet.
  peek() {
    const out = {};
    for (const k in this.held) out[k] = this.held[k] || this.tapped[k] || this.pad[k];
    return out;
  }

  // Read the game controller (call once a frame). A button that's just gone down counts as a tap.
  poll() {
    const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p?.connected);
    this.padConnected = !!pad;
    const now = { forward: false, back: false, left: false, right: false, up: false, down: false, breathe: false, interact: false };
    this.look = 0;
    if (pad) {
      for (const [i, a] of Object.entries(PAD_BUTTONS)) if (pad.buttons[i]?.pressed) now[a] = true;
      const [lx = 0, ly = 0, rx = 0] = pad.axes;
      if (ly < -STICK) now.forward = true;
      if (ly > STICK) now.back = true;
      if (lx < -STICK) now.left = true;
      if (lx > STICK) now.right = true;
      if (Math.abs(rx) > 0.25) this.look = rx;
    }
    for (const a in now) {
      if (now[a] && !this.pad[a]) {
        this.tapped[a] = true;
        this.used = true;
      }
      this.pad[a] = now[a];
    }
  }

  // A one-off press (like E to climb on): true once per press.
  takeTap(a) {
    const t = this.tapped[a];
    this.tapped[a] = false;
    return t;
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
