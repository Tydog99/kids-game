// Buildings are 8 voxels per tile. Origin: footprint min corner, y=0 = ground top.
// Front (door) faces +z. Sized so the 1.2-unit-tall player looks right next to them:
// doors are ~1.9 units tall and houses have two storeys.
// Big flat surfaces get texture from patterns (siding, shingles) rather than random
// jitter, so the greedy mesher can merge them into few triangles.
import { VoxelGrid } from '../VoxelGrid.js';
import { BUILDING_SIZE } from '../../tiles.js';

const STONE = ['#8d8d8d', '#7f7f7f'];
const WOOD = '#8a5a32';
const WOOD_DARK = '#6e4626';
const FRAME = '#ffffff';
const GLASS = '#8fd0f0';
const GLASS_DARK = '#74bde3';

function shade(hex, k) {
  const c = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
  const b = Math.min(255, Math.round((c & 255) * k));
  return (r << 16) | (g << 8) | b;
}

function foundation(g, W, D) {
  g.box(1, 0, 3, W - 2, 0, D - 4, (x, y, z) => STONE[((x >> 2) + (z >> 2)) % 2]);
}

// Window set into a wall. `axis` is the wall's facing: 'z' (front/back) or 'x' (sides).
// (a0..a1, y0..y1) is the frame rectangle along the wall at plane `p`.
function windowAt(g, axis, p, a0, a1, y0, y1, out) {
  const set = (a, y, d, c) => (axis === 'z' ? g.set(a, y, p + d, c) : g.set(p + d, y, a, c));
  for (let y = y0; y <= y1; y++)
    for (let a = a0; a <= a1; a++) {
      const edge = a === a0 || a === a1 || y === y0 || y === y1;
      const mullion = a === ((a0 + a1) >> 1) || y === ((y0 + y1) >> 1);
      set(a, y, 0, edge || mullion ? FRAME : y > (y0 + y1) / 2 ? GLASS : GLASS_DARK);
    }
  for (let a = a0 - 1; a <= a1 + 1; a++) set(a, y0 - 1, out, WOOD); // sill
}

// Stepped gable roof, ridge running along x. Returns the ridge height.
function gableRoof(g, W, D, y0, colors, gableColor) {
  let k = 0;
  for (; 2 + k <= D - 3 - k; k++) {
    const z0 = 2 + k, z1 = D - 3 - k, y = y0 + k;
    const row = k % 2 ? colors[1] : colors[0];
    for (let x = 0; x < W; x++) {
      g.set(x, y, z0, row);
      g.set(x, y, z1, row);
    }
    // gable walls closing the ends, just inside the overhang
    for (let z = z0 + 1; z < z1; z++) {
      g.set(2, y, z, gableColor);
      g.set(W - 3, y, z, gableColor);
    }
  }
  // ridge cap
  g.box(0, y0 + k, (D >> 1) - 1, W - 1, y0 + k, D >> 1, colors[2]);
  return y0 + k;
}

const ROOFS = [
  ['#d64535', '#bf3a2c', '#8f2a20'],
  ['#3f78d1', '#3569bb', '#264c8a'],
  ['#4b9b4b', '#418a41', '#2f662f'],
  ['#a85fc8', '#9652b4', '#6f3a87'],
];
const WALLS = ['#f4efe4', '#f3e2bf', '#e9f1f4', '#f6e0d6'];
const DOORS = ['#7a4a26', '#3f6fb5', '#2f7d4a', '#a8332b'];

export function house(variant = 0) {
  const W = BUILDING_SIZE.house.w * 8, D = BUILDING_SIZE.house.d * 8; // 40 x 40
  const roof = ROOFS[variant % ROOFS.length];
  const wall = WALLS[(variant >> 2) % WALLS.length];
  const door = DOORS[(variant >> 4) % DOORS.length];
  const front = D - 5, back = 4; // wall planes
  const cx = W >> 1; // door center
  const g = new VoxelGrid();
  foundation(g, W, D);

  // walls: horizontal siding boards, two storeys split by a wooden band
  g.box(2, 1, back, W - 3, 26, front, (x, y) => (y === 13 ? WOOD : y % 3 === 0 ? shade(wall, 0.93) : wall));
  for (const [x, z] of [[2, back], [W - 3, back], [2, front], [W - 3, front]]) g.box(x, 1, z, x, 26, z, WOOD);

  // front door, recessed one voxel, with a frame, lintel and knob
  g.box(cx - 4, 1, front - 1, cx + 3, 15, front - 1, (x, y) =>
    (x === cx - 1 || x === cx) && y > 1 ? shade(door, 0.85) : ((y - 2) % 6 === 0 ? shade(door, 0.85) : door));
  for (let x = cx - 4; x <= cx + 3; x++) for (let y = 1; y <= 15; y++) g.remove(x, y, front);
  g.box(cx - 5, 1, front + 1, cx - 5, 16, front + 1, WOOD);
  g.box(cx + 4, 1, front + 1, cx + 4, 16, front + 1, WOOD);
  g.box(cx - 5, 16, front + 1, cx + 4, 16, front + 1, WOOD);
  g.set(cx + 2, 8, front, '#e8c547');
  // door step
  g.box(cx - 5, 0, front + 1, cx + 4, 0, front + 3, STONE[0]);

  // windows: two downstairs, three upstairs on the front
  for (const x0 of [5, W - 12]) {
    windowAt(g, 'z', front, x0, x0 + 6, 4, 10, 1);
    // flower box under each downstairs window
    g.box(x0, 2, front + 1, x0 + 6, 2, front + 2, WOOD_DARK);
    for (let x = x0; x <= x0 + 6; x++) g.set(x, 3, front + 2 - (x % 2), ['#e84a7f', '#f5d33b', '#ffffff'][x % 3]);
  }
  for (const x0 of [5, cx - 3, W - 12]) windowAt(g, 'z', front, x0, x0 + 6, 17, 23, 1);
  // side and back windows
  for (const xp of [2, W - 3]) for (const z0 of [9, 24]) for (const y0 of [4, 17]) windowAt(g, 'x', xp, z0, z0 + 6, y0, y0 + 6, xp === 2 ? -1 : 1);
  for (const x0 of [8, W - 15]) windowAt(g, 'z', back, x0, x0 + 6, 17, 23, -1);

  const ridge = gableRoof(g, W, D, 27, roof, wall);
  // round attic window in each gable
  for (const xp of [2, W - 3]) g.box(xp, 31, (D >> 1) - 2, xp, 34, (D >> 1) + 1, (x, y, z) => (y === 31 || y === 34 || z === (D >> 1) - 2 || z === (D >> 1) + 1 ? FRAME : GLASS));
  // chimney
  g.box(W - 12, 30, 9, W - 9, ridge + 3, 12, (x, y) => STONE[(y >> 1) % 2]);
  g.box(W - 13, ridge + 4, 8, W - 8, ridge + 4, 13, STONE[1]);
  return g;
}

