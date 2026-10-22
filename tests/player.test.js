import { describe, it, expect } from 'vitest';
import { PlayerMotor, STEP_TIME, TURN_TIME, yawForFacing } from '../src/player/PlayerMotor.js';

const NONE = { forward: false, back: false, left: false, right: false };
const open = () => true;

describe('PlayerMotor', () => {
  it('steps forward one tile in the facing direction', () => {
    const m = new PlayerMotor({ x: 5, z: 5, facing: 0 }, open); // north = -z
    m.update(0.01, { ...NONE, forward: true });
    m.update(STEP_TIME, NONE);
    expect([m.x, m.z]).toEqual([5, 4]);
    expect([m.px, m.pz]).toEqual([5, 4]);
    expect(m.state).toBe('idle');
  });

  it('steps back while keeping its facing', () => {
    const m = new PlayerMotor({ x: 5, z: 5, facing: 1 }, open); // east
    m.update(0.01, { ...NONE, back: true });
    m.update(1, NONE);
    expect([m.x, m.z, m.facing]).toEqual([4, 5, 1]);
  });

  it('does not walk into blocked tiles', () => {
    const m = new PlayerMotor({ x: 5, z: 5, facing: 2 }, (x, z) => !(x === 5 && z === 6));
    m.update(0.01, { ...NONE, forward: true });
    expect(m.state).toBe('bump');
    m.update(1, NONE);
    expect([m.x, m.z]).toEqual([5, 5]);
  });

  it('turns left/right and wraps facing', () => {
    const m = new PlayerMotor({ x: 0, z: 0, facing: 0 }, open);
    m.update(0.01, { ...NONE, left: true });
    m.update(TURN_TIME, NONE);
    expect(m.facing).toBe(3);
    m.update(0.01, { ...NONE, right: true });
    m.update(TURN_TIME, NONE);
    m.update(0.01, { ...NONE, right: true });
    m.update(TURN_TIME, NONE);
    expect(m.facing).toBe(1);
    // yaw ends equivalent to the facing's yaw
    const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    expect(norm(m.yaw)).toBeCloseTo(norm(yawForFacing(1)));
  });

  it('holding forward chains steps', () => {
    const m = new PlayerMotor({ x: 10, z: 10, facing: 2 }, open);
    for (let i = 0; i < 60; i++) m.update(STEP_TIME / 10, { ...NONE, forward: true });
    expect(m.z).toBeGreaterThanOrEqual(15);
  });

  it('ignores input mid-step', () => {
    const m = new PlayerMotor({ x: 0, z: 0, facing: 2 }, open);
    m.update(0.01, { ...NONE, forward: true });
    m.update(0.01, { ...NONE, left: true });
    expect(m.facing).toBe(2);
  });

  it('reports when an intent starts a move', () => {
    const m = new PlayerMotor({ x: 0, z: 0, facing: 2 }, open);
    expect(m.update(0.01, NONE)).toBe(false);
    expect(m.update(0.01, { ...NONE, left: true })).toBe(true);
    expect(m.update(0.01, { ...NONE, left: true })).toBe(false); // busy turning
  });
});
