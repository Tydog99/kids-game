import { describe, it, expect } from 'vitest';
import { VoxelGrid } from '../src/voxel/VoxelGrid.js';
import { buildGeometry, buildGreedyGeometry } from '../src/voxel/builder.js';

// total area of triangles, grouped by normal direction
function areaByNormal(geo) {
  const pos = geo.attributes.position.array, nor = geo.attributes.normal.array, idx = geo.index.array;
  const out = {};
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]].map((i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
    const e1 = b.map((v, i) => v - a[i]), e2 = c.map((v, i) => v - a[i]);
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const n = [nor[idx[t] * 3], nor[idx[t] * 3 + 1], nor[idx[t] * 3 + 2]];
    // winding must agree with the normal (faces point outward)
    expect(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2]).toBeGreaterThan(0);
    const key = n.join(',');
    out[key] = (out[key] ?? 0) + Math.hypot(...cr) / 2;
  }
  return out;
}

describe('buildGreedyGeometry', () => {
  const model = () => {
    const g = new VoxelGrid();
    g.box(0, 0, 0, 9, 5, 7, (x, y) => (y === 3 ? 0xff0000 : 0xffffff)); // striped block
    g.box(3, 6, 2, 5, 8, 4, 0x00ff00); // something on top
    g.remove(0, 0, 0);
    return g;
  };

  it('covers exactly the same surface as the per-voxel mesh, facing the same way', () => {
    const plain = areaByNormal(buildGeometry(model(), { size: 0.5, jitter: 0 }));
    const greedy = areaByNormal(buildGreedyGeometry(model(), { size: 0.5 }));
    expect(Object.keys(greedy).sort()).toEqual(Object.keys(plain).sort());
    for (const k in plain) expect(greedy[k]).toBeCloseTo(plain[k], 6);
  });

  it('uses far fewer triangles', () => {
    const plain = buildGeometry(model(), { jitter: 0 }).index.count / 3;
    const greedy = buildGreedyGeometry(model()).index.count / 3;
    expect(greedy).toBeLessThan(plain / 5);
  });
});
