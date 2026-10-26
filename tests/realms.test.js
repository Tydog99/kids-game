import { describe, it, expect } from 'vitest';
import { generateWorld, isWalkable } from '../src/worldgen.js';
import { generateRealmWorld, openGate, realmAt, CORE, WORLD, REALM_KINDS } from '../src/realms.js';
import { walkDistances, placeTreasure } from '../src/treasure.js';
import { placeDragons } from '../src/creatures/dragonSpawns.js';
import { T } from '../src/tiles.js';

// walking distances over the whole grid (walkDistances itself stays in the usual world)
function walkAll(world, sx, sz) {
  const seen = new Uint8Array(world.width * world.height);
  const q = [[sx, sz]];
  seen[sz * world.width + sx] = 1;
  for (let h = 0; h < q.length; h++) {
    const [x, z] = q[h];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= world.width || nz >= world.height) continue;
      if (seen[nz * world.width + nx] || !isWalkable(world, nx, nz)) continue;
      seen[nz * world.width + nx] = 1;
      q.push([nx, nz]);
    }
  }
  return seen;
}

describe('dragon lands', () => {
  for (const seed of ['pallet', 'maple-fern-42', 'cloud-berry-17', 'x', 'dragon']) {
    it(`the usual world is kept, and each land is reached only once its gate is open (${seed})`, () => {
      const core = generateWorld(seed);
      const world = generateRealmWorld(seed);
      expect(world.width).toBe(WORLD);
      expect(world.width % 16).toBe(0);
      // the usual world is unchanged apart from the three paths cut through its edge
      let changed = 0;
      for (let z = 0; z < CORE; z++) for (let x = 0; x < CORE; x++) if (core.tiles[z * CORE + x] !== world.tiles[z * WORLD + x]) changed++;
      expect(changed).toBeLessThan(3 * 3 * 40);
      expect(world.buildings).toEqual(core.buildings);

      const nestTile = (r) => Math.floor(r.nest.z) * WORLD + Math.floor(r.nest.x);
      let seen = walkAll(world, world.spawn.x, world.spawn.z);
      for (const r of world.realms) expect(seen[nestTile(r)]).toBe(0); // all gates closed
      for (const kind of REALM_KINDS) {
        openGate(world, kind);
        seen = walkAll(world, world.spawn.x, world.spawn.z);
        for (const r of world.realms) expect(seen[nestTile(r)]).toBe(r.open ? 1 : 0);
      }
      // the nest has open ground all around it
      for (const r of world.realms) {
        for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) expect(isWalkable(world, Math.floor(r.nest.x) + dx, Math.floor(r.nest.z) + dz)).toBe(true);
        expect(realmAt(world, Math.floor(r.nest.x), Math.floor(r.nest.z))).toBe(r);
      }
    });
  }

  it('each land has its own ground and trees', () => {
    const world = generateRealmWorld('pallet');
    const count = (r, t) => {
      let n = 0;
      for (let z = r.bounds.z0; z < r.bounds.z1; z++) for (let x = r.bounds.x0; x < r.bounds.x1; x++) if (world.tiles[z * WORLD + x] === t) n++;
      return n;
    };
    const land = Object.fromEntries(world.realms.map((r) => [r.kind, r]));
    expect(count(land.frost, T.SNOW)).toBeGreaterThan(500);
    expect(count(land.ember, T.VOLCANIC)).toBeGreaterThan(500);
    expect(count(land.ember, T.LAVA)).toBeGreaterThan(20);
    expect(count(land.glimmer, T.CRYSTAL)).toBeGreaterThan(500);
    expect(count(land.glimmer, T.TREE)).toBeGreaterThan(100);
  });

  it('keys, treasure and dragons are still only placed in the usual world', () => {
    for (const seed of ['pallet', 'maple-fern-42']) {
      const world = generateRealmWorld(seed);
      for (const kind of REALM_KINDS) openGate(world, kind);
      const { chest, keys } = placeTreasure(world);
      for (const p of [chest, ...keys, ...placeDragons(world)]) {
        expect(p.x).toBeLessThan(CORE);
        expect(p.z).toBeLessThan(CORE);
      }
      const dist = walkDistances(world, world.spawn.x, world.spawn.z);
      for (let i = 0; i < dist.length; i++) if (dist[i] >= 0) expect(i % WORLD < CORE && Math.floor(i / WORLD) < CORE).toBe(true);
    }
  });
});

describe('dragon land looks', () => {
  const world = generateRealmWorld('maple-fern-42');
  it('mountains rise away from open ground', () => {
    let low = 0, high = 0;
    for (let i = 0; i < world.tiles.length; i++) {
      if (world.tiles[i] !== T.ROCK) continue;
      expect(world.rockHeight[i]).toBeGreaterThan(0.3);
      if (world.rockHeight[i] < 3) low++;
      if (world.rockHeight[i] > 6) high++;
    }
    expect(low).toBeGreaterThan(100);
    expect(high).toBeGreaterThan(100);
  });

  it('each land has its landmark (clear of the nest) and its critters on open ground', () => {
    for (const r of world.realms) {
      const L = r.landmark;
      expect(world.tiles[Math.floor(L.z) * WORLD + Math.floor(L.x)]).toBe(T.ROCK);
      expect(Math.hypot(L.x - r.nest.x, L.z - r.nest.z)).toBeGreaterThan(L.r + 5);
      const spots = Object.values(r.props).flat();
      expect(spots.length).toBeGreaterThan(8);
      for (const s of spots) {
        expect(realmAt(world, Math.floor(s.x), Math.floor(s.z))).toBe(r);
        const t = world.tiles[Math.floor(s.z) * WORLD + Math.floor(s.x)];
        expect(r.kind === 'ember' ? [T.VOLCANIC, T.LAVA] : [r.ground]).toContain(t);
      }
    }
    const volcano = world.realms.find((r) => r.kind === 'ember').landmark;
    const at = (dx) => world.rockHeight[Math.floor(volcano.z) * WORLD + Math.floor(volcano.x) + dx];
    expect(at(3)).toBeGreaterThan(at(6)); // slopes up toward the top…
    expect(at(0)).toBeLessThan(at(2)); // …with a crater in it
  });
});
