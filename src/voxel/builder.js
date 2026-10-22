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
