import { describe, it, expect } from 'vitest';
import { newEmberState, loadEmberState, applyEmber, emberStage, emberGoal, flickerSays, SPRITES, FLICKER } from '../src/lands/emberQuest.js';
import { generateRealmWorld, openGate } from '../src/realms.js';
import { isWalkable } from '../src/worldgen.js';
import { T } from '../src/tiles.js';
import voiceLines from '../src/audio/voiceLines.json';

function reachable(world) {
  const W = world.width, seen = new Uint8Array(W * world.height), q = [[world.spawn.x, world.spawn.z]];
  seen[world.spawn.z * W + world.spawn.x] = 1;
  for (let h = 0; h < q.length; h++) {
    const [x, z] = q[h];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= world.height || seen[nz * W + nx] || !isWalkable(world, nx, nz)) continue;
      seen[nz * W + nx] = 1;
      q.push([nx, nz]);
    }
  }
  return (p) => seen[Math.floor(p.z) * W + Math.floor(p.x)] === 1;
}

describe('Fire Mountains quests', () => {
  it('warm the sprites, then the egg, then hatch it', () => {
    let s = newEmberState();
    expect(emberGoal(s).text).toBe('Find Flicker the fire sprite');
    s = applyEmber(s, { type: 'metFlicker' });
    expect(flickerSays(s)).toBe(FLICKER.want);
    s = applyEmber(s, { type: 'egg' }); // too soon
    expect(s.egg).toBe('island');
    for (const index of [0, 2, 2, 1, 3]) s = applyEmber(s, { type: 'warm', index });
    expect(emberGoal(s).text).toBe(`Warm up the sleepy fire sprites with Ember (4/${SPRITES})`);
    s = applyEmber(s, { type: 'warm', index: 4 });
    expect(emberStage(s)).toBe('river');
    expect(flickerSays(s)).toBe(FLICKER.river);
    s = applyEmber(s, { type: 'stone', tile: 1234 });
    s = applyEmber(s, { type: 'egg' });
    expect(emberGoal(s).text).toBe("Carry the egg up to the volcano's crater");
    s = applyEmber(s, { type: 'hatch' }); // not until it's in the crater
    expect(s.egg).toBe('carried');
    s = applyEmber(s, { type: 'eggSet' });
    expect(emberGoal(s).text).toBe('Breathe fire on the egg with Ember');
    s = applyEmber(s, { type: 'hatch' });
    s = applyEmber(s, { type: 'name', name: 'Sparkle' });
    expect(emberStage(s)).toBe('done');
    expect(emberGoal(s)).toBe(null);
    expect(loadEmberState(JSON.stringify(s))).toEqual(s);
    expect(loadEmberState('nope')).toEqual(newEmberState());
  });

  it("every one of Flicker's lines is recorded", () => {
    const texts = Object.values(voiceLines).map((l) => l.text);
    for (const t of Object.values(FLICKER)) expect(texts).toContain(t);
  });

  for (const seed of ['pallet', 'maple-fern-42', 'cloud-berry-17', 'x', 'dragon']) {
    it(`the hearth and sprites can be walked to, the island only over stepping stones (${seed})`, () => {
      const world = generateRealmWorld(seed);
      openGate(world, 'ember');
      const ember = world.realms.find((r) => r.kind === 'ember'), q = ember.quest;
      let ok = reachable(world);
      expect(ok(q.hearth)).toBe(true);
      expect(q.sprites).toHaveLength(SPRITES);
      for (const s of q.sprites) expect(ok(s)).toBe(true);
      expect(ok(q.island)).toBe(false); // ringed by lava
      expect(q.moat.length).toBeGreaterThan(60);
      for (const i of q.island.tiles) expect(world.noLand.has(i)).toBe(true);
      // cool a line of lava across the moat into stones: now it can be walked to
      for (const i of q.moat) {
        const x = i % world.width, z = (i / world.width) | 0;
        if (x === Math.floor(q.island.x) && z > q.island.z) world.tiles[i] = T.VOLCANIC;
      }
      ok = reachable(world);
      expect(ok(q.island)).toBe(true);
      // the crater is the volcano's
      expect(q.crater).toEqual({ x: ember.landmark.x, z: ember.landmark.z });
    });
  }
});
