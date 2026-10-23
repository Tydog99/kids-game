// Chapter 4: the villagers who need a dragon's help. Pure (no three.js) so it can be tested.
//
// Each needs a different kind of dragon breath:
//   Mayor Max   – the giant bonfire for the village party won't light: fire (Ember)
//   Ice-cream Ivy – her ice-cream cart has run out of ice on a hot day: ice (Frost)
//   Sculptor Sam  – wants his stone dragon statue to sparkle: diamonds (Glimmer)
// Breath of the wrong kind does nothing except earn a friendly hint.
import { walkDistances } from '../treasure.js';
import { createRng } from '../rng.js';

export const VILLAGERS = {
  ember: {
    name: 'Mayor Max',
    thing: 'bonfire',
    breath: 'fire',
    look: 'boy',
    want: "It's the big village party tonight, but the giant bonfire won't light! Can a fire dragon help?",
    wrong: 'That bonfire needs fire! Ember breathes fire.',
    thanks: 'Hooray! The bonfire is lit! Let the party begin! Thank you!',
    short: 'Light Mayor Max’s bonfire',
  },
  frost: {
    name: 'Ice-cream Ivy',
    thing: 'cart',
    breath: 'ice',
    look: 'girl',
    want: "It's so hot today and my ice-cream cart has no ice left! Can an ice dragon help?",
    wrong: 'My cart needs ice! Frost breathes ice.',
    thanks: 'Brrr, lovely and cold! Ice cream for everyone! Thank you!',
    short: 'Fill Ivy’s ice-cream cart with ice',
  },
  glimmer: {
    name: 'Sculptor Sam',
    thing: 'statue',
    breath: 'diamonds',
    look: 'boy',
    want: "I made a stone dragon statue, but it's so plain and grey. Can a sparkly dragon make it shine?",
    wrong: 'My statue needs to sparkle! Glimmer breathes diamonds.',
    thanks: "Wow! A diamond dragon! It's the most beautiful statue ever! Thank you!",
    short: 'Make Sam’s statue sparkle',
  },
};

export const HELPERS = ['ember', 'frost', 'glimmer']; // the order the villagers are placed in

// Breath hits needed to finish a job (a short puff is plenty).
export const HITS_NEEDED = 5;

// Count a breath hit on a villager's thing. Returns { hits, done, wrong } for this hit.
export function breathHit(job, kind) {
  if (job.done) return { ...job, wrong: false };
  if (kind !== VILLAGERS[job.kind].breath) return { ...job, wrong: true };
  const hits = job.hits + 1;
  return { ...job, hits, done: hits >= HITS_NEEDED, wrong: false };
}

// Where the villagers and their things go: in towns other than the one you start in (as far as
// there are enough), each thing on open ground with room around it for a dragon to fly in low,
// and the villager standing beside it. Everything can be reached on foot from the start.
// open(x, z): a tile with nothing on it; keepClear: [{ x, z }] spots to stay away from.
export function placeVillagers(world, start, open, keepClear = []) {
  const rng = createRng(`${world.seed}:village`);
  const dist = walkDistances(world, start.x, start.z, new Set());
  const reach = (x, z) => x >= 0 && z >= 0 && x < world.width && z < world.height && dist[z * world.width + x] < Infinity && dist[z * world.width + x] >= 0;
  const roomy = (x, z) => {
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (!open(x + dx, z + dz)) return false;
    return true;
  };
  const startTown = nearestTown(world.towns, start.x, start.z);
  const others = world.towns.filter((t) => t !== startTown);
  const towns = (others.length ? others : world.towns).slice().sort((a, b) => Math.hypot(a.cx - start.x, a.cz - start.z) - Math.hypot(b.cx - start.x, b.cz - start.z));

  const placed = [];
  const taken = [...keepClear];
  HELPERS.forEach((kind, i) => {
    const town = towns[i % towns.length];
    let best = null;
    // rings outward from the town centre; the first roomy spot (with room for the villager)
    for (let r = 2; r <= 26 && !best; r++) {
      const spots = [];
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = town.cx + dx, z = town.cz + dz;
          if (!reach(x, z) || !roomy(x, z)) continue;
          if (taken.some((k) => Math.hypot(k.x - x, k.z - z) < 7)) continue;
          spots.push({ x, z });
        }
      if (spots.length) best = spots[rng.int(0, spots.length - 1)];
    }
    if (!best) return;
    // the villager stands beside the thing, on the side facing the town centre
    const ang = Math.atan2(town.cz - best.z, town.cx - best.x);
    const vx = best.x + Math.round(Math.cos(ang) * 2), vz = best.z + Math.round(Math.sin(ang) * 2);
    placed.push({ kind, thing: { x: best.x, z: best.z }, villager: { x: vx + 0.5, z: vz + 0.5 }, town });
    taken.push(best);
  });
  return placed;
}

function nearestTown(towns, x, z) {
  let best = null;
  for (const t of towns) if (!best || Math.hypot(t.cx - x, t.cz - z) < Math.hypot(best.cx - x, best.cz - z)) best = t;
  return best;
}
