import { describe, it, expect } from 'vitest';
import { generateWorld, isWalkable } from '../src/worldgen.js';
import { placeTreasure, walkDistances, TreasureHunt, KEY_COUNT } from '../src/treasure.js';

const SEEDS = Array.from({ length: 15 }, (_, i) => `hunt-${i}`);

describe('placeTreasure', () => {
  it('is the same for the same seed', () => {
    expect(placeTreasure(generateWorld('pallet'))).toEqual(placeTreasure(generateWorld('pallet')));
  });

  for (const seed of SEEDS) {
    it(`places a reachable hunt: ${seed}`, () => {
      const w = generateWorld(seed);
      const { chest, keys } = placeTreasure(w);
      const chestIndex = chest.z * w.width + chest.x;

      // chest sits right by spawn on open ground
      expect(isWalkable(w, chest.x, chest.z)).toBe(true);
      expect(Math.abs(chest.x - w.spawn.x) + Math.abs(chest.z - w.spawn.z)).toBeLessThanOrEqual(8);

      // with the chest in place, every key and every door can still be walked to from spawn
      const dist = walkDistances(w, w.spawn.x, w.spawn.z, new Set([chestIndex]));
      expect(keys).toHaveLength(KEY_COUNT);
      for (const k of keys) {
        expect(isWalkable(w, k.x, k.z)).toBe(true);
        expect(dist[k.z * w.width + k.x]).toBeGreaterThan(0);
      }
      for (const b of w.buildings) expect(dist[b.doorZ * w.width + b.doorX]).toBeGreaterThanOrEqual(0);
      // the chest is next to a tile you can stand on, so it can be touched
      const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => dist[(chest.z + dz) * w.width + chest.x + dx]);
      expect(sides.some((d) => d >= 0)).toBe(true);

      // keys are spread out
      for (let a = 0; a < keys.length; a++)
        for (let b = a + 1; b < keys.length; b++) expect(Math.hypot(keys[a].x - keys[b].x, keys[a].z - keys[b].z)).toBeGreaterThan(5);
    });
  }
});

describe('TreasureHunt', () => {
  const hunt = () =>
    new TreasureHunt({ chest: { x: 10, z: 10, facing: 0 }, keys: [{ x: 20, z: 20 }, { x: 30, z: 5 }, { x: 5, z: 30 }] });

  it('collects a key by walking onto it, once', () => {
    const h = hunt();
    expect(h.update(0.1, 20.5, 20.5, 0.28)).toEqual([{ type: 'key', key: h.keys[0], count: 1 }]);
    expect(h.update(0.1, 20.5, 20.5, 0.28)).toEqual([]);
    expect(h.update(0.1, 22.5, 20.5, 0.28)).toEqual([]); // too far from the others
  });

  it('chest stays locked until all keys are found, with a reminder that does not spam', () => {
    const h = hunt();
    const touch = [9.6, 10.5]; // just left of the chest tile
    expect(h.update(0.1, ...touch, 0.28)).toEqual([{ type: 'locked', missing: 3 }]);
    expect(h.update(0.1, ...touch, 0.28)).toEqual([]);
    expect(h.update(4, ...touch, 0.28)).toEqual([{ type: 'locked', missing: 3 }]);
    expect(h.chest.open).toBe(false);
  });

  it('opens when touched with all three keys', () => {
    const h = hunt();
    h.update(0.1, 20.5, 20.5, 0.28);
    h.update(0.1, 30.5, 5.5, 0.28);
    const last = h.update(0.1, 5.5, 30.5, 0.28);
    expect(last.map((e) => e.type)).toEqual(['key', 'allKeys']);
    expect(h.update(0.1, 5, 5, 0.28)).toEqual([]); // nowhere near the chest
    expect(h.update(0.1, 10.5, 9.55, 0.28)).toEqual([{ type: 'open' }]);
    expect(h.chest.open).toBe(true);
    expect(h.update(0.1, 10.5, 9.55, 0.28)).toEqual([]);
  });
});
