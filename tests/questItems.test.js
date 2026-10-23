import { describe, it, expect } from 'vitest';
import { generateWorld, isWalkable } from '../src/worldgen.js';
import { placeQuestItems, GEM_COUNT } from '../src/adventure/questItems.js';
import { walkDistances } from '../src/treasure.js';
import { T } from '../src/tiles.js';

describe('placeQuestItems', () => {
  it('is the same for the same seed', () => {
    const w = generateWorld('pallet');
    expect(placeQuestItems(w, w.spawn)).toEqual(placeQuestItems(generateWorld('pallet'), w.spawn));
  });

  for (const seed of ['pallet', 'quest-1', 'quest-2', 'quest-3', 'quest-4', 'quest-5']) {
    it(`puts every item somewhere reachable: ${seed}`, () => {
      const w = generateWorld(seed);
      const items = placeQuestItems(w, w.spawn);
      const dist = walkDistances(w, w.spawn.x, w.spawn.z);
      const all = [items.egg, items.flower, ...items.gems];
      expect(items.gems).toHaveLength(GEM_COUNT);
      for (const it of all) {
        expect(isWalkable(w, it.x, it.z)).toBe(true);
        expect(dist[it.z * w.width + it.x]).toBeGreaterThanOrEqual(8);
      }
      // the flower is on a shore when the world has reachable water
      const hasWater = w.tiles.includes(T.WATER);
      if (hasWater) {
        let water = 0;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (w.tiles[(items.flower.z + dz) * w.width + items.flower.x + dx] === T.WATER) water++;
        expect(water).toBeGreaterThan(0);
      }
    });
  }
});
