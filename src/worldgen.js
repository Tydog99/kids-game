// Seed → tile grid + objects. Pure (no three.js) so it can be unit tested.
import { createNoise2D } from 'simplex-noise';
import { createRng } from './rng.js';
import { T, isWalkableTile } from './tiles.js';

export const WORLD_SIZE = 128;
const BORDER = 2;
const TOWN_HALF = 7; // town area is 14x14 tiles

// Facing / direction convention shared with the player: 0=N(-z) 1=E(+x) 2=S(+z) 3=W(-x)
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export const TREE_KIND = { NONE: 0, OAK: 1, PINE: 2, DEAD: 3 };

export function generateWorld(seed, size = WORLD_SIZE) {
  const rng = createRng(String(seed));
  const W = size, H = size;
  const tiles = new Uint8Array(W * H);
  const treeKind = new Uint8Array(W * H);
  const idx = (x, z) => z * W + x;
  const inBounds = (x, z) => x >= 0 && z >= 0 && x < W && z < H;

  const elevA = createNoise2D(rng.next);
  const elevB = createNoise2D(rng.next);
  const heat = createNoise2D(rng.next);
  const lavaN = createNoise2D(rng.next);
  const moist = createNoise2D(rng.next);
  const forest = createNoise2D(rng.next);
  const pineN = createNoise2D(rng.next);

  // 1. Biomes
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const e = elevA(x / 40, z / 40) * 0.7 + elevB(x / 14, z / 14) * 0.3;
      const h = heat(x / 45, z / 45);
      let t;
      if (e < -0.42) t = T.WATER;
      else if (e < -0.32) t = T.SAND;
      else if (h > 0.5) t = h > 0.66 && lavaN(x / 7, z / 7) > 0.15 ? T.LAVA : T.VOLCANIC;
      else t = moist(x / 18, z / 18) > 0.45 ? T.TALL_GRASS : T.GRASS;
      tiles[idx(x, z)] = t;
    }
  }

  // 2. Forests (and a few charred trees in volcanic land)
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, z);
      const t = tiles[i];
      if ((t === T.GRASS || t === T.TALL_GRASS) && forest(x / 22, z / 22) > 0.25 && rng.chance(0.6)) {
        tiles[i] = T.TREE;
        treeKind[i] = pineN(x / 30, z / 30) > 0.2 ? TREE_KIND.PINE : TREE_KIND.OAK;
      } else if (t === T.VOLCANIC && rng.chance(0.03)) {
        tiles[i] = T.TREE;
        treeKind[i] = TREE_KIND.DEAD;
      }
    }
  }

  // 3. Towns
  const towns = [];
  const buildings = [];
  const wantTowns = rng.int(2, 4);
  const lo = BORDER + TOWN_HALF + 2, hi = W - BORDER - TOWN_HALF - 3;
  for (let attempt = 0; attempt < 400 && towns.length < wantTowns; attempt++) {
    const cx = rng.int(lo, hi), cz = rng.int(lo, hi);
    if (towns.some((t) => Math.hypot(t.cx - cx, t.cz - cz) < 34)) continue;
    let good = 0, total = 0;
    forTownArea(cx, cz, (x, z) => {
      total++;
      const t = tiles[idx(x, z)];
      if (t === T.GRASS || t === T.TALL_GRASS || t === T.TREE || t === T.SAND) good++;
    });
    if (good / total < 0.85) continue;
    towns.push({ cx, cz });
  }
  if (towns.length === 0) towns.push({ cx: W >> 1, cz: H >> 1 }); // always at least one

  towns.forEach(buildTown);

  // 4. Tree border around the map edge
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      if (x < BORDER || z < BORDER || x >= W - BORDER || z >= H - BORDER) {
        const i = idx(x, z);
        tiles[i] = T.TREE;
        treeKind[i] = rng.chance(0.5) ? TREE_KIND.PINE : TREE_KIND.OAK;
      }
    }
  }

  // 5. Roads between towns
  for (let i = 1; i < towns.length; i++) {
    carvePath(towns[i - 1].cx, towns[i - 1].cz, towns[i].cx, towns[i].cz);
  }

  // 6. Spawn in front of the first store, facing away from it
  const store = buildings.find((b) => b.type === 'store');
  const spawn = { x: store.doorX, z: store.doorZ, facing: store.doorDir };

  // 7. Make sure every door is reachable from spawn
  for (let pass = 0; pass < buildings.length + 1; pass++) {
    const seen = reachable(spawn.x, spawn.z);
    const blocked = buildings.find((b) => !seen[idx(b.doorX, b.doorZ)]);
    if (!blocked) break;
    carvePath(spawn.x, spawn.z, blocked.doorX, blocked.doorZ);
  }

  // Objects list (trees + buildings) for the renderer
  const objects = [...buildings];
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, z);
      if (tiles[i] === T.TREE) objects.push({ type: 'tree', kind: treeKind[i], x, z, variant: rng.int(0, 1000) });
    }
  }

  return { seed: String(seed), width: W, height: H, tiles, treeKind, objects, buildings, towns, spawn };

  // ---- helpers (hoisted) ----

  function forTownArea(cx, cz, fn) {
    for (let z = cz - TOWN_HALF; z < cz + TOWN_HALF; z++)
      for (let x = cx - TOWN_HALF; x < cx + TOWN_HALF; x++) fn(x, z);
  }

  function buildTown({ cx, cz }) {
    forTownArea(cx, cz, (x, z) => {
      tiles[idx(x, z)] = T.GRASS;
      treeKind[idx(x, z)] = 0;
    });
    // Main roads: a cross through the center
    for (let d = -TOWN_HALF; d < TOWN_HALF; d++) {
      tiles[idx(cx + d, cz)] = T.DIRT;
      tiles[idx(cx, cz + d)] = T.DIRT;
    }
    // Small plaza
    for (let z = cz - 1; z <= cz + 1; z++) for (let x = cx - 1; x <= cx + 1; x++) tiles[idx(x, z)] = T.DIRT;

    const plan = ['store', ...Array(rng.int(2, 5)).fill('house')];
    for (const type of plan) {
      const w = type === 'store' ? 4 : 3, d = 3;
      for (let tries = 0; tries < 60; tries++) {
        const x0 = rng.int(cx - TOWN_HALF, cx + TOWN_HALF - w);
        const z0 = rng.int(cz - TOWN_HALF, cz + TOWN_HALF - d);
        const north = z0 + d <= cz; // building sits north of the main road → door faces south
        if (!north && z0 <= cz) continue;
        const doorX = x0 + (w >> 1);
        const doorZ = north ? z0 + d : z0 - 1;
        const doorDir = north ? 2 : 0;
        // footprint (with a 1-tile margin on the sides) must be empty grass
        let ok = true;
        for (let z = z0; z < z0 + d && ok; z++)
          for (let x = x0 - 1; x <= x0 + w && ok; x++) {
            if (!inBounds(x, z)) { ok = false; break; }
            const t = tiles[idx(x, z)];
            if (x >= x0 && x < x0 + w ? t !== T.GRASS : t === T.BUILDING) ok = false;
          }
        if (!ok) continue;
        // walkway from door straight to the main road must not hit a building
        const step = north ? 1 : -1;
        for (let z = doorZ; z !== cz; z += step) if (tiles[idx(doorX, z)] === T.BUILDING) ok = false;
        if (!ok) continue;

        for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) tiles[idx(x, z)] = T.BUILDING;
        for (let z = doorZ; z !== cz; z += step) tiles[idx(doorX, z)] = T.DIRT;
        buildings.push({ type, x: x0, z: z0, w, d, doorX, doorZ, doorDir, variant: rng.int(0, 1000) });
        break;
      }
    }
  }

  function tileCost(t) {
    switch (t) {
      case T.DIRT: return 0.5;
      case T.TREE: return 4;
      case T.WATER: return 6;
      case T.LAVA: return 8;
      case T.BUILDING: return Infinity;
      default: return 1;
    }
  }

  // Dijkstra from (ax,az) to (bx,bz), then turn the route into walkable ground.
  function carvePath(ax, az, bx, bz) {
    const dist = new Float32Array(W * H).fill(Infinity);
    const prev = new Int32Array(W * H).fill(-1);
    const heap = [];
    const push = (d, i) => {
      heap.push([d, i]);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (heap[p][0] <= heap[c][0]) break;
        [heap[p], heap[c]] = [heap[c], heap[p]];
        c = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let c = 0;
        for (;;) {
          const l = 2 * c + 1, r = l + 1;
          let m = c;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]];
          c = m;
        }
      }
      return top;
    };
    const start = idx(ax, az), goal = idx(bx, bz);
    dist[start] = 0;
    push(0, start);
    while (heap.length) {
      const [d, i] = pop();
      if (i === goal) break;
      if (d > dist[i]) continue;
      const x = i % W, z = (i / W) | 0;
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz;
        if (nx < BORDER || nz < BORDER || nx >= W - BORDER || nz >= H - BORDER) continue;
        const ni = idx(nx, nz);
        const nd = d + tileCost(tiles[ni]);
        if (nd < dist[ni]) {
          dist[ni] = nd;
          prev[ni] = i;
          push(nd, ni);
        }
      }
    }
    for (let i = goal; i !== -1; i = prev[i]) {
      const t = tiles[i];
      if (t === T.WATER) tiles[i] = T.SAND; // simple sand bridge
      else if (t === T.LAVA) tiles[i] = T.VOLCANIC; // cooled lava
      else if (t === T.VOLCANIC) { /* keep rocky ground */ }
      else if (t !== T.BUILDING) tiles[i] = T.DIRT;
      treeKind[i] = 0;
    }
  }

  function reachable(sx, sz) {
    const seen = new Uint8Array(W * H);
    const q = [idx(sx, sz)];
    seen[q[0]] = 1;
    while (q.length) {
      const i = q.pop();
      const x = i % W, z = (i / W) | 0;
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz;
        if (!inBounds(nx, nz)) continue;
        const ni = idx(nx, nz);
        if (!seen[ni] && isWalkableTile(tiles[ni])) {
          seen[ni] = 1;
          q.push(ni);
        }
      }
    }
    return seen;
  }
}

export function tileAt(world, x, z) {
  if (x < 0 || z < 0 || x >= world.width || z >= world.height) return T.TREE;
  return world.tiles[z * world.width + x];
}

export function isWalkable(world, x, z) {
  return isWalkableTile(tileAt(world, x, z));
}
