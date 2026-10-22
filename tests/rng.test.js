import { describe, it, expect } from 'vitest';
import { createRng, hashSeed } from '../src/rng.js';

describe('rng', () => {
  it('same seed gives same sequence', () => {
    const a = createRng('pallet'), b = createRng('pallet');
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('different seeds differ', () => {
    const a = createRng('pallet'), b = createRng('viridian');
    const sa = Array.from({ length: 10 }, a.next), sb = Array.from({ length: 10 }, b.next);
    expect(sa).not.toEqual(sb);
  });
  it('int stays in bounds and pick returns members', () => {
    const r = createRng(42);
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 1000; i++) {
      const n = r.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
      expect(arr).toContain(r.pick(arr));
    }
  });
  it('hashSeed is stable', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'));
  });
});
