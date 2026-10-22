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

export function oakTree(variant = 0) {
  const rng = createRng(variant + 11);
  const g = new VoxelGrid();
  const h = rng.int(4, 6);
  g.box(3, 0, 3, 4, h, 4, (x, y, z) => TRUNK[(x + y + z) % 2]);
  blob(g, rng, 3, h + 3, 3, 3, 3, 3, LEAVES);
  blob(g, rng, 5, h + 2, 4, 2, 2, 2, LEAVES);
  blob(g, rng, 2, h + 2, 5, 2, 2, 2, LEAVES);
  // a few red apples on some trees
  if (variant % 3 === 0) for (let i = 0; i < 4; i++) g.set(rng.int(0, 7), h + rng.int(1, 4), 7, '#d6312b');
  return g;
}

export function pineTree(variant = 0) {
  const rng = createRng(variant + 23);
  const g = new VoxelGrid();
  g.box(3, 0, 3, 4, 3, 4, TRUNK[0]);
  let y = 3;
  for (const r of [4, 3, 3, 2, 2, 1, 1, 0]) {
    for (let dy = 0; dy < 2; dy++, y++) {
      g.box(3 - r, y, 3 - r, 4 + r, y, 4 + r, (x, yy, z) => {
        const corner = (x === 3 - r || x === 4 + r) && (z === 3 - r || z === 4 + r);
        return corner && r > 1 ? null : rng.pick(PINE);
      });
    }
    if (r <= 1) y--;
  }
  g.set(3, y, 3, PINE[0]).set(4, y, 4, PINE[1]);
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
