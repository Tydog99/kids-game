// Buildings are 8 voxels per tile. Origin: footprint min corner. Front (door) faces +z.
import { VoxelGrid } from '../VoxelGrid.js';

const STONE = ['#8d8d8d', '#7d7d7d', '#9a9a9a'];

function foundation(g, W, D) {
  g.box(0, 0, 0, W - 1, 0, D - 1, (x, y, z) => STONE[(x * 7 + z * 3) % 3]);
}

function stepRoof(g, W, D, y0, colors) {
  // Gable running along x, stepping in on z
  for (let k = 0; k <= D / 2; k++) {
    const z0 = k - 1, z1 = D - k;
    if (z0 > z1) break;
    g.box(-1, y0 + k, z0, W, y0 + k, z1, (x, y, z) => {
      if (z !== z0 && z !== z1 && x !== -1 && x !== W && k < D / 2) return null; // keep it a shell
      return colors[(x + k) % 4 === 0 ? 1 : 0];
    });
  }
}

export function house(variant = 0) {
  const W = 24, D = 24;
  const roofs = [['#d64535', '#b23628'], ['#3f78d1', '#2f5fae'], ['#4b9b4b', '#3a7f3a'], ['#a85fc8', '#8a49a8']];
  const walls = ['#f4efe4', '#efe1c6', '#f6e7d0'];
  const roof = roofs[variant % roofs.length];
  const wall = walls[variant % walls.length];
  const g = new VoxelGrid();
  foundation(g, W, D);
  g.box(1, 1, 2, W - 2, 10, D - 3, wall);
  // wooden corner posts
  for (const [x, z] of [[1, 2], [W - 2, 2], [1, D - 3], [W - 2, D - 3]]) g.box(x, 1, z, x, 10, z, '#8a5a32');
  // door (front = +z)
  g.box(10, 1, D - 2, 13, 7, D - 2, '#7a4a26');
  g.set(13, 4, D - 1, '#e8c547');
  g.box(9, 8, D - 2, 14, 8, D - 2, '#8a5a32');
  // front windows with frames
  for (const x0 of [3, 17]) {
    g.box(x0 - 1, 3, D - 2, x0 + 3, 7, D - 2, '#ffffff');
    g.box(x0, 4, D - 2, x0 + 2, 6, D - 2, '#7ec8f2');
    g.box(x0 - 1, 2, D - 1, x0 + 3, 2, D - 1, '#8a5a32'); // sill
  }
  // side windows
  for (const x of [0, W - 1]) g.box(x, 4, 9, x, 6, 14, '#7ec8f2');
  stepRoof(g, W, D, 11, roof);
  // chimney
  g.box(17, 12, 6, 19, 19, 8, (x, y, z) => STONE[(x + y + z) % 3]);
  // flower boxes
  for (const x of [2, 3, 4, 5, 6, 18, 19, 20, 21]) g.set(x, 1, D - 1, x % 2 ? '#e84a7f' : '#f5d33b');
  return g;
}

export function store(variant = 0) {
  const W = 32, D = 24;
  const g = new VoxelGrid();
  foundation(g, W, D);
  g.box(1, 1, 2, W - 2, 12, D - 3, '#f2ead8');
  // blue roof with a lighter trim band
  stepRoof(g, W, D, 13, ['#2f7fd6', '#2366b3']);
  g.box(0, 12, 1, W - 1, 12, D - 2, '#2f7fd6');
  // big sign band above door
  g.box(6, 9, D - 2, W - 7, 11, D - 2, '#2f7fd6');
  // simple white "shop bag" icon in the middle of the sign
  const cx = W >> 1;
  g.box(cx - 2, 9, D - 1, cx + 1, 10, D - 1, '#ffffff');
  g.set(cx - 1, 11, D - 1, '#ffffff').set(cx, 11, D - 1, '#ffffff');
  // glass sliding doors
  g.box(cx - 3, 1, D - 2, cx + 2, 7, D - 2, (x) => (x === cx - 3 || x === cx + 2 ? '#c0c0c0' : '#a9dcf5'));
  g.box(cx - 1, 1, D - 2, cx, 7, D - 2, '#8fd0f0');
  // shop windows either side, with goods on display
  for (const x0 of [3, W - 10]) {
    g.box(x0, 2, D - 2, x0 + 6, 7, D - 2, '#9fd8f5');
    for (let i = 0; i < 3; i++) g.set(x0 + 1 + i * 2, 2, D - 1, ['#e84a4a', '#f5d33b', '#4ac86b'][(i + variant) % 3]);
  }
  // awning stripes
  g.box(2, 8, D - 1, W - 3, 8, D - 1, (x) => (x % 4 < 2 ? '#2f7fd6' : '#ffffff'));
  return g;
}
