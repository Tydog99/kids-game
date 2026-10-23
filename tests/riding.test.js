import { describe, it, expect } from 'vitest';
import { RideMotor, RIDE, GROUND_Y } from '../src/creatures/rideMotor.js';
import { updateTrust, heartsFor, cleanName, TRUST } from '../src/creatures/trust.js';

const NONE = { forward: false, back: false, left: false, right: false, up: false, down: false };
const run = (m, s, intent) => { for (let t = 0; t < s; t += 1 / 60) m.update(1 / 60, { ...NONE, ...intent }); };
// a world: open ground, a building block at x 20..24, a lake at z >= 30
const tile = (x, z) => {
  if (x >= 20 && x <= 24 && z >= 0 && z <= 10) return { top: 7, land: false };
  if (z >= 30) return { top: 1, land: false };
  return { top: GROUND_Y, land: true };
};

describe('RideMotor', () => {
  it('walks on the ground and stays down until Space', () => {
    const m = new RideMotor({ x: 5.5, z: 5.5, heading: 0 }, tile);
    expect(m.grounded).toBe(true);
    run(m, 1, { forward: true });
    expect(m.z).toBeGreaterThan(7);
    expect(m.y).toBe(GROUND_Y);
  });

  it('Space takes off and rises; letting go hovers in place', () => {
    const m = new RideMotor({ x: 5.5, z: 5.5 }, tile);
    run(m, 1.5, { up: true });
    expect(m.grounded).toBe(false);
    const y = m.y;
    expect(y).toBeGreaterThan(3);
    run(m, 2, {});
    expect(m.y).toBeGreaterThan(y); // drifts a little as the climb eases off…
    const hover = m.y;
    run(m, 2, {});
    expect(m.y).toBeCloseTo(hover, 1); // …then hovers
    expect(m.grounded).toBe(false);
  });

  it('never goes above the ceiling', () => {
    const m = new RideMotor({ x: 5.5, z: 5.5 }, tile);
    run(m, 20, { up: true });
    expect(m.y).toBeLessThanOrEqual(RIDE.ceiling);
  });

  it('Shift sinks and lands on open ground', () => {
    const m = new RideMotor({ x: 5.5, z: 5.5 }, tile);
    run(m, 1.5, { up: true });
    run(m, 4, { down: true });
    expect(m.grounded).toBe(true);
    expect(m.y).toBe(GROUND_Y);
  });

  it('hovers above water instead of landing in it', () => {
    const m = new RideMotor({ x: 5.5, z: 35.5, y: 4 }, tile);
    expect(m.grounded).toBe(false);
    run(m, 4, { down: true });
    expect(m.grounded).toBe(false);
    expect(m.y).toBeGreaterThanOrEqual(1);
  });

  it('cannot fly through a building low down, but can fly over it high up', () => {
    const low = new RideMotor({ x: 17, z: 5.5, y: 3, heading: Math.PI / 2 }, tile); // facing +x
    run(low, 3, { forward: true });
    expect(low.x).toBeLessThan(20 - RIDE.radius + 0.01);
    const high = new RideMotor({ x: 17, z: 5.5, y: 9, heading: Math.PI / 2 }, tile);
    run(high, 3, { forward: true });
    expect(high.x).toBeGreaterThan(25);
    // and sinking over the roof stops on top of it
    const roof = new RideMotor({ x: 22.5, z: 5.5, y: 9 }, tile);
    run(roof, 5, { down: true });
    expect(roof.y).toBeCloseTo(7);
    expect(roof.grounded).toBe(false);
  });

  it('cannot walk into a building on the ground', () => {
    const m = new RideMotor({ x: 17, z: 5.5, heading: Math.PI / 2 }, tile);
    run(m, 3, { forward: true });
    expect(m.x).toBeLessThan(20 - RIDE.radius + 0.01);
  });
});

describe('trust', () => {
  it('fills while standing close to a grounded dragon', () => {
    let t = 0;
    for (let i = 0; i < 60 * TRUST.fill; i++) t = updateTrust(t, 1 / 60, { distance: 2, grounded: true, playerSpeed: 0 });
    expect(t).toBeCloseTo(1, 2);
    expect(heartsFor(t)).toBe(5);
  });

  it('builds slower while moving, not at all while it flies, and fades far away', () => {
    const step = (t, o, s) => { for (let i = 0; i < 60 * s; i++) t = updateTrust(t, 1 / 60, o); return t; };
    expect(step(0, { distance: 2, grounded: true, playerSpeed: 2 }, 6)).toBeCloseTo(6 / TRUST.fill / 2, 2);
    expect(step(0.4, { distance: 2, grounded: false, playerSpeed: 0 }, 5)).toBeCloseTo(0.4);
    expect(step(0.4, { distance: 5, grounded: true, playerSpeed: 0 }, 5)).toBeCloseTo(0.4);
    expect(step(0.4, { distance: 20, grounded: true, playerSpeed: 0 }, 8)).toBeCloseTo(0.4 - 8 / TRUST.fade, 2);
  });

  it('tidies names', () => {
    expect(cleanName('  Sir   Flaps-a-lot the Third  ', 'ember')).toBe('Sir Flaps-a-lot');
    expect(cleanName('', 'frost')).toBe('Snowflake');
  });
});

describe('RideMotor on melting ice', () => {
  it('lifts into a hover when the ground under it melts', () => {
    let melted = false;
    const tile = (x, z) => (melted && z >= 5 && z <= 6 ? { top: 1.2, land: false } : { top: GROUND_Y, land: true });
    const m = new RideMotor({ x: 5.5, z: 5.5 }, tile);
    expect(m.grounded).toBe(true);
    melted = true;
    run(m, 1, {});
    expect(m.grounded).toBe(false);
    expect(m.y).toBeGreaterThanOrEqual(1.2);
  });
});
