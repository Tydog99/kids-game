// Seeded randomness. Every random choice in the game goes through here so a
// seed always reproduces the same world.

export function hashSeed(str) {
  // xmur3
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export function createRng(seed) {
  // mulberry32
  let a = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    range: (lo, hi) => lo + next() * (hi - lo),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

const WORDS = ['pallet', 'viridian', 'cerulean', 'maple', 'ember', 'mossy', 'pebble', 'sunny',
  'cloud', 'river', 'acorn', 'comet', 'berry', 'fern', 'cinder', 'breeze'];

export function randomSeed() {
  const r = createRng((Math.random() * 2 ** 32) >>> 0);
  return `${r.pick(WORDS)}-${r.pick(WORDS)}-${r.int(10, 99)}`;
}
