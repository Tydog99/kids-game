import { describe, it, expect } from 'vitest';
import { VoxelGrid, parseColor } from '../src/voxel/VoxelGrid.js';

describe('VoxelGrid', () => {
  it('parses colors', () => {
    expect(parseColor('#ff0000')).toBe(0xff0000);
    expect(parseColor(0x00ff00)).toBe(0x00ff00);
  });
  it('fills inclusive boxes', () => {
    const g = new VoxelGrid().box(0, 0, 0, 1, 2, 3, '#ffffff');
    expect(g.size).toBe(2 * 3 * 4);
    expect(g.get(1, 2, 3).color).toBe(0xffffff);
  });
  it('box color fn can skip voxels', () => {
    const g = new VoxelGrid().box(0, 0, 0, 3, 0, 0, (x) => (x % 2 ? null : 1));
    expect(g.size).toBe(2);
  });
  it('parses layered art, skipping dots', () => {
    const g = new VoxelGrid().layers({ palette: { a: '#010203' }, layers: [['a.a', '.a.'], ['aaa']] });
    expect(g.size).toBe(6);
    expect(g.has(1, 0, 0)).toBe(false);
    expect(g.get(1, 0, 1).color).toBe(0x010203);
    expect(g.has(2, 1, 0)).toBe(true);
  });
  it('computes bounds', () => {
    const g = new VoxelGrid().set(-1, 2, 3, 0).set(4, 0, -2, 0);
    expect(g.bounds()).toEqual({ minX: -1, minY: 0, minZ: -2, maxX: 4, maxY: 2, maxZ: 3 });
  });
});
