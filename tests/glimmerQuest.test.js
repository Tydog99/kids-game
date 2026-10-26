import { describe, it, expect } from 'vitest';
import { newGlimmerState, loadGlimmerState, applyGlimmer, glimmerStage, glimmerGoal, lunaSays, songStep, CRYSTALS, LUNA } from '../src/lands/glimmerQuest.js';
import { generateRealmWorld, openGate } from '../src/realms.js';
import { isWalkable } from '../src/worldgen.js';
import voiceLines from '../src/audio/voiceLines.json';

describe('Crystal Forest quests', () => {
  it('crystals, then the song, then the star', () => {
    let s = newGlimmerState();
    expect(glimmerGoal(s).text).toBe('Find Luna the crystal unicorn');
    s = applyGlimmer(s, { type: 'metLuna' });
    expect(lunaSays(s)).toBe(LUNA.want);
    s = applyGlimmer(s, { type: 'sang' }); // too soon
    expect(s.sang).toBe(false);
    for (const index of [4, 0, 0, 2, 1]) s = applyGlimmer(s, { type: 'shine', index });
    expect(glimmerGoal(s).text).toBe(`Make the dull crystals shine with Glimmer (4/${CRYSTALS})`);
    s = applyGlimmer(s, { type: 'shine', index: 3 });
    expect(glimmerStage(s)).toBe('song');
    expect(lunaSays(s)).toBe(LUNA.song);
    s = applyGlimmer(s, { type: 'sang' });
    expect(glimmerGoal(s).text).toBe('Go back to Luna for the star crystal');
    s = applyGlimmer(s, { type: 'star' });
    expect(glimmerGoal(s).text).toBe('Fly the star to the top of the giant crystal tree');
    s = applyGlimmer(s, { type: 'starPlaced' });
    expect(glimmerStage(s)).toBe('done');
    expect(lunaSays(s)).toBe(LUNA.done);
    expect(loadGlimmerState(JSON.stringify(s))).toEqual(s);
    expect(loadGlimmerState('?')).toEqual(newGlimmerState());
  });

  it('the song: right notes so far, a wrong one, the whole tune', () => {
    const tune = [3, 4, 1, 0];
    expect(songStep(tune, [3])).toBe('more');
    expect(songStep(tune, [3, 1])).toBe('wrong');
    expect(songStep(tune, [3, 4, 1, 0])).toBe('done');
  });

  it("every one of Luna's lines is recorded", () => {
    const texts = Object.values(voiceLines).map((l) => l.text);
    for (const t of Object.values(LUNA)) expect(texts).toContain(t);
  });

  for (const seed of ['pallet', 'maple-fern-42', 'cloud-berry-17', 'x', 'dragon']) {
    it(`Luna, the crystals and the singing crystals can be walked to (${seed})`, () => {
      const world = generateRealmWorld(seed);
      openGate(world, 'glimmer');
      const W = world.width, seen = new Uint8Array(W * world.height), queue = [[world.spawn.x, world.spawn.z]];
      seen[world.spawn.z * W + world.spawn.x] = 1;
      for (let h = 0; h < queue.length; h++) {
        const [x, z] = queue[h];
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= W || nz >= world.height || seen[nz * W + nx] || !isWalkable(world, nx, nz)) continue;
          seen[nz * W + nx] = 1;
          queue.push([nx, nz]);
        }
      }
      const ok = (p) => seen[Math.floor(p.z) * W + Math.floor(p.x)] === 1;
      const q = world.realms.find((r) => r.kind === 'glimmer').quest;
      expect(ok(q.glade)).toBe(true);
      expect(q.crystals).toHaveLength(CRYSTALS);
      for (const c of q.crystals) expect(ok(c)).toBe(true);
      expect(q.pillars).toHaveLength(5);
      for (const p of q.pillars) expect(ok(p)).toBe(true);
      expect(q.tune).toHaveLength(4);
      for (let i = 1; i < q.tune.length; i++) expect(q.tune[i]).not.toBe(q.tune[i - 1]); // no note twice in a row
      expect(q.tree.top).toBeGreaterThan(8);
    });
  }
});
