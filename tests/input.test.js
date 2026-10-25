import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Input } from '../src/player/input.js';

// a fake game controller in the browser's "standard" layout
const pad = { connected: true, buttons: Array.from({ length: 17 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] };

describe('game controller', () => {
  let input;
  beforeEach(() => {
    vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });
    vi.stubGlobal('navigator', { getGamepads: () => [null, pad] });
    pad.buttons.forEach((b) => (b.pressed = false));
    pad.axes = [0, 0, 0, 0];
    input = new Input({ addEventListener() {}, removeEventListener() {} });
  });

  it('the left stick and D-pad walk and turn', () => {
    pad.axes = [-0.9, -0.8, 0, 0];
    input.poll();
    expect(input.peek()).toMatchObject({ forward: true, left: true, back: false, right: false });
    pad.axes = [0.1, 0.1, 0, 0];
    pad.buttons[13].pressed = true; // D-pad down
    input.poll();
    input.clearTaps();
    expect(input.peek()).toMatchObject({ forward: false, left: false, back: true });
  });

  it('A is a one-off press (like E); B breathes; shoulders fly up and down', () => {
    pad.buttons[1].pressed = true;
    input.poll();
    expect(input.takeTap('interact')).toBe(true);
    input.poll(); // still held: not a second press
    expect(input.takeTap('interact')).toBe(false);
    pad.buttons[1].pressed = false;
    pad.buttons[0].pressed = true;
    pad.buttons[5].pressed = true;
    input.poll();
    expect(input.peek()).toMatchObject({ breathe: true, up: true, down: false });
    pad.buttons[5].pressed = false;
    pad.buttons[6].pressed = true;
    input.poll();
    input.clearTaps();
    expect(input.peek()).toMatchObject({ up: false, down: true });
  });

  it('the right stick looks around, and nothing happens without a controller', () => {
    pad.axes = [0, 0, 0.7, 0];
    input.poll();
    expect(input.look).toBe(0.7);
    vi.stubGlobal('navigator', { getGamepads: () => [null, null] });
    input.poll();
    expect(input.padConnected).toBe(false);
    expect(input.look).toBe(0);
    expect(Object.values(input.peek()).some(Boolean)).toBe(false);
  });
});
