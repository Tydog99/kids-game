import { describe, it, expect } from 'vitest';
import { makeMeteor, meteorPoint, spawnChance, METEOR_RATES, DEFAULT_METEOR_INDEX, START_ELEVATION } from '../src/world/shootingStars.js';
import { createRng } from '../src/rng.js';

describe('shooting stars', () => {
  const rng = createRng('meteors');
  const meteors = Array.from({ length: 300 }, () => makeMeteor(rng.next));

  it('start high in the sky and travel along it', () => {
    for (const m of meteors) {
      expect(Math.hypot(...m.start)).toBeCloseTo(1);
      expect(Math.hypot(...m.dir)).toBeCloseTo(1);
      // low enough to be inside the camera's view of the sky
      const el = (Math.asin(m.start[1]) * 180) / Math.PI;
      expect(el).toBeGreaterThanOrEqual(START_ELEVATION[0] - 1e-9);
      expect(el).toBeLessThanOrEqual(START_ELEVATION[1] + 1e-9);
      // direction is tangent to the dome (perpendicular to the start point)
      expect(m.start.reduce((a, c, i) => a + c * m.dir[i], 0)).toBeCloseTo(0);
      // stays on the dome
      expect(Math.hypot(...meteorPoint(m, m.length))).toBeCloseTo(1);
    }
  });

  it('fly in many different directions, mostly downward', () => {
    const falling = meteors.filter((m) => m.dir[1] < 0).length;
    expect(falling / meteors.length).toBeGreaterThan(0.7);
    expect(falling).toBeLessThan(meteors.length); // some go sideways or up a little
    const headings = new Set(meteors.map((m) => Math.round(Math.atan2(m.dir[2], m.dir[0]) / (Math.PI / 4))));
    expect(headings.size).toBeGreaterThanOrEqual(8);
  });

  it('come in different lengths', () => {
    const lengths = meteors.map((m) => m.length);
    expect(Math.max(...lengths) / Math.min(...lengths)).toBeGreaterThan(3);
  });

  it('spawn rate follows the slider and only at night', () => {
    expect(spawnChance(METEOR_RATES[0].perSecond, 1 / 60, 1)).toBe(0);
    expect(spawnChance(1, 1 / 60, 0)).toBe(0);
    const some = METEOR_RATES[DEFAULT_METEOR_INDEX].perSecond;
    // expected count over 60 s of night ≈ rate × 60
    let p = 0;
    for (let i = 0; i < 3600; i++) p += spawnChance(some, 1 / 60, 1);
    expect(p).toBeCloseTo(some * 60, 0);
    for (let i = 1; i < METEOR_RATES.length; i++) expect(METEOR_RATES[i].perSecond).toBeGreaterThan(METEOR_RATES[i - 1].perSecond);
  });

  it('mostly appear in the part of the sky the player is looking at', () => {
    const view = 1.2;
    const r = createRng('view');
    const near = Array.from({ length: 400 }, () => makeMeteor(r.next, view)).filter((m) => {
      let d = Math.atan2(m.start[2], m.start[0]) - view;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      return Math.abs(d) <= (45 * Math.PI) / 180 + 1e-9;
    }).length;
    expect(near / 400).toBeGreaterThan(0.8);
  });
});
