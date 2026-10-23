// The dragon lands beyond the map: Ember's Fire Mountains and Glimmer's Crystal Forest to the
// east, Frost's Frozen Land to the south. Pure (no three.js) so it can be tested.
//
// The usual world (generateWorld) stays exactly as it was in the top-left corner of a bigger
// grid; everything else is mountain rock, with the three lands set into it. A corridor runs from
// the edge of the usual world to each land, closed by a magic gate (T.GATE) until that land's
// dragon is your friend. In the middle of each land is the dragon's nest, with eggs in it.
import { createNoise2D } from 'simplex-noise';
import { createRng } from './rng.js';
import { T, isWalkableTile } from './tiles.js';
import { generateWorld, TREE_KIND, WORLD_SIZE } from './worldgen.js';
import { walkDistances } from './treasure.js';

export const CORE = WORLD_SIZE; // the usual world
export const WORLD = 208; // the whole grid (a multiple of the renderer's 16-tile chunks)
const CORRIDOR = 1; // tiles either side of the corridor's middle (so it's 3 wide)
const NEST_CLEAR = 4; // open ground around the nest

export const REALM_KINDS = ['ember', 'glimmer', 'frost'];
export const REALMS = {
  ember: { name: 'the Fire Mountains', icon: '🔥', side: 'east', x0: 146, z0: 6, x1: 202, z1: 62, ground: T.VOLCANIC },
  glimmer: { name: 'the Crystal Forest', icon: '💎', side: 'east', x0: 146, z0: 70, x1: 202, z1: 124, ground: T.CRYSTAL },
  frost: { name: 'the Frozen Land', icon: '❄️', side: 'south', x0: 36, z0: 146, x1: 92, z1: 202, ground: T.SNOW },
};

