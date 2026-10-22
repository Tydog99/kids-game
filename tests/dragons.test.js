import { describe, it, expect } from 'vitest';
import { DragonBrain, ACTIVITIES, DURATIONS } from '../src/creatures/dragonBrain.js';
import { placeDragons, roomForDragon, MAX_DRAGONS } from '../src/creatures/dragonSpawns.js';
import { generateWorld, isWalkable } from '../src/worldgen.js';
import { createRng } from '../src/rng.js';

describe('DragonBrain', () => {
  it('loops walk → rear → sit → fly → walk with durations in range', () => {
    const b = new DragonBrain(createRng(1).next);
    const seen = [b.activity];
    for (let i = 0; i < 60 * 300; i++) {
      if (b.update(1 / 60)) {
        seen.push(b.activity);
        const [lo, hi] = DURATIONS[b.activity];
        expect(b.duration).toBeGreaterThanOrEqual(lo);
        expect(b.duration).toBeLessThanOrEqual(hi);
      }
    }
    for (let i = 1; i < seen.length; i++) {
      expect(ACTIVITIES.indexOf(seen[i])).toBe((ACTIVITIES.indexOf(seen[i - 1]) + 1) % ACTIVITIES.length);
    }
    expect(new Set(seen).size).toBe(4);
  });

  it('dragons are not on the same timeline', () => {
    const brains = Array.from({ length: 8 }, (_, i) => new DragonBrain(createRng(`d${i}`).next));
    const snapshot = () => brains.map((b) => `${b.activity}:${b.timeLeft.toFixed(1)}`);
    for (let step = 0; step < 4; step++) {
      for (let i = 0; i < 60 * 20; i++) brains.forEach((b) => b.update(1 / 60));
      expect(new Set(snapshot()).size).toBeGreaterThan(5);
      expect(new Set(brains.map((b) => b.activity)).size).toBeGreaterThan(1);
    }
  });

  it('waits while held (e.g. still landing)', () => {
    const b = new DragonBrain(() => 0); // starts at walk, at the very beginning
    b.hold = true;
    for (let i = 0; i < 60 * 60; i++) b.update(1 / 60);
    expect(b.activity).toBe('walk');
    b.hold = false;
    expect(b.update(1 / 60)).toBe(true);
    expect(b.activity).toBe('rear');
  });
});

describe('placeDragons', () => {
  it('is the same for the same seed', () => {
    expect(placeDragons(generateWorld('pallet'))).toEqual(placeDragons(generateWorld('pallet')));
  });

  for (const seed of ['pallet', 'viridian', 'dragon-1', 'dragon-2']) {
    it(`gives each dragon open ground away from the start: ${seed}`, () => {
      const w = generateWorld(seed);
      const ds = placeDragons(w);
      expect(ds).toHaveLength(MAX_DRAGONS);
      for (const d of ds) {
        expect(roomForDragon((x, z) => isWalkable(w, x, z), d.x, d.z)).toBe(true);
        expect(Math.hypot(d.x - w.spawn.x, d.z - w.spawn.z)).toBeGreaterThanOrEqual(12);
      }
      expect(new Set(ds.map((d) => d.kind)).size).toBe(3);
      // the first few are well spread out
      const few = ds.slice(0, 4);
      for (let i = 0; i < few.length; i++)
        for (let j = i + 1; j < few.length; j++) expect(Math.hypot(few[i].x - few[j].x, few[i].z - few[j].z)).toBeGreaterThanOrEqual(9);
    });
  }
});
