import { describe, it, expect } from 'vitest';
import { PlayerMotor, WALK_SPEED, TURN_SPEED, RADIUS } from '../src/player/PlayerMotor.js';

const NONE = { forward: false, back: false, left: false, right: false };
const open = () => true;

function run(m, seconds, intent, dt = 1 / 60) {
  for (let t = 0; t < seconds; t += dt) m.update(dt, intent);
}

describe('PlayerMotor', () => {
  it('starts in the center of the spawn tile', () => {
    const m = new PlayerMotor({ x: 5, z: 7, facing: 2 }, open);
    expect([m.px, m.pz, m.x, m.z]).toEqual([5.5, 7.5, 5, 7]);
  });

  it('walks forward in the facing direction', () => {
    const m = new PlayerMotor({ x: 5, z: 5, facing: 0 }, open); // north = -z
    run(m, 1, { ...NONE, forward: true });
    expect(m.px).toBeCloseTo(5.5, 5);
    expect(m.pz).toBeLessThan(5.5 - WALK_SPEED * 0.7);
  });

  it('backs up without changing direction', () => {
    const m = new PlayerMotor({ x: 5, z: 5, facing: 1 }, open); // east
    const yaw = m.yaw;
    run(m, 1, { ...NONE, back: true });
    expect(m.px).toBeLessThan(5.5);
    expect(m.yaw).toBe(yaw);
  });

  it('turns smoothly by any amount, not in 90° steps', () => {
    const m = new PlayerMotor({ x: 5, z: 5, facing: 2 }, open);
    run(m, 0.25, { ...NONE, left: true });
    const turned = m.yaw;
    expect(turned).toBeGreaterThan(0.1);
    expect(turned).toBeLessThan(TURN_SPEED * 0.25 + 0.01);
    run(m, 0.5, NONE);
    run(m, 0.25, { ...NONE, right: true });
    expect(m.yaw).toBeLessThan(turned + 0.2);
  });

  it('can walk diagonally after a partial turn', () => {
    const m = new PlayerMotor({ x: 10, z: 10, facing: 2 }, open);
    m.yaw = Math.PI / 4;
    run(m, 1, { ...NONE, forward: true });
    expect(m.px - 10.5).toBeCloseTo(m.pz - 10.5, 1);
    expect(m.px).toBeGreaterThan(11.5);
  });

  it('stops at blocked tiles', () => {
    const wall = (x, z) => z !== 7; // row z=7 is blocked
    const m = new PlayerMotor({ x: 5, z: 5, facing: 2 }, wall); // south = +z
    run(m, 3, { ...NONE, forward: true });
    expect(m.pz).toBeLessThanOrEqual(7 - RADIUS + 1e-9);
    expect(m.z).toBe(6);
  });

  it('slides along a wall when walking into it at an angle', () => {
    const wall = (x, z) => z !== 7;
    const m = new PlayerMotor({ x: 5, z: 6, facing: 2 }, wall);
    m.yaw = Math.PI / 4; // south-east
    run(m, 1, { ...NONE, forward: true });
    expect(m.px).toBeGreaterThan(6.5); // kept moving east
    expect(m.z).toBe(6);
  });

  it('settles to a stop when keys are released', () => {
    const m = new PlayerMotor({ x: 5, z: 5, facing: 2 }, open);
    run(m, 0.5, { ...NONE, forward: true, left: true });
    run(m, 1, NONE);
    expect(m.speed).toBe(0);
    expect(m.turnRate).toBe(0);
    expect(m.stride).toBe(0);
  });

  it('can walk under a tree canopy right up to the trunk, but not through it', () => {
    const trunk = 0.16;
    const tree = (x, z) => (x === 5 && z === 7 ? trunk : true);
    const m = new PlayerMotor({ x: 5, z: 5, facing: 2 }, tree); // walking south into the tree tile
    run(m, 3, { ...NONE, forward: true });
    expect(m.z).toBe(7); // inside the tree's tile, under the leaves
    expect(Math.hypot(m.px - 5.5, m.pz - 7.5)).toBeGreaterThanOrEqual(trunk + RADIUS - 1e-6);
  });
});
