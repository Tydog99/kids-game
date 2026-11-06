// Keyboard (and game controller) → movement intents. A quick tap is remembered until the player
// is free to act on it, even if the key was released long before.
//
// Game controllers use the browser's "standard" button layout (an 8BitDo SN30 Pro in X-input
// mode, Xbox and PlayStation pads…). By position on a Nintendo-style pad:
//   left stick / D-pad: walk and turn (fly when riding)    right stick: look around
//   A (right): talk, look, climb on/off (like E)            B (bottom): breathe (like F)
//   Y (left), R, ZR: fly up (like Space)                    X (top), L, ZL: fly down (like Shift)
//   Select: call a dragon (like C; each press calls the next one)
const PAD_BUTTONS = {
  8: 'call',
  1: 'interact',
  0: 'breathe',
  2: 'up', 5: 'up', 7: 'up',
  3: 'down', 4: 'down', 6: 'down',
  12: 'forward', 13: 'back', 14: 'left', 15: 'right',
};
const STICK = 0.35; // how far a stick must move to count
const TURN_DEAD = 0.25; // sideways wobble on the stick smaller than this doesn't turn
export const PAD_START = 9;

// Steps for the "Turning" slider: how fast you turn, against the normal speed.
export const TURN_SPEEDS = [
  { label: 'Very slow', scale: 0.45 },
  { label: 'Slow', scale: 0.6 },
  { label: 'Gentle', scale: 0.8 },
  { label: 'Normal', scale: 1 },
  { label: 'Fast', scale: 1.25 },
];
export const DEFAULT_TURN_INDEX = 2;

// Holding a turn button starts slow and builds up, so a quick tap is a small nudge.
export const TURN_RAMP = { start: 0.3, time: 0.6 };
export function turnRamp(heldFor) {
  return TURN_RAMP.start + (1 - TURN_RAMP.start) * Math.min(1, heldFor / TURN_RAMP.time);
}

// The stick turns as far as it is pushed: past the dead zone, gently at first.
export function stickTurn(x) {
  const a = Math.abs(x);
  if (a < TURN_DEAD) return 0;
  return -Math.sign(x) * ((Math.min(1, a) - TURN_DEAD) / (1 - TURN_DEAD)) ** 1.6;
}
const KEYS = {
  ArrowUp: 'forward', KeyW: 'forward',
  ArrowDown: 'back', KeyS: 'back',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'up', ShiftLeft: 'down', ShiftRight: 'down',
  KeyF: 'breathe', KeyE: 'interact', KeyC: 'call',
};

export class Input {
  constructor(target = window) {
    this.held = { forward: false, back: false, left: false, right: false, up: false, down: false, breathe: false, interact: false, call: false };
    this.tapped = { ...this.held };
    this.pad = { ...this.held }; // what the game controller is holding
    this.look = 0; // right stick, left (-1) to right (1)
    this.stick = 0; // left stick's turn, from stickTurn
    this.turnScale = 1; // from the Turning slider
    this.turnDir = 0; // turn button held (1 left, -1 right), and since when
    this.turnSince = 0;
    this.now = () => performance.now() / 1000;
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

  // Held keys (and controller buttons) plus taps that haven't been acted on yet, and turn: how
  // hard to turn, from 1 (left, full speed) to -1 (right).
  peek() {
    const out = {};
    for (const k in this.held) out[k] = this.held[k] || this.tapped[k] || this.pad[k];
    const dir = (out.left ? 1 : 0) - (out.right ? 1 : 0);
    if (dir !== this.turnDir) {
      this.turnDir = dir;
      this.turnSince = this.now();
    }
    const turn = dir ? dir * turnRamp(this.now() - this.turnSince) : this.stick;
    out.turn = turn * this.turnScale;
    return out;
  }

  // Read the game controller (call once a frame). A button that's just gone down counts as a tap.
  poll() {
    const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p?.connected);
    this.padConnected = !!pad;
    const now = { forward: false, back: false, left: false, right: false, up: false, down: false, breathe: false, interact: false, call: false };
    this.look = 0;
    this.stick = 0;
    if (pad) {
      for (const [i, a] of Object.entries(PAD_BUTTONS)) if (pad.buttons[i]?.pressed) now[a] = true;
      const [lx = 0, ly = 0, rx = 0] = pad.axes;
      if (ly < -STICK) now.forward = true;
      if (ly > STICK) now.back = true;
      this.stick = stickTurn(lx);
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
