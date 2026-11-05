import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Input, stickTurn, turnRamp } from '../src/player/input.js';

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
    expect(input.peek()).toMatchObject({ forward: true, back: false });
    expect(input.peek().turn).toBeGreaterThan(0.7); // pushed hard left: turns left, near full speed
    pad.axes = [0.1, 0.1, 0, 0];
    pad.buttons[13].pressed = true; // D-pad down
    input.poll();
    input.clearTaps();
    expect(input.peek()).toMatchObject({ forward: false, left: false, back: true, turn: 0 });
  });

  it('the stick turns as far as it is pushed, and a little wobble does not turn', () => {
    expect(stickTurn(0.2)).toBe(0);
    expect(stickTurn(-0.2)).toBe(0);
    expect(stickTurn(-1)).toBeCloseTo(1);
    expect(stickTurn(1)).toBeCloseTo(-1);
    expect(stickTurn(-0.5)).toBeGreaterThan(0);
    expect(stickTurn(-0.5)).toBeLessThan(0.25); // half way: a slow turn
  });

  it('holding a turn button starts slow and builds up', () => {
    let t = 0;
    input.now = () => t;
    pad.buttons[14].pressed = true; // D-pad left
    input.poll();
    expect(input.peek().turn).toBeCloseTo(turnRamp(0));
    expect(turnRamp(0)).toBeLessThan(0.5);
    t = 0.3;
    const mid = input.peek().turn;
    t = 2;
    expect(input.peek().turn).toBe(1);
    expect(mid).toBeGreaterThan(turnRamp(0));
    expect(mid).toBeLessThan(1);
    input.turnScale = 0.6; // the Turning slider
    expect(input.peek().turn).toBeCloseTo(0.6);
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
    expect(Object.values(input.peek()).some(Boolean)).toBe(false); // turn is 0 too
  });
});
