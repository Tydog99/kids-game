import { describe, it, expect } from 'vitest';
import { newFrostState, loadFrostState, applyFrost, frostStage, frostGoal, following, mamaSays, kingSays, lakeFrozen, CHICKS, MAMA, KING } from '../src/lands/frostQuest.js';
import { generateRealmWorld } from '../src/realms.js';
import { T } from '../src/tiles.js';
import voiceLines from '../src/audio/voiceLines.json';

describe('Frozen Land quests', () => {
  it('chicks follow you once found, and go home together', () => {
    let s = newFrostState();
    expect(frostGoal(s).text).toBe("Find Mama Penguin's igloo");
    s = applyFrost(s, { type: 'metMama' });
    expect(mamaSays(s)).toBe(MAMA.want);
    s = applyFrost(s, { type: 'chick', index: 3 });
    s = applyFrost(s, { type: 'chick', index: 3 });
    s = applyFrost(s, { type: 'chick', index: 0 });
    expect(following(s)).toEqual([3, 0]);
    expect(frostGoal(s).text).toBe('Bring the chicks home to Mama (2/5)');
    s = applyFrost(s, { type: 'home' });
    expect(following(s)).toEqual([]);
    expect(frostGoal(s).text).toBe("Find Mama Penguin's lost chicks (2/5)");
    for (const index of [1, 2, 4]) s = applyFrost(s, { type: 'chick', index });
    s = applyFrost(s, { type: 'home' });
    expect(frostStage(s)).toBe('lake');
    expect(mamaSays(s)).toBe(MAMA.skate);
  });

  it('then the lake, then the crown; the King waits his turn', () => {
    let s = { ...newFrostState(), metMama: true, found: [0, 1, 2, 3, 4], home: [0, 1, 2, 3, 4] };
    expect(kingSays(s)).toBe(KING.early);
    s = applyFrost(s, { type: 'crown' }); // not yet
    expect(s.crown).toBe('peak');
    s = applyFrost(s, { type: 'lakeFrozen' });
    expect(frostStage(s)).toBe('crown');
    expect(kingSays(s)).toBe(KING.want);
    s = applyFrost(s, { type: 'crown' });
    expect(frostGoal(s).text).toBe('Bring the crown to the Penguin King');
    s = applyFrost(s, { type: 'crownHome' });
    expect(frostStage(s)).toBe('done');
    expect(frostGoal(s)).toBe(null);
    expect(loadFrostState(JSON.stringify(s))).toEqual(s);
    expect(loadFrostState('junk')).toEqual(newFrostState());
  });

  it('counts how much of the lake is frozen', () => {
    expect(lakeFrozen([1, 2, 3, 4], (i) => i > 1)).toBe(0.75);
  });

  it("every one of Mama's and the King's lines is recorded", () => {
    const texts = Object.values(voiceLines).map((l) => l.text);
    for (const t of [...Object.values(MAMA), ...Object.values(KING)]) expect(texts).toContain(t);
  });

  it('the Frozen Land has its lake, colony, peak and five chicks', () => {
    for (const seed of ['pallet', 'maple-fern-42', 'x']) {
      const world = generateRealmWorld(seed);
      const frost = world.realms.find((r) => r.kind === 'frost');
      const q = frost.quest;
      expect(q.lake.tiles.length).toBeGreaterThan(80);
      for (const i of q.lake.tiles) expect(world.tiles[i]).toBe(T.WATER);
      expect(q.chicks).toHaveLength(CHICKS);
      for (const c of q.chicks) expect(world.tiles[Math.floor(c.z) * world.width + Math.floor(c.x)]).toBe(T.SNOW);
      expect(world.tiles[Math.floor(q.colony.z) * world.width + Math.floor(q.colony.x)]).toBe(T.SNOW);
      expect(q.peak.top).toBeGreaterThan(10);
      expect(world.rockHeight[Math.floor(q.peak.z) * world.width + Math.floor(q.peak.x)]).toBeCloseTo(q.peak.top);
    }
  });
});

describe('Frozen Land quest places can be walked to', () => {
  for (const seed of ['pallet', 'maple-fern-42', 'cloud-berry-17', 'x', 'dragon']) {
    it(`from the start, once Frost's gate is open (${seed})`, async () => {
      const { openGate } = await import('../src/realms.js');
      const { isWalkable } = await import('../src/worldgen.js');
      const world = generateRealmWorld(seed);
      openGate(world, 'frost');
      const W = world.width, seen = new Uint8Array(W * W), q = [[world.spawn.x, world.spawn.z]];
      seen[world.spawn.z * W + world.spawn.x] = 1;
      for (let h = 0; h < q.length; h++) {
        const [x, z] = q[h];
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (nx < 0 || nz < 0 || nx >= W || nz >= W || seen[nz * W + nx] || !isWalkable(world, nx, nz)) continue;
          seen[nz * W + nx] = 1;
          q.push([nx, nz]);
        }
      }
      const frost = world.realms.find((r) => r.kind === 'frost'), qd = frost.quest;
      const ok = (p) => seen[Math.floor(p.z) * W + Math.floor(p.x)] === 1;
      for (const c of qd.chicks) expect(ok(c)).toBe(true);
      expect(ok(qd.colony)).toBe(true);
      // a shore tile of the lake, and the ground in front of the castle (where the King stands)
      expect(ok({ x: qd.lake.x + qd.lake.rx + 1, z: qd.lake.z })).toBe(true);
      const L = frost.landmark, n = frost.nest, a = Math.atan2(n.x - L.x, n.z - L.z);
      expect(ok({ x: L.x + Math.sin(a) * (L.r + 1.5), z: L.z + Math.cos(a) * (L.r + 1.5) })).toBe(true);
    });
  }
});
