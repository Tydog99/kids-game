// Trees are 8 voxels per tile (voxel = 1/8 unit). Origin: tile corner, y=0 = ground top.
import { VoxelGrid } from '../VoxelGrid.js';
import { createRng } from '../../rng.js';

const LEAVES = ['#3f9a4a', '#358a40', '#48a854', '#2f7d3a'];
const PINE = ['#2b6e48', '#245f3e', '#317a50'];
const TRUNK = ['#7a4f2a', '#6b4423'];

function blob(g, rng, cx, cy, cz, rx, ry, rz, colors) {
  for (let y = -ry; y <= ry; y++)
    for (let z = -rz; z <= rz; z++)
      for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / (rx * rx + 0.5) + (y * y) / (ry * ry + 0.5) + (z * z) / (rz * rz + 0.5);
        if (d <= 1 || (d <= 1.25 && rng.chance(0.35))) g.set(cx + x, cy + y, cz + z, rng.pick(colors));
      }
}

// Oaks have a tall bare trunk and a wide canopy that overhangs the next tiles,
// so the player can walk underneath the leaves.
export function oakTree(variant = 0) {
  const rng = createRng(variant + 11);
  const g = new VoxelGrid();
  const h = rng.int(12, 13); // canopy starts above the player's head, even on the smallest scaled oaks
  g.box(3, 0, 3, 4, h, 4, (x, y, z) => TRUNK[(x + y + z) % 2]);
  // a couple of branches reaching out into the canopy
  for (const [dx, dz] of [[1, 0], [-1, 1]]) {
    for (let i = 1; i <= 2; i++) g.set(3.5 + dx * (i + 0.5) | 0, h - 2 + i, 3.5 + dz * (i + 0.5) | 0, TRUNK[0]);
  }
  blob(g, rng, 3, h + 3, 3, 6, 3, 6, LEAVES);
  blob(g, rng, 8, h + 3, 5, 3, 2, 3, LEAVES);
  blob(g, rng, 0, h + 3, 8, 3, 2, 3, LEAVES);
  blob(g, rng, -1, h + 3, -1, 3, 2, 3, LEAVES);
  blob(g, rng, 4, h + 5, 2, 4, 2, 4, LEAVES);
  // a few red apples on the outside of some trees
  if (variant % 3 === 0) {
    const leaves = g.voxels().filter((v) => v.y > h + 1 && (v.x <= -1 || v.x >= 8 || v.z <= -1 || v.z >= 8));
    for (let i = 0; i < 6 && leaves.length; i++) {
      const v = leaves[rng.int(0, leaves.length - 1)];
      g.set(v.x, v.y, v.z, '#d6312b');
    }
  }
  return g;
}

export function pineTree(variant = 0) {
  const rng = createRng(variant + 23);
  const g = new VoxelGrid();
  g.box(3, 0, 3, 4, 6, 4, TRUNK[0]);
  let y = 5;
  for (const r of [5, 4, 4, 3, 3, 2, 2, 1, 1, 0]) {
    const layers = r >= 2 ? 3 : 2;
    for (let dy = 0; dy < layers; dy++, y++) {
      const rr = dy === layers - 1 && r > 1 ? r - 1 : r; // step in at the top of each tier
      g.box(3 - rr, y, 3 - rr, 4 + rr, y, 4 + rr, (x, yy, z) => {
        const corner = (x === 3 - rr || x === 4 + rr) && (z === 3 - rr || z === 4 + rr);
        return corner && rr > 1 ? null : rng.pick(PINE);
      });
    }
    y--;
  }
  g.set(3, y + 1, 3, PINE[0]).set(4, y + 1, 4, PINE[1]);
  return g;
}

// Volcanic areas get lava-rock spires instead of trees.
export function deadTree(variant = 0) {
  const rng = createRng(variant + 37);
  const g = new VoxelGrid();
  const rock = ['#2e2626', '#3b302e', '#463936'];
  const glow = ['#ff6a1a', '#ff8c1a'];
  const levels = [[0, 7, 0, 2], [1, 6, 3, 5], [2, 5, 6, 7 + rng.int(0, 3)]];
  for (const [lo, hi, y0, y1] of levels) {
    g.box(lo, y0, lo, hi, y1, hi, () => (rng.chance(0.08) ? rng.pick(glow) : rng.pick(rock)));
  }
  // glowing crack running up one face
  for (let y = 0; y < 6; y++) g.set(3 + (y % 2), y, 7 - (y > 2 ? 1 : 0), glow[y % 2]);
  return g;
}

// Pines in Frost's land, with snow sitting on top of every branch.
export function snowyPine(variant = 0) {
  const g = pineTree(variant);
  for (const v of g.voxels()) {
    if (g.has(v.x, v.y + 1, v.z) || PINE_NUM.has(v.color) === false) continue;
    g.set(v.x, v.y, v.z, (v.x + v.z) % 3 ? '#ffffff' : '#e6f0fb');
  }
  return g;
}
const PINE_NUM = new Set(PINE.map((c) => parseInt(c.slice(1), 16)));

// Glimmer's forest: clusters of tall crystal shards in her colours.
export function crystalTree(variant = 0) {
  const rng = createRng(variant + 51);
  const g = new VoxelGrid();
  const tints = [
    ['#ff9fd0', '#ffc2e2', '#f07fbe'],
    ['#8ff0ff', '#c2f8ff', '#5fd8ea'],
    ['#c9a6ff', '#e0ccff', '#a884f0'],
    ['#ffe27a', '#fff0b0', '#f0c84a'],
  ];
  const shards = rng.int(3, 5);
  for (let s = 0; s < shards; s++) {
    const col = tints[(variant + s) % tints.length];
    const bx = 3 + rng.int(-2, 2), bz = 3 + rng.int(-2, 2);
    const h = s === 0 ? rng.int(16, 22) : rng.int(7, 14);
    const lean = [rng.int(-1, 1), rng.int(-1, 1)];
    for (let y = 0; y <= h; y++) {
      const r = y > h - 3 ? 0 : y > h * 0.6 ? 1 : s === 0 ? 1 : 1;
      const ox = Math.round((lean[0] * y) / 8), oz = Math.round((lean[1] * y) / 8);
      g.box(bx + ox - (r ? 1 : 0), y, bz + oz - (r ? 1 : 0), bx + ox, y, bz + oz, (x, yy, z) => (x === bx + ox && z === bz + oz ? col[1] : col[(x + yy + z) % 3 === 0 ? 2 : 0]));
    }
  }
  return g;
}