export function store(variant = 0) {
  const W = BUILDING_SIZE.store.w * 8, D = BUILDING_SIZE.store.d * 8; // 56 x 40
  const front = D - 5, back = 4;
  const cx = W >> 1;
  const BLUE = '#2f7fd6', BLUE_DARK = '#2366b3';
  const g = new VoxelGrid();
  foundation(g, W, D);

  // walls: brick base, cream upper
  g.box(2, 1, back, W - 3, 24, front, (x, y) =>
    y <= 3 ? (((x + (y % 2) * 2) >> 2) % 2 ? '#b5644a' : '#a85a42') : y % 4 === 0 ? '#e9dfca' : '#f2ead8');
  for (const [x, z] of [[2, back], [W - 3, back], [2, front], [W - 3, front]]) g.box(x, 1, z, x, 24, z, '#c9c9c9');

  // big glass sliding doors, recessed
  for (let x = cx - 5; x <= cx + 4; x++) for (let y = 1; y <= 16; y++) g.remove(x, y, front);
  g.box(cx - 5, 1, front - 1, cx + 4, 16, front - 1, (x) => (x === cx - 1 || x === cx ? '#b0b0b0' : GLASS));
  g.box(cx - 6, 1, front, cx - 6, 17, front + 1, '#c0c0c0');
  g.box(cx + 5, 1, front, cx + 5, 17, front + 1, '#c0c0c0');
  g.box(cx - 6, 17, front, cx + 5, 17, front + 1, '#c0c0c0');
  g.box(cx - 6, 0, front + 1, cx + 5, 0, front + 3, '#c0c0c0'); // doormat strip

  // display windows with goods inside
  for (const x0 of [5, W - 21]) {
    g.box(x0, 4, front, x0 + 15, 14, front, (x, y) => (x === x0 || x === x0 + 15 || y === 4 || y === 14 ? FRAME : GLASS));
    const goods = ['#e84a4a', '#f5d33b', '#4ac86b', '#a85fc8', '#ff8c3a'];
    for (let i = 0; i < 5; i++) g.box(x0 + 2 + i * 3, 5, front, x0 + 3 + i * 3, 6 + (i % 2), front, goods[(i + variant) % goods.length]);
  }
  // striped awning, sloping down and out
  for (let k = 0; k < 3; k++) g.box(3, 19 - k, front + 1 + k, W - 4, 19 - k, front + 1 + k, (x) => ((x >> 2) % 2 ? BLUE : '#ffffff'));

  // sign board with a shopping bag icon
  g.box(cx - 14, 20, front + 1, cx + 13, 24, front + 1, BLUE);
  g.box(cx - 14, 20, front + 1, cx + 13, 20, front + 1, BLUE_DARK);
  g.box(cx - 3, 21, front + 2, cx + 2, 23, front + 2, '#ffffff');
  g.set(cx - 2, 24, front + 2, '#ffffff').set(cx + 1, 24, front + 2, '#ffffff');
  for (const x of [cx - 12, cx - 9, cx + 8, cx + 11]) g.box(x, 22, front + 2, x + 1, 22, front + 2, '#ffffff'); // little "lights"

  // potted plants by the door
  for (const x of [cx - 9, cx + 7]) {
    g.box(x, 0, front + 1, x + 2, 2, front + 3, '#b5644a');
    g.box(x, 3, front + 1, x + 2, 5, front + 3, '#3f9a4a');
    g.set(x + 1, 6, front + 2, '#4ac86b');
  }

  // side windows
  for (const xp of [2, W - 3]) for (const z0 of [10, 22]) windowAt(g, 'x', xp, z0, z0 + 6, 8, 14, xp === 2 ? -1 : 1);

  gableRoof(g, W, D, 25, [BLUE, BLUE_DARK, '#1d4f8a'], '#f2ead8');
  return g;
}
