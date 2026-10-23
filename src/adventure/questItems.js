// Where the dragon quest items go: Ember's egg in a forest clearing, Glimmer's 5 gems spread
// around the world, and Frost's moon flower on a lake shore. Seeded from the world, and every
// item can be reached on foot from the start.
import { createRng } from '../rng.js';
import { walkDistances } from '../treasure.js';
import { T } from '../tiles.js';

export const GEM_COUNT = 5;

const near = (world, x, z, r, type) => {
  let n = 0;
  for (let dz = -r; dz <= r; dz++)
    for (let dx = -r; dx <= r; dx++) {
      const tx = x + dx, tz = z + dz;
      if (tx >= 0 && tz >= 0 && tx < world.width && tz < world.height && world.tiles[tz * world.width + tx] === type) n++;
    }
  return n;
};

// keepClear: [{ x, z }] spots items must stay away from (the chest, dragons' resting spots…)
export function placeQuestItems(world, start, keepClear = []) {
  const rng = createRng(`${world.seed}:quests`);
  const dist = walkDistances(world, start.x, start.z, new Set(keepClear.filter((k) => k.solid).map((k) => k.z * world.width + k.x)));
  const tiles = [];
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] < 8) continue; // a little walk from the start, at least
    const x = i % world.width, z = (i / world.width) | 0;
    if (keepClear.some((k) => Math.hypot(k.x - x, k.z - z) < 4)) continue;
    tiles.push({ x, z, walk: dist[i] });
  }
  const pick = (list, fallback) => {
    const l = list.length ? list : fallback;
    return l[rng.int(0, l.length - 1)];
  };

  // egg: deep in the trees (lots of trees around), not too close
  const forest = tiles.filter((t) => t.walk >= 15 && near(world, t.x, t.z, 2, T.TREE) >= 8);
  const egg = pick(forest, tiles);

  // flower: right beside water
  const shore = tiles.filter((t) => near(world, t.x, t.z, 1, T.WATER) >= 2 && Math.hypot(t.x - egg.x, t.z - egg.z) > 10);
  const flower = pick(shore, tiles);

  // gems: spread out, away from each other and the other items
  const gems = [];
  for (const apart of [18, 12, 7, 0]) {
    for (let tries = 0; tries < 3000 && gems.length < GEM_COUNT; tries++) {
      const t = tiles[rng.int(0, tiles.length - 1)];
      if (t.walk < 12) continue;
      if ([...gems, egg, flower].every((o) => Math.hypot(o.x - t.x, o.z - t.z) >= apart)) gems.push(t);
    }
    if (gems.length >= GEM_COUNT) break;
  }
  const only = ({ x, z }) => ({ x, z });
  return { egg: only(egg), flower: only(flower), gems: gems.map(only) };
}
