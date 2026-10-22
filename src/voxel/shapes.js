// Shape helpers for sculpting voxel models out of rounded forms.
import { parseColor } from './VoxelGrid.js';

export function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function shade(hex, k) {
  const c = parseColor(hex);
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
  const b = Math.min(255, Math.round((c & 255) * k));
  return (r << 16) | (g << 8) | b;
}

const paint = (color, ...args) => (typeof color === 'function' ? color(...args) : color);

// Ellipsoid centered on c with radii r. color(x, y, z, n) gets n = normalized offset [-1..1]^3.
export function ellipsoid(g, [cx, cy, cz], [rx, ry, rz], color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const n = [(x - cx) / rx, (y - cy) / ry, (z - cz) / rz];
        if (n[0] * n[0] + n[1] * n[1] + n[2] * n[2] <= 1) {
          const c = paint(color, x, y, z, n);
          if (c != null) g.set(x, y, z, c);
        }
      }
}

// Tapered tube from a to b, radius r0 at a and r1 at b. color(x, y, z, t) gets t = 0..1 along it.
export function capsule(g, a, b, r0, r1, color) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1;
  const rMax = Math.max(r0, r1);
  const lo = a.map((v, i) => Math.floor(Math.min(v, b[i]) - rMax));
  const hi = a.map((v, i) => Math.ceil(Math.max(v, b[i]) + rMax));
  for (let y = lo[1]; y <= hi[1]; y++)
    for (let z = lo[2]; z <= hi[2]; z++)
      for (let x = lo[0]; x <= hi[0]; x++) {
        const p = [x - a[0], y - a[1], z - a[2]];
        const t = Math.max(0, Math.min(1, (p[0] * d[0] + p[1] * d[1] + p[2] * d[2]) / len2));
        const q = [p[0] - d[0] * t, p[1] - d[1] * t, p[2] - d[2] * t];
        const r = r0 + (r1 - r0) * t;
        if (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] <= r * r) {
          const c = paint(color, x, y, z, t);
          if (c != null) g.set(x, y, z, c);
        }
      }
}

// Highest filled voxel in column (x, z), or null.
export function topAt(g, x, z, yFrom = 64, yTo = -64) {
  for (let y = yFrom; y >= yTo; y--) if (g.has(x, y, z)) return y;
  return null;
}

// Outermost filled voxel along +x (side = 1) or -x (side = -1) at (y, z), or null.
export function sideAt(g, side, y, z, range = 64) {
  for (let x = side * range; side > 0 ? x >= -range : x <= range; x -= side) if (g.has(x, y, z)) return x;
  return null;
}

// Frontmost filled voxel along +z at (x, y), or null.
export function frontAt(g, x, y, range = 64) {
  for (let z = range; z >= -range; z--) if (g.has(x, y, z)) return z;
  return null;
}