export function generateRealmWorld(seed) {
  const core = generateWorld(seed);
  const W = WORLD;
  const tiles = new Uint8Array(W * W).fill(T.ROCK);
  const treeKind = new Uint8Array(W * W);
  const idx = (x, z) => z * W + x;
  for (let z = 0; z < CORE; z++)
    for (let x = 0; x < CORE; x++) {
      tiles[idx(x, z)] = core.tiles[z * CORE + x];
      treeKind[idx(x, z)] = core.treeKind[z * CORE + x];
    }
  // how far each tile of the usual world is from the start, to join the corridors onto paths
  const dist = walkDistances(core, core.spawn.x, core.spawn.z);
  const reachable = (x, z) => x >= 0 && z >= 0 && x < CORE && z < CORE && dist[z * CORE + x] >= 0;
  const rng = createRng(`${seed}:realms`);

  const set = (x, z, t) => {
    tiles[idx(x, z)] = t;
    treeKind[idx(x, z)] = 0;
  };
  const tree = (x, z, kind) => {
    tiles[idx(x, z)] = T.TREE;
    treeKind[idx(x, z)] = kind;
  };
  // make a tile walkable (paths through land, the corridor, round the nest)
  const open = (x, z, ground) => {
    if (!isWalkableTile(tiles[idx(x, z)]) || tiles[idx(x, z)] === T.ICE) set(x, z, ground);
  };

  const realms = REALM_KINDS.map((kind) => {
    const R = REALMS[kind];
    const n1 = createNoise2D(rng.next), n2 = createNoise2D(rng.next), n3 = createNoise2D(rng.next);
    // 1. the land itself, with a ragged rocky edge
    for (let z = R.z0; z < R.z1; z++)
      for (let x = R.x0; x < R.x1; x++) {
        const edge = Math.min(x - R.x0, R.x1 - 1 - x, z - R.z0, R.z1 - 1 - z);
        if (edge < 3 && n3(x / 5, z / 5) > edge * 0.45 - 0.4) continue; // stays rock
        paint(kind, x, z, n1, n2);
      }
    const cx = Math.floor((R.x0 + R.x1) / 2), cz = Math.floor((R.z0 + R.z1) / 2);

    // 2. the corridor from the usual world, and the gate across its mouth
    const east = R.side === 'east';
    const c = corridorLine(R, east);
    const gate = [];
    const along = (a, b) => (east ? [a, b] : [b, a]); // (along the corridor, across it) → (x, z)
    const start = east ? R.x0 : R.z0;
    for (let a = CORE; a < start; a++)
      for (let d = -CORRIDOR; d <= CORRIDOR; d++) {
        const [x, z] = along(a, c + d);
        if (a === CORE) {
          set(x, z, T.GATE);
          gate.push(idx(x, z));
        } else set(x, z, R.ground);
      }
    // inside the usual world: a dirt path through the border trees to the nearest open ground
    for (let a = CORE - 1; a >= CORE - 40; a--) {
      for (let d = -CORRIDOR; d <= CORRIDOR; d++) {
        const [x, z] = along(a, c + d);
        set(x, z, T.DIRT);
      }
      const [x, z] = along(a, c);
      if (a < CORE - 2 && reachable(x, z)) break;
    }
    // 3. a path from the corridor to the nest, and a clearing round the nest
    for (let a = start; a <= (east ? cx : cz); a++)
      for (let d = -CORRIDOR; d <= CORRIDOR; d++) {
        const [x, z] = along(a, c + d);
        open(x, z, R.ground);
      }
    // …then turn and run straight to the nest
    const [lo, hi] = east ? [Math.min(c, cz), Math.max(c, cz)] : [Math.min(c, cx), Math.max(c, cx)];
    for (let k = lo - CORRIDOR; k <= hi + CORRIDOR; k++)
      for (let d = -CORRIDOR; d <= CORRIDOR; d++) (east ? open(cx + d, k, R.ground) : open(k, cz + d, R.ground));
    for (let z = cz - NEST_CLEAR; z <= cz + NEST_CLEAR; z++)
      for (let x = cx - NEST_CLEAR; x <= cx + NEST_CLEAR; x++) if (Math.hypot(x - cx, z - cz) <= NEST_CLEAR + 0.5) set(x, z, R.ground);

    const [gx, gz] = along(CORE, c);
    return {
      kind,
      name: R.name,
      icon: R.icon,
      ground: R.ground,
      bounds: { x0: R.x0, z0: R.z0, x1: R.x1, z1: R.z1 },
      // the corridor outside the usual world, gate included
      corridor: east ? { x0: CORE, z0: c - CORRIDOR, x1: R.x0, z1: c + CORRIDOR + 1 } : { x0: c - CORRIDOR, z0: CORE, x1: c + CORRIDOR + 1, z1: R.z0 },
      gate,
      gateAt: { x: gx + 0.5, z: gz + 0.5, east },
      nest: { x: cx + 0.5, z: cz + 0.5 },
    };
  });

  // trees: the usual world's as they were (less any cut for paths), then the new lands'
  const objects = [...core.buildings];
  for (const o of core.objects) if (o.type === 'tree' && tiles[idx(o.x, o.z)] === T.TREE) objects.push(o);
  for (let z = 0; z < W; z++)
    for (let x = 0; x < W; x++) if ((x >= CORE || z >= CORE) && tiles[idx(x, z)] === T.TREE) objects.push({ type: 'tree', kind: treeKind[idx(x, z)], x, z, variant: rng.int(0, 1000) });

  return { ...core, width: W, height: W, tiles, treeKind, objects, core: CORE, realms };

  function paint(kind, x, z, n1, n2) {
    const e = n1(x / 13, z / 13), s = n2(x / 7, z / 7);
    if (kind === 'ember') {
      if (e > 0.45) set(x, z, T.LAVA);
      else if (s > 0.6) set(x, z, T.ROCK); // rocky spires
      else if (rng.chance(0.05)) tree(x, z, TREE_KIND.DEAD);
      else set(x, z, T.VOLCANIC);
    } else if (kind === 'glimmer') {
      if (e < -0.62) set(x, z, T.WATER);
      else if (s > 0.05 && rng.chance(0.5)) tree(x, z, TREE_KIND.CRYSTAL);
      else set(x, z, T.CRYSTAL);
    } else {
      if (e < -0.62) set(x, z, T.WATER);
      else if (e < -0.3) set(x, z, T.ICE); // frozen ponds you can walk on
      else if (s > 0.7) set(x, z, T.ROCK);
      else if (s > 0.1 && rng.chance(0.45)) tree(x, z, TREE_KIND.SNOW_PINE);
      else set(x, z, T.SNOW);
    }
  }

  // Where across the edge the corridor runs: as near the middle of the land as possible, where a
  // short path through the border reaches open ground without cutting through a building.
  function corridorLine(R, east) {
    const mid = Math.floor(east ? (R.z0 + R.z1) / 2 : (R.x0 + R.x1) / 2);
    let best = null;
    for (let off = 0; off <= 18; off++)
      for (const c of [mid + off, mid - off]) {
        let len = null;
        for (let a = CORE - 1; a >= CORE - 40; a--) {
          let blocked = false;
          for (let d = -CORRIDOR; d <= CORRIDOR; d++) {
            const [x, z] = east ? [a, c + d] : [c + d, a];
            if (core.tiles[z * CORE + x] === T.BUILDING) blocked = true;
          }
          if (blocked) break;
          const [x, z] = east ? [a, c] : [c, a];
          if (a < CORE - 2 && reachable(x, z)) {
            len = CORE - a;
            break;
          }
        }
        if (len !== null && (!best || len + off * 0.5 < best.score)) best = { c, score: len + off * 0.5 };
      }
    return best ? best.c : mid;
  }
}

// The land (or its corridor) at a tile, or null.
export function realmAt(world, x, z) {
  for (const r of world.realms ?? []) {
    const inside = (b) => x >= b.x0 && x < b.x1 && z >= b.z0 && z < b.z1;
    if (inside(r.bounds) || inside(r.corridor)) return r;
  }
  return null;
}

// Open a land's gate: the corridor can be walked (and flown) through.
export function openGate(world, kind) {
  const r = world.realms?.find((r) => r.kind === kind);
  if (!r) return false;
  for (const i of r.gate) world.tiles[i] = r.ground;
  r.open = true;
  return true;
}
