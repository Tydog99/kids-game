import { describe, it, expect } from 'vitest';
import { generateWorld, isWalkable } from '../src/worldgen.js';
import { walkDistances } from '../src/treasure.js';
import { placeVillagers, breathHit, VILLAGERS, HITS_NEEDED } from '../src/adventure/village.js';
import voiceLines from '../src/audio/voiceLines.json';

describe('village chapter', () => {
  it('each villager needs a different dragon, and only the right breath counts', () => {
    expect(new Set(Object.values(VILLAGERS).map((v) => v.breath)).size).toBe(3);
    let job = { kind: 'frost', hits: 0, done: false };
    job = breathHit(job, 'fire');
    expect(job.wrong).toBe(true);
    expect(job.hits).toBe(0);
    for (let i = 0; i < HITS_NEEDED; i++) job = breathHit(job, 'ice');
    expect(job.done).toBe(true);
    expect(breathHit(job, 'fire').wrong).toBe(false); // nothing more to do once it's done
  });

  it("every villager line is recorded, with the villager's own voice", () => {
    const texts = Object.values(voiceLines).map((l) => l.text);
    for (const v of Object.values(VILLAGERS)) for (const t of [v.want, v.wrong, v.thanks]) expect(texts).toContain(t);
  });

  for (const seed of ['pallet', 'maple-fern-42', 'cloud-berry-17', 'ember-river-63', 'x', 'dragon']) {
    it(`places all three villagers on open, reachable ground (${seed})`, () => {
      const world = generateWorld(seed);
      const start = world.spawn;
      const open = (x, z) => isWalkable(world, x, z);
      const placed = placeVillagers(world, start, open, [{ x: start.x, z: start.z }]);
      expect(placed.map((p) => p.kind).sort()).toEqual(['ember', 'frost', 'glimmer']);
      const dist = walkDistances(world, start.x, start.z);
      for (const p of placed) {
        for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) expect(open(p.thing.x + dx, p.thing.z + dz)).toBe(true);
        expect(dist[p.thing.z * world.width + p.thing.x]).toBeGreaterThan(0);
        expect(open(Math.floor(p.villager.x), Math.floor(p.villager.z))).toBe(true);
        expect(Math.hypot(p.thing.x - start.x, p.thing.z - start.z)).toBeGreaterThan(6);
      }
      for (const a of placed) for (const b of placed) if (a !== b) expect(Math.hypot(a.thing.x - b.thing.x, a.thing.z - b.thing.z)).toBeGreaterThanOrEqual(7);
    });
  }
});
