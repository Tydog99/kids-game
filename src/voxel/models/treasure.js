// Treasure hunt models. Front faces +z, origin at the bottom center.
import { VoxelGrid } from '../VoxelGrid.js';

const GOLD = '#ffcc33', GOLD_LIGHT = '#ffe680', GOLD_DARK = '#d99a1a';
const WOOD = '#8a4f2a', WOOD_DARK = '#6b3a1d', WOOD_LIGHT = '#9c5d33';

// Golden key standing upright: ring (bow) on top, shaft, teeth at the bottom. Voxel = 1/24 unit.
export function goldenKey() {
  const g = new VoxelGrid();
  // ring
  for (let y = 11; y <= 21; y++)
    for (let x = -5; x <= 5; x++) {
      const r = Math.hypot(x, y - 16);
      if (r <= 5.4 && r >= 2.6) for (let z = -1; z <= 0; z++) g.set(x, y, z, r > 4.6 ? GOLD_DARK : (x + y) % 5 === 0 ? GOLD_LIGHT : GOLD);
    }
  g.set(-2, 19, 1, GOLD_LIGHT).set(-3, 18, 1, GOLD_LIGHT); // shine
  // shaft
  g.box(-1, 0, -1, 0, 11, 0, (x) => (x === 0 ? GOLD_DARK : GOLD));
  // teeth
  g.box(1, 0, -1, 4, 1, 0, GOLD);
  g.box(1, 3, -1, 3, 4, 0, GOLD);
  g.box(4, 2, -1, 4, 2, 0, GOLD_DARK);
  return g;
}

// Chest body (voxel = 1/16 unit): wooden planks with gold bands and a lock plate.
export function chestBody() {
  const g = new VoxelGrid();
  const W = 9, D = 6, H = 10; // x -9..8, z -6..5
  g.box(-W, 0, -D, W - 1, H, D - 1, (x, y, z) => {
    if (x <= -W + 1 || x >= W - 2 || x === -1 || x === 0) return y % 3 === 0 ? GOLD_DARK : GOLD; // bands
    if (y === 0 || y === H) return GOLD_DARK;
    return y % 4 === 0 ? WOOD_DARK : (x + z) % 7 === 0 ? WOOD_LIGHT : WOOD;
  });
  // lock plate with keyhole
  g.box(-2, 4, D, 1, 9, D, GOLD_LIGHT);
  g.box(-1, 5, D, 0, 7, D, '#3a2410');
  g.set(-1, 8, D, '#3a2410').set(0, 8, D, '#3a2410');
  // little feet
  for (const x of [-W, W - 2]) for (const z of [-D, D - 2]) g.box(x, -1, z, x + 1, -1, z + 1, GOLD_DARK);
  return g;
}

// Lid with a rounded top. Its origin is the back hinge, so rotating around x opens it.
export function chestLid() {
  const g = new VoxelGrid();
  const W = 9, D = 6;
  const profile = [6, 6, 6, 5, 5, 4, 3]; // half-depth at each height: a curved top
  profile.forEach((half, y) => {
    g.box(-W, y, -half, W - 1, y, half - 1, (x, yy, z) => {
      if (x <= -W + 1 || x >= W - 2 || x === -1 || x === 0) return GOLD;
      return z === -half || z === half - 1 || yy === profile.length - 1 ? WOOD_DARK : WOOD;
    });
  });
  // gold rim along the front edge and a clasp that meets the lock
  g.box(-W, 0, D - 1, W - 1, 0, D - 1, GOLD_DARK);
  g.box(-2, -2, D, 1, 1, D, GOLD_LIGHT);
  return g;
}

export const CHEST_LID_HINGE = { y: 11, z: -6 }; // voxel coords of the hinge on the body
