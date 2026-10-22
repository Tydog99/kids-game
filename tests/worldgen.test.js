import { describe, it, expect } from 'vitest';
import { generateWorld, isWalkable, tileAt, DIRS } from '../src/worldgen.js';
import { T } from '../src/tiles.js';

const SEEDS = Array.from({ length: 20 }, (_, i) => `seed-${i}`);

function reachableFrom(world, sx, sz) {
  const seen = new Set([`${sx},${sz}`]);
  const q = [[sx, sz]];
  while (q.length) {
    const [x, z] = q.pop();
    for (const [dx, dz] of DIRS) {
      const k = `${x + dx},${z + dz}`;
      if (!seen.has(k) && isWalkable(world, x + dx, z + dz)) {
        seen.add(k);
        q.push([x + dx, z + dz]);
      }
    }
  }
  return seen;
}

describe('generateWorld', () => {
  it('is deterministic for the same seed', () => {
    const a = generateWorld('pallet'), b = generateWorld('pallet');
    expect(Buffer.from(a.tiles).equals(Buffer.from(b.tiles))).toBe(true);
    expect(a.objects).toEqual(b.objects);
    expect(a.spawn).toEqual(b.spawn);
  });

  it('differs for different seeds', () => {
    const a = generateWorld('pallet'), b = generateWorld('viridian');
    expect(Buffer.from(a.tiles).equals(Buffer.from(b.tiles))).toBe(false);
  });

  for (const seed of SEEDS) {
    it(`is playable: ${seed}`, () => {
      const w = generateWorld(seed);
      // spawn walkable
      expect(isWalkable(w, w.spawn.x, w.spawn.z)).toBe(true);
      // edges are trees
      for (let i = 0; i < w.width; i++) {
        expect(tileAt(w, i, 0)).toBe(T.TREE);
        expect(tileAt(w, 0, i)).toBe(T.TREE);
        expect(tileAt(w, i, w.height - 1)).toBe(T.TREE);
        expect(tileAt(w, w.width - 1, i)).toBe(T.TREE);
      }
      // buildings: correct tiles, no overlap
      const claimed = new Set();
      for (const b of w.buildings) {
        for (let z = b.z; z < b.z + b.d; z++)
          for (let x = b.x; x < b.x + b.w; x++) {
            expect(tileAt(w, x, z)).toBe(T.BUILDING);
            const k = `${x},${z}`;
            expect(claimed.has(k)).toBe(false);
            claimed.add(k);
          }
      }
      expect(w.buildings.filter((b) => b.type === 'store').length).toBeGreaterThanOrEqual(1);
      expect(w.buildings.filter((b) => b.type === 'house').length).toBeGreaterThanOrEqual(2);
      // every door reachable
      const seen = reachableFrom(w, w.spawn.x, w.spawn.z);
      for (const b of w.buildings) expect(seen.has(`${b.doorX},${b.doorZ}`)).toBe(true);
    });
  }

  it('has variety across seeds', () => {
    let withVolcanic = 0, withWater = 0;
    for (const seed of SEEDS) {
      const w = generateWorld(seed);
      if (w.tiles.includes(T.VOLCANIC)) withVolcanic++;
      if (w.tiles.includes(T.WATER)) withWater++;
    }
    expect(withVolcanic).toBeGreaterThan(SEEDS.length / 2);
    expect(withWater).toBeGreaterThan(SEEDS.length / 2);
  });
});
