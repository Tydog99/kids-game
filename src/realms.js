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
export const WORLD = 240; // the whole grid (a multiple of the renderer's 16-tile chunks)
const CORRIDOR = 1; // tiles either side of the corridor's middle (so it's 3 wide)
const NEST_CLEAR = 4; // open ground around the nest
// each land's big centrepiece, on the far side of the nest from the corridor
const LANDMARK = { ember: { what: 'volcano', r: 7 }, glimmer: { what: 'crystalTree', r: 3 }, frost: { what: 'iceCastle', r: 5 } };
export const ROCK_STYLE = { grey: 0, frost: 1, ember: 2, glimmer: 3 };

export const REALM_KINDS = ['ember', 'glimmer', 'frost'];
export const REALMS = {
  // the Fire Mountains are wider, for their quests (lands/emberQuest.js)
  ember: { name: 'the Fire Mountains', icon: '🔥', side: 'east', x0: 146, z0: 6, x1: 236, z1: 62, ground: T.VOLCANIC },
  glimmer: { name: 'the Crystal Forest', icon: '💎', side: 'east', x0: 146, z0: 70, x1: 202, z1: 124, ground: T.CRYSTAL },
  // the Frozen Land is twice as wide, for its penguin quests (lands/frostQuest.js)
  frost: { name: 'the Frozen Land', icon: '❄️', side: 'south', x0: 8, z0: 146, x1: 120, z1: 202, ground: T.SNOW },
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
  const heights = new Map(); // tile → rock height set by hand (the volcano, plinths)
  const noLand = new Set(); // tiles dragons won't land on (the hot island in the Fire Mountains)
  const styles = new Map(); // tile → rock style set by hand

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

    // 4. the landmark: a clearing with the landmark's own ground in the middle
    const L = LANDMARK[kind];
    const lx = east ? cx + 15 : cx, lz = east ? cz : cz + 15;
    for (let z = lz - L.r - 2; z <= lz + L.r + 2; z++)
      for (let x = lx - L.r - 2; x <= lx + L.r + 2; x++) {
        const d = Math.hypot(x - lx, z - lz);
        if (d <= L.r) {
          set(x, z, T.ROCK);
          // the volcano rises to a crater; the others stand on a low plinth
          if (L.what === 'volcano') heights.set(idx(x, z), d < 1.6 ? 6.2 : 2 + (L.r - d) * 1.25);
          else heights.set(idx(x, z), 0.45);
          styles.set(idx(x, z), ROCK_STYLE[kind]);
        } else if (d <= L.r + 2) set(x, z, R.ground);
      }

    // 4b. the Frozen Land's quest places: a big lake to freeze for a skating party, Mama Penguin's
    // colony, and the tall snowy peak where the Penguin King lost his crown
    let quest = null;
    if (kind === 'frost') {
      const lake = { x: R.x0 + 22, z: cz - 2, rx: 8, rz: 5, tiles: [] };
      for (let z = lake.z - lake.rz - 3; z <= lake.z + lake.rz + 3; z++)
        for (let x = lake.x - lake.rx - 3; x <= lake.x + lake.rx + 3; x++) {
          const e = ((x - lake.x) / lake.rx) ** 2 + ((z - lake.z) / lake.rz) ** 2;
          if (e <= 1) {
            set(x, z, T.WATER);
            lake.tiles.push(idx(x, z));
          } else if (e <= 1.9) set(x, z, R.ground); // a snowy shore all round
        }
      const colony = { x: R.x1 - 24, z: cz - 3 };
      for (let z = colony.z - 6; z <= colony.z + 6; z++) for (let x = colony.x - 6; x <= colony.x + 6; x++) if (Math.hypot(x - colony.x, z - colony.z) <= 6.5) set(x, z, R.ground);
      const peak = { x: R.x1 - 10, z: R.z1 - 11, r: 7 };
      for (let z = peak.z - peak.r - 2; z <= peak.z + peak.r + 2; z++)
        for (let x = peak.x - peak.r - 2; x <= peak.x + peak.r + 2; x++) {
          const d = Math.hypot(x - peak.x, z - peak.z);
          if (d <= peak.r) {
            set(x, z, T.ROCK);
            heights.set(idx(x, z), 2 + (peak.r - d) * 1.6);
            styles.set(idx(x, z), ROCK_STYLE.frost);
          } else if (d <= peak.r + 2) set(x, z, R.ground);
        }
      // a path from the lake, past the nest, to the colony
      for (let x = lake.x + lake.rx + 1; x <= colony.x; x++) for (let d = -1; d <= 1; d++) open(x, cz + d, R.ground);
      quest = {
        lake: { x: lake.x + 0.5, z: lake.z + 0.5, rx: lake.rx, rz: lake.rz, tiles: lake.tiles },
        colony: { x: colony.x + 0.5, z: colony.z + 0.5 },
        peak: { x: peak.x + 0.5, z: peak.z + 0.5, top: 2 + peak.r * 1.6 },
      };
    }

    // 4c. the Fire Mountains' quest places: Flicker the fire sprite's hearth, and an island in a ring
    // of lava (the moat) with a dragon egg on it. Dragons won't land on the hot island.
    if (kind === 'ember') {
      const hearth = { x: R.x0 + 18, z: cz + 13 };
      for (let z = hearth.z - 5; z <= hearth.z + 5; z++) for (let x = hearth.x - 5; x <= hearth.x + 5; x++) if (Math.hypot(x - hearth.x, z - hearth.z) <= 5.2) set(x, z, R.ground);
      for (let z = Math.min(c, hearth.z); z <= Math.max(c, hearth.z); z++) for (let d = -1; d <= 1; d++) open(hearth.x + d, z, R.ground);
      const island = { x: R.x0 + 30, z: R.z0 + 13, r: 3, tiles: [] };
      const moat = [];
      for (let z = island.z - 10; z <= island.z + 10; z++)
        for (let x = island.x - 10; x <= island.x + 10; x++) {
          const d = Math.hypot(x - island.x, z - island.z);
          if (d <= 3.2) {
            set(x, z, R.ground);
            island.tiles.push(idx(x, z));
            noLand.add(idx(x, z));
          } else if (d <= 7.2) {
            set(x, z, T.LAVA);
            moat.push(idx(x, z));
          } else if (d <= 9.5) set(x, z, R.ground); // a shore all round
        }
      for (let z = island.z + 8; z <= c; z++) for (let d = -1; d <= 1; d++) open(island.x + d, z, R.ground);
      quest = {
        hearth: { x: hearth.x + 0.5, z: hearth.z + 0.5 },
        island: { x: island.x + 0.5, z: island.z + 0.5, r: island.r, tiles: island.tiles },
        moat,
        crater: { x: lx + 0.5, z: lz + 0.5 },
      };
    }

    // 5. little things: snowmen and penguins, lava bubbles and fire sprites, crystal flowers and
    // butterflies, on open ground away from the nest, the landmark and the path
    const spots = [];
    for (let z = R.z0 + 3; z < R.z1 - 3; z++)
      for (let x = R.x0 + 3; x < R.x1 - 3; x++) {
        if (tiles[idx(x, z)] !== R.ground) continue;
        if (Math.hypot(x - cx, z - cz) < NEST_CLEAR + 2 || Math.hypot(x - lx, z - lz) < L.r + 3) continue;
        if (Math.abs((east ? z : x) - c) <= CORRIDOR + 1) continue;
        if (quest?.colony && Math.hypot(x - quest.colony.x, z - quest.colony.z) < 9) continue;
        if (quest?.hearth && (Math.hypot(x - quest.hearth.x, z - quest.hearth.z) < 8 || Math.hypot(x - quest.island.x, z - quest.island.z) < 11)) continue;
        spots.push({ x: x + 0.5, z: z + 0.5 });
      }
    const pickSpots = (n, apart) => {
      const out = [];
      for (let tries = 0; tries < 2000 && out.length < n && spots.length; tries++) {
        const s = spots[rng.int(0, spots.length - 1)];
        if (out.every((o) => Math.hypot(o.x - s.x, o.z - s.z) >= apart)) out.push(s);
      }
      return out;
    };
    const lavaTiles = [];
    if (kind === 'ember')
      for (let z = R.z0; z < R.z1; z++) for (let x = R.x0; x < R.x1; x++) if (tiles[idx(x, z)] === T.LAVA) lavaTiles.push({ x: x + 0.5, z: z + 0.5 });
    const props = {
      frost: () => ({ snowmen: pickSpots(8, 10), penguins: pickSpots(8, 8) }),
      ember: () => ({ sprites: pickSpots(6, 8), bubbles: Array.from({ length: Math.min(14, lavaTiles.length) }, () => lavaTiles[rng.int(0, lavaTiles.length - 1)]) }),
      glimmer: () => ({ flowers: pickSpots(26, 3), butterflies: pickSpots(9, 6) }),
    }[kind]();

    // where Flicker's five sleepy fire sprites are: spread out, away from the hearth
    if (quest?.hearth) {
      quest.sprites = [];
      for (const apart of [16, 11, 7, 0])
        for (let tries = 0; tries < 2000 && quest.sprites.length < 5; tries++) {
          const s = spots[rng.int(0, spots.length - 1)];
          if (Math.hypot(s.x - quest.hearth.x, s.z - quest.hearth.z) < 12) continue;
          if (quest.sprites.every((o) => Math.hypot(o.x - s.x, o.z - s.z) >= apart)) quest.sprites.push(s);
        }
    }
    // where Mama Penguin's five lost chicks wandered off to: spread out, well away from home
    if (quest?.colony) {
      quest.chicks = [];
      for (const apart of [16, 11, 7, 0])
        for (let tries = 0; tries < 2000 && quest.chicks.length < 5; tries++) {
          const s = spots[rng.int(0, spots.length - 1)];
          if (Math.hypot(s.x - quest.colony.x, s.z - quest.colony.z) < 14) continue;
          if (quest.chicks.every((o) => Math.hypot(o.x - s.x, o.z - s.z) >= apart)) quest.chicks.push(s);
        }
    }

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
      landmark: { what: L.what, x: lx + 0.5, z: lz + 0.5, r: L.r },
      props,
      quest,
    };
  });

  // mountains: rock rises the further it is from open ground, in each land's own kind of rock
  const rockHeight = new Float32Array(W * W);
  const rockStyle = new Uint8Array(W * W);
  const far = new Int16Array(W * W).fill(-1);
  const queue = [];
  for (let i = 0; i < W * W; i++) if (tiles[i] !== T.ROCK) {
    far[i] = 0;
    queue.push(i);
  }
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h], x = i % W, z = (i / W) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= W || far[idx(nx, nz)] !== -1) continue;
      far[idx(nx, nz)] = far[i] + 1;
      queue.push(idx(nx, nz));
    }
  }
  const bumps = createNoise2D(rng.next);
  for (let z = 0; z < W; z++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, z);
      if (tiles[i] !== T.ROCK) continue;
      rockHeight[i] = heights.get(i) ?? 1.4 + Math.min(far[i], 8) * 0.85 + bumps(x / 9, z / 9) * 0.9 + (bumps(x / 2.3, z / 2.3) + 1) * 0.25;
      // the rock of the nearest land (plain grey further away)
      let style = ROCK_STYLE.grey, best = 18;
      for (const r of realms) {
        const b = r.bounds;
        const d = Math.hypot(Math.max(b.x0 - x, 0, x - b.x1 + 1), Math.max(b.z0 - z, 0, z - b.z1 + 1));
        if (d < best) {
          best = d;
          style = ROCK_STYLE[r.kind];
        }
      }
      rockStyle[i] = styles.get(i) ?? style;
    }

  // trees: the usual world's as they were (less any cut for paths), then the new lands'
  const objects = [...core.buildings];
  for (const o of core.objects) if (o.type === 'tree' && tiles[idx(o.x, o.z)] === T.TREE) objects.push(o);
  for (let z = 0; z < W; z++)
    for (let x = 0; x < W; x++) if ((x >= CORE || z >= CORE) && tiles[idx(x, z)] === T.TREE) objects.push({ type: 'tree', kind: treeKind[idx(x, z)], x, z, variant: rng.int(0, 1000) });

  return { ...core, width: W, height: W, tiles, treeKind, objects, core: CORE, realms, rockHeight, rockStyle, noLand };

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
