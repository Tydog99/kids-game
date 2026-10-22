// A sparse 3D grid of colored voxels. Models are built by "painting" into one.
// Pure (no three.js) so it can be unit tested.

const key = (x, y, z) => `${x},${y},${z}`;

export function parseColor(c) {
  return typeof c === 'number' ? c : parseInt(c.replace('#', ''), 16);
}

export class VoxelGrid {
  constructor() {
    this.map = new Map();
  }

  set(x, y, z, color) {
    this.map.set(key(x, y, z), { x, y, z, color: parseColor(color) });
    return this;
  }

  get(x, y, z) {
    return this.map.get(key(x, y, z));
  }

  has(x, y, z) {
    return this.map.has(key(x, y, z));
  }

  remove(x, y, z) {
    this.map.delete(key(x, y, z));
    return this;
  }

  // Inclusive box. `color` may be a function (x, y, z) => color | null.
  box(x0, y0, z0, x1, y1, z1, color) {
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) {
          const c = typeof color === 'function' ? color(x, y, z) : color;
          if (c != null) this.set(x, y, z, c);
        }
    return this;
  }

  // Layered string art: layers[y][z] is a string, one char per x. '.' = empty.
  layers(def, ox = 0, oy = 0, oz = 0) {
    def.layers.forEach((rows, y) =>
      rows.forEach((row, z) =>
        [...row].forEach((ch, x) => {
          if (ch !== '.' && ch !== ' ') this.set(ox + x, oy + y, oz + z, def.palette[ch]);
        }),
      ),
    );
    return this;
  }

  get size() {
    return this.map.size;
  }

  voxels() {
    return [...this.map.values()];
  }

  bounds() {
    const b = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
    for (const v of this.map.values()) {
      b.minX = Math.min(b.minX, v.x); b.maxX = Math.max(b.maxX, v.x);
      b.minY = Math.min(b.minY, v.y); b.maxY = Math.max(b.maxY, v.y);
      b.minZ = Math.min(b.minZ, v.z); b.maxZ = Math.max(b.maxZ, v.z);
    }
    return b;
  }
}
