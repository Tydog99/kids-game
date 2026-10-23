// Where world dragons start. Pure, and seeded from the world so the same seed gives the same spots.
import { createRng } from '../rng.js';
import { isWalkable } from '../worldgen.js';

export const MAX_DRAGONS = 12;
export const DRAGON_KINDS = ['ember', 'glimmer', 'frost'];

// Dragons are big: they need open ground in a ring around them.
export function roomForDragon(walkable, x, z, r = 1) {
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (!walkable(x + dx, z + dz)) return false;
  return true;
}

export function placeDragons(world, count = MAX_DRAGONS) {
  const rng = createRng(`${world.seed}:dragons`);
  const walkable = (x, z) => isWalkable(world, x, z);
  const candidates = [];
  // only in the usual world, not the dragon lands beyond it (realms.js)
  const W = world.core ?? world.width, H = world.core ?? world.height;
  for (let z = 3; z < H - 3; z++)
    for (let x = 3; x < W - 3; x++) {
      if (Math.hypot(x - world.spawn.x, z - world.spawn.z) < 12) continue; // not on top of the player
      if (roomForDragon(walkable, x, z)) candidates.push([x, z]);
    }
  const firstKind = rng.int(0, DRAGON_KINDS.length - 1);
  const out = [];
  for (const minApart of [14, 9, 5, 0]) {
    for (let tries = 0; tries < 3000 && out.length < count && candidates.length; tries++) {
      const [x, z] = candidates[rng.int(0, candidates.length - 1)];
      if (out.every((d) => Math.hypot(d.x - x, d.z - z) >= minApart)) {
        out.push({ x, z, kind: DRAGON_KINDS[(firstKind + out.length) % DRAGON_KINDS.length], heading: rng.next() * Math.PI * 2, seed: rng.int(1, 1e9) });
      }
    }
    if (out.length >= count) break;
  }
  return out;
}
