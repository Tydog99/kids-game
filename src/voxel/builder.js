// VoxelGrid → three.js geometry. Faces hidden by a neighbouring voxel are culled
// and each voxel gets a tiny brightness jitter for a hand-built look.
import * as THREE from 'three';

const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.86 },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.86 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.6 },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], shade: 0.93 },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.93 },
];

function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * @param {import('./VoxelGrid.js').VoxelGrid} grid
 * @param {object} opts
 * @param {number} opts.size  world size of one voxel
 * @param {number[]} [opts.origin] voxel coordinate that maps to (0,0,0)
 * @param {number} [opts.jitter] max brightness jitter (0..1)
 * @param {(v, face) => boolean} [opts.skipFace] extra face culling
 */
export function buildGeometry(grid, { size = 1, origin = [0, 0, 0], jitter = 0.06, skipFace } = {}) {
  const pos = [], nor = [], col = [], index = [];
  const color = new THREE.Color();
  let vi = 0;
  for (const v of grid.map.values()) {
    const j = 1 + (hash3(v.x, v.y, v.z) * 2 - 1) * jitter;
    for (const f of FACES) {
      if (grid.has(v.x + f.n[0], v.y + f.n[1], v.z + f.n[2])) continue;
      if (skipFace && skipFace(v, f.n)) continue;
      color.setHex(v.color);
      const k = j * f.shade;
      for (const c of f.c) {
        pos.push((v.x - origin[0] + c[0]) * size, (v.y - origin[1] + c[1]) * size, (v.z - origin[2] + c[2]) * size);
        nor.push(...f.n);
        col.push(color.r * k, color.g * k, color.b * k);
      }
      index.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      vi += 4;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(vi > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1));
  geo.computeBoundingSphere();
  return geo;
}

export const voxelMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

export function buildMesh(grid, opts) {
  const mesh = new THREE.Mesh(buildGeometry(grid, opts), opts?.material ?? voxelMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Greedy meshing: merges touching faces of the same color that face the same way into
// one big rectangle. Far fewer triangles for big flat models like buildings. Colors are
// used as-is (no per-voxel jitter), so give large surfaces texture with patterns instead.
export function buildGreedyGeometry(grid, { size = 1, origin = [0, 0, 0] } = {}) {
  const b = grid.bounds();
  const lo = [b.minX, b.minY, b.minZ];
  const dims = [b.maxX - b.minX + 1, b.maxY - b.minY + 1, b.maxZ - b.minZ + 1];
  // dense color volume, 0 = empty, otherwise color + 1
  const vol = new Uint32Array(dims[0] * dims[1] * dims[2]);
  const at = (x, y, z) =>
    x < 0 || y < 0 || z < 0 || x >= dims[0] || y >= dims[1] || z >= dims[2] ? 0 : vol[x + dims[0] * (y + dims[1] * z)];
  for (const v of grid.map.values()) vol[v.x - lo[0] + dims[0] * (v.y - lo[1] + dims[1] * (v.z - lo[2]))] = v.color + 1;

  const pos = [], nor = [], col = [], index = [];
  const color = new THREE.Color();
  let vi = 0;
  for (const f of FACES) {
    const d = f.n.findIndex((c) => c !== 0); // axis the face points along
    const s = f.n[d];
    const u = (d + 1) % 3, v = (d + 2) % 3;
    const mask = new Int32Array(dims[u] * dims[v]);
    const p = [0, 0, 0];
    for (p[d] = 0; p[d] < dims[d]; p[d]++) {
      // which voxels in this slice have an exposed face in direction n
      let k = 0;
      for (p[v] = 0; p[v] < dims[v]; p[v]++)
        for (p[u] = 0; p[u] < dims[u]; p[u]++, k++) {
          const c = at(p[0], p[1], p[2]);
          const q = [p[0], p[1], p[2]];
          q[d] += s;
          mask[k] = c && !at(q[0], q[1], q[2]) ? c : 0;
        }
      // grow rectangles
      for (let j = 0; j < dims[v]; j++)
        for (let i = 0; i < dims[u]; ) {
          const c = mask[i + j * dims[u]];
          if (!c) { i++; continue; }
          let w = 1;
          while (i + w < dims[u] && mask[i + w + j * dims[u]] === c) w++;
          let h = 1;
          grow: for (; j + h < dims[v]; h++)
            for (let x = 0; x < w; x++) if (mask[i + x + (j + h) * dims[u]] !== c) break grow;
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[i + x + (j + y) * dims[u]] = 0;

          // emit quad on the face plane
          const plane = p[d] + (s > 0 ? 1 : 0);
          const corner = (cu, cv) => {
            const r = [0, 0, 0];
            r[d] = plane; r[u] = cu; r[v] = cv;
            return [(r[0] + lo[0] - origin[0]) * size, (r[1] + lo[1] - origin[1]) * size, (r[2] + lo[2] - origin[2]) * size];
          };
          let quad = [corner(i, j), corner(i + w, j), corner(i + w, j + h), corner(i, j + h)];
          // keep counter-clockwise winding as seen from outside
          const e1 = quad[1].map((a, n) => a - quad[0][n]), e2 = quad[2].map((a, n) => a - quad[0][n]);
          const cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
          if (cross[0] * f.n[0] + cross[1] * f.n[1] + cross[2] * f.n[2] < 0) quad = quad.reverse();
          color.setHex(c - 1).multiplyScalar(f.shade);
          for (const q of quad) {
            pos.push(...q);
            nor.push(...f.n);
            col.push(color.r, color.g, color.b);
          }
          index.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
          vi += 4;
          i += w;
        }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(vi > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1));
  geo.computeBoundingSphere();
  return geo;
}
