// Treasure hunt rules: where the chest and keys go, and what happens when you touch them.
// Pure (no three.js) so it can be unit tested.
import { createRng } from './rng.js';
import { DIRS, isWalkable } from './worldgen.js';

export const KEY_COUNT = 3;
export const KEY_PICKUP_RADIUS = 0.65;
export const CHEST_TOUCH_REACH = 0.45; // how close (beyond the player's body) counts as touching

// Tiles reachable on foot from (sx, sz), with walking distance. `blocked` tiles are treated as solid.
export function walkDistances(world, sx, sz, blocked = new Set()) {
  const dist = new Int32Array(world.width * world.height).fill(-1);
  const start = sz * world.width + sx;
  dist[start] = 0;
  const queue = [start];
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h];
    const x = i % world.width, z = (i / world.width) | 0;
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz, ni = nz * world.width + nx;
      if (!isWalkable(world, nx, nz) || blocked.has(ni) || dist[ni] !== -1) continue;
      dist[ni] = dist[i] + 1;
      queue.push(ni);
    }
  }
  return dist;
}

// Chest goes a few steps in front of the store door, off to one side, so it's in view at the start
// (the player starts two steps out from the door) and never blocks the path out.
function placeChest(world) {
  const { x: sx, z: sz, facing } = world.spawn;
  const [fx, fz] = DIRS[facing];
  const [rx, rz] = DIRS[(facing + 1) % 4];
  // (ahead, side) from the store door; the player starts 2 steps out, so these are 3–4 steps in
  // front of the player, just off the path
  const candidates = [[5, 1], [5, -1], [6, 1], [6, -1], [4, 1], [4, -1], [5, 2], [5, -2], [6, 2], [6, -2], [3, 1], [3, -1], [2, 1], [2, -1]];
  const before = walkDistances(world, sx, sz);
  for (const [ahead, side] of candidates) {
    const x = sx + fx * ahead + rx * side, z = sz + fz * ahead + rz * side;
    const i = z * world.width + x;
    if (!isWalkable(world, x, z) || world.tiles[i] === 2 /* keep dirt paths clear */) continue;
    // must not cut off anywhere that was reachable before
    const after = walkDistances(world, sx, sz, new Set([i]));
    let cuts = false;
    for (let k = 0; k < before.length && !cuts; k++) if (k !== i && before[k] !== -1 && after[k] === -1) cuts = true;
    if (cuts) continue;
    // the chest's front faces back toward the spawn path
    const facingBack = side > 0 ? (facing + 3) % 4 : (facing + 1) % 4;
    return { x, z, facing: facingBack };
  }
  throw new Error('no room for the treasure chest');
}

export function placeTreasure(world) {
  const rng = createRng(`${world.seed}:treasure`);
  const chest = placeChest(world);
  const dist = walkDistances(world, world.spawn.x, world.spawn.z, new Set([chest.z * world.width + chest.x]));
  const reachable = [];
  for (let i = 0; i < dist.length; i++) if (dist[i] > 0) reachable.push(i);

  // try for keys far from spawn and far from each other; relax if the world is small
  for (const [minWalk, minApart] of [[30, 28], [24, 20], [16, 14], [8, 6], [1, 1]]) {
    const pool = reachable.filter((i) => dist[i] >= minWalk);
    const keys = [];
    for (let tries = 0; tries < 2000 && keys.length < KEY_COUNT && pool.length; tries++) {
      const i = pool[rng.int(0, pool.length - 1)];
      const x = i % world.width, z = (i / world.width) | 0;
      if (keys.every((k) => Math.hypot(k.x - x, k.z - z) >= minApart)) keys.push({ x, z });
    }
    if (keys.length === KEY_COUNT) return { chest, keys };
  }
  throw new Error('no room for the keys');
}

// Tracks progress during a hunt. update() returns a list of events for the UI.
export class TreasureHunt {
  constructor({ chest, keys }) {
    this.chest = { ...chest, open: false };
    this.keys = keys.map((k) => ({ ...k, collected: false }));
    this.lockedCooldown = 0;
  }

  get collected() {
    return this.keys.filter((k) => k.collected).length;
  }

  get hasAllKeys() {
    return this.collected === this.keys.length;
  }

  // px, pz: player position in world units. playerRadius: player's body size.
  update(dt, px, pz, playerRadius) {
    const events = [];
    this.lockedCooldown = Math.max(0, this.lockedCooldown - dt);
    for (const k of this.keys) {
      if (!k.collected && Math.hypot(px - k.x - 0.5, pz - k.z - 0.5) < KEY_PICKUP_RADIUS) {
        k.collected = true;
        events.push({ type: 'key', key: k, count: this.collected });
        if (this.hasAllKeys) events.push({ type: 'allKeys' });
      }
    }
    if (!this.chest.open && this.touchingChest(px, pz, playerRadius)) {
      if (this.hasAllKeys) {
        this.chest.open = true;
        events.push({ type: 'open' });
      } else if (this.lockedCooldown === 0) {
        this.lockedCooldown = 4;
        events.push({ type: 'locked', missing: this.keys.length - this.collected });
      }
    }
    return events;
  }

  touchingChest(px, pz, playerRadius) {
    // distance from the player to the chest's tile square
    const dx = Math.max(this.chest.x - px, 0, px - (this.chest.x + 1));
    const dz = Math.max(this.chest.z - pz, 0, pz - (this.chest.z + 1));
    return Math.hypot(dx, dz) <= playerRadius + CHEST_TOUCH_REACH;
  }
}
