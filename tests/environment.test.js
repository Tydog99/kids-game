import { describe, it, expect } from 'vitest';
import { Environment, SPREAD_DELAY, BURN_TIME } from '../src/world/environment.js';
import { T } from '../src/tiles.js';

// A small test world: a row of trees along z = 10 from x = 5..24, and one 3x3 building.
function makeWorld() {
  const W = 40, H = 40;
  const tiles = new Uint8Array(W * H).fill(T.GRASS);
  for (let x = 0; x < W; x++) tiles[x] = tiles[(H - 1) * W + x] = T.TREE; // border wall
  for (let x = 5; x < 25; x++) tiles[10 * W + x] = T.TREE;
  for (let z = 20; z < 23; z++) for (let x = 5; x < 8; x++) tiles[z * W + x] = T.BUILDING;
  tiles[19 * W + 6] = T.TREE; // a tree touching the building
  return { width: W, height: H, tiles, treeKind: new Uint8Array(W * H), buildings: [{ x: 5, z: 20, w: 3, d: 3 }] };
}
const run = (env, s) => {
  const out = [];
  for (let t = 0; t < s - 1e-9; t += 0.1) out.push(...env.update(0.1));
  return out;
};

describe('Environment', () => {
  it('ignores the border wall and finds trees and buildings', () => {
    const env = new Environment(makeWorld());
    expect(env.at(0, 0)).toBeNull();
    expect(env.at(5, 10).type).toBe('tree');
    expect(env.at(6, 21).type).toBe('building');
    expect(env.at(6, 21)).toBe(env.at(7, 22)); // one object for the whole building
  });

  it('follows the breath rules', () => {
    const env = new Environment(makeWorld());
    const a = env.at(30, 30) ?? env.at(5, 10);
    expect(env.hit(a, 'ice').to).toBe('frozen');
    expect(env.hit(a, 'ice')).toBeNull();
    expect(env.hit(a, 'fire').to).toBe('burning'); // ice can catch fire
    expect(env.hit(a, 'ice').to).toBe('frozen'); // fire can be frozen
    expect(env.hit(a, 'diamonds').to).toBe('diamond');
    expect(env.hit(a, 'fire')).toBeNull(); // diamond can't burn…
    expect(env.hit(a, 'ice')).toBeNull(); // …or freeze
    expect(env.touch(a)).toBeNull(); // and doesn't shatter
  });

  it('frozen things shatter when touched and become open ground', () => {
    const gone = [];
    const w = makeWorld();
    const env = new Environment(w, (o, how) => gone.push(how));
    const t = env.at(8, 10);
    env.hit(t, 'ice');
    expect(env.touch(env.at(9, 10))).toBeNull(); // a normal tree doesn't shatter
    expect(env.touch(t).how).toBe('shattered');
    expect(env.at(8, 10)).toBeNull();
    expect(w.tiles[10 * w.width + 8]).toBe(T.GRASS);
    expect(gone).toEqual(['shattered']);
  });

  it('fire spreads along the row at a steady (linear) pace and burns things away', () => {
    const env = new Environment(makeWorld());
    env.hit(env.at(5, 10), 'fire');
    const reached = (s) => {
      run(env, s);
      return Math.max(...env.objects.filter((o) => o.type === 'tree' && o.z === 10 && o.state !== 'normal').map((o) => o.x));
    };
    const a = reached(SPREAD_DELAY * 4 + 0.05);
    const b = reached(SPREAD_DELAY * 4);
    expect(a).toBe(5 + 4);
    expect(b - a).toBe(4); // same distance in the same time: linear, not exponential
    run(env, BURN_TIME.tree);
    expect(env.at(5, 10)).toBeNull(); // the first trees have burnt away
  });

  it('ice and diamonds are firebreaks for spreading fire', () => {
    const env = new Environment(makeWorld());
    env.hit(env.at(10, 10), 'ice');
    env.hit(env.at(14, 10), 'diamonds');
    env.hit(env.at(12, 10), 'fire');
    run(env, 30);
    expect(env.at(10, 10).state).toBe('frozen');
    expect(env.at(14, 10).state).toBe('diamond');
    expect(env.at(9, 10).state).toBe('normal'); // fire never got past the ice…
    expect(env.at(15, 10).state).toBe('normal'); // …or the diamond
    expect(env.at(12, 10)).toBeNull();
  });

  it('fire spreads from trees to a touching building, which burns longer', () => {
    const env = new Environment(makeWorld());
    const b = env.at(6, 21);
    env.hit(env.at(6, 19), 'fire');
    run(env, SPREAD_DELAY + 0.2);
    expect(b.state).toBe('burning');
    run(env, BURN_TIME.tree);
    expect(b.state).toBe('burning');
    run(env, BURN_TIME.building);
    expect(b.state).toBe('gone');
  });
});

describe('frozen lakes', () => {
  const lake = () => {
    const w = makeWorld();
    for (let z = 30; z < 34; z++) for (let x = 10; x < 20; x++) w.tiles[z * w.width + x] = T.WATER;
    return w;
  };

  it('ice freezes one water tile into walkable ice; fire melts it back', () => {
    const w = lake();
    const env = new Environment(w);
    expect(env.hitGround(12, 31, 'fire')).toBeNull(); // fire does nothing to water
    expect(env.hitGround(12, 31, 'ice')).toMatchObject({ to: 'ice' });
    expect(w.tiles[31 * w.width + 12]).toBe(T.ICE);
    expect(w.tiles[31 * w.width + 13]).toBe(T.WATER); // ice doesn't spread
    run(env, 30);
    expect(w.tiles[31 * w.width + 13]).toBe(T.WATER);
    expect(env.hitGround(12, 31, 'ice')).toBeNull(); // already ice
    expect(env.hitGround(12, 31, 'fire')).toMatchObject({ to: 'water' });
    expect(w.tiles[31 * w.width + 12]).toBe(T.WATER);
    expect(env.hitGround(5, 5, 'ice')).toBeNull(); // grass isn't affected
  });
});
