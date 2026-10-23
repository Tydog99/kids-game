import { describe, it, expect } from 'vitest';
import { raceCourse, START, PITCH, HOOPS, LAP_RINGS, passes, pitchTile, towers, formatTime } from '../src/race/course.js';
import { RIDE } from '../src/creatures/rideMotor.js';

describe('Sky Pitch race', () => {
  const rings = raceCourse();

  it('goes around the pitch, then down the middle and through the tall middle hoop', () => {
    expect(rings.length).toBe(LAP_RINGS + 3);
    const goal = rings.at(-1);
    expect(goal.goal).toBe(true);
    expect(HOOPS.some((h) => h.x === goal.x && h.z === goal.z && h.height === goal.y)).toBe(true);
    // the middle run is straight down the centre line
    for (const r of rings.slice(LAP_RINGS)) expect(r.z).toBe(0);
  });

  it('every ring is reachable: inside the wall, clear of the towers, under the flying ceiling', () => {
    for (const r of [...rings, START]) {
      expect(Math.hypot(r.x, r.z)).toBeLessThan(PITCH.wall - 4);
      expect(r.y).toBeGreaterThan(3);
      expect(r.y).toBeLessThan(RIDE.ceiling - 3);
      for (const t of towers()) expect(Math.hypot(r.x - t.x, r.z - t.z)).toBeGreaterThan(t.half + 4);
    }
  });

  it('rings are well spaced out, and a dragon can turn and climb from one to the next', () => {
    let prev = START;
    for (const r of rings) {
      const d = Math.hypot(r.x - prev.x, r.z - prev.z);
      expect(d).toBeGreaterThan(15);
      expect(d).toBeLessThan(28);
      // climbing at full rate while flying at full speed covers the height change
      expect(Math.abs(r.y - prev.y) / RIDE.climb).toBeLessThan(d / RIDE.fly + 0.2);
      prev = r;
    }
  });

  it('a fast flyer passing through a ring between frames still counts', () => {
    const ring = { x: 0, y: 5, z: 0 };
    expect(passes(ring, { x: -2, y: 5, z: 0.5 }, { x: 2, y: 5, z: 0.5 })).toBe(true);
    expect(passes(ring, { x: -2, y: 9, z: 0 }, { x: 2, y: 9, z: 0 })).toBe(false);
  });

  it('the pitch grass can be landed on; the towers and the wall cannot be flown through', () => {
    expect(pitchTile(0, 0).land).toBe(true);
    const t = towers()[0];
    expect(pitchTile(Math.floor(t.x), Math.floor(t.z)).land).toBe(false);
    expect(pitchTile(70, 0).top).toBeGreaterThan(RIDE.ceiling);
    expect(formatTime(75.4)).toBe('1:15');
  });
});
