// What dragon breath does to trees and buildings. Pure (no three.js) so the rules can be tested.
//
//              fire        ice         diamonds    touched
//   normal  →  burning     frozen      diamond     –
//   burning →  –           frozen      diamond     –
//   frozen  →  burning     –           diamond     shatters (gone)
//   diamond →  –           –           –           –
//
// Lakes: ice breath freezes water one tile at a time into ice you can walk on (it doesn't spread),
// and fire melts it back into water.
//
// Burning things light their direct neighbours once after SPREAD_DELAY (so a fire front moves at a
// steady pace, one tile per SPREAD_DELAY), then burn away. Spreading fire only catches normal
// things: ice and diamond act as firebreaks. The tree wall around the map edge is never affected.
import { T } from '../tiles.js';

export const SPREAD_DELAY = 2.5; // seconds a thing burns before lighting its neighbours
export const BURN_TIME = { tree: 7, building: 14 }; // seconds until burnt away
const BORDER = 2;

export class Environment {
  // onGone(obj, how): called when something burns away ('burnt') or shatters ('shattered'),
  // after its tiles have been turned into open ground.
  constructor(world, onGone = () => {}) {
    this.world = world;
    this.onGone = onGone;
    this.objects = [];
    this.byTile = new Map();
    const W = world.width;
    for (let z = BORDER; z < world.height - BORDER; z++)
      for (let x = BORDER; x < W - BORDER; x++)
        if (world.tiles[z * W + x] === T.TREE) this.add({ type: 'tree', x, z, w: 1, d: 1 });
    world.buildings.forEach((b, i) => this.add({ type: 'building', building: i, x: b.x, z: b.z, w: b.w, d: b.d }));
    this.burning = new Set();
  }

  add(o) {
    const obj = { ...o, id: this.objects.length, state: 'normal', time: 0, spread: false, tiles: [] };
    for (let z = o.z; z < o.z + o.d; z++)
      for (let x = o.x; x < o.x + o.w; x++) {
        const i = z * this.world.width + x;
        obj.tiles.push(i);
        this.byTile.set(i, obj);
      }
    this.objects.push(obj);
  }

  at(x, z) {
    if (x < 0 || z < 0 || x >= this.world.width || z >= this.world.height) return null;
    return this.byTile.get(z * this.world.width + x) ?? null;
  }

  // Everything sharing an edge or corner with obj.
  neighbours(obj) {
    const out = new Set();
    for (let z = obj.z - 1; z <= obj.z + obj.d; z++)
      for (let x = obj.x - 1; x <= obj.x + obj.w; x++) {
        const n = this.at(x, z);
        if (n && n !== obj) out.add(n);
      }
    return out;
  }

  set(obj, state) {
    const from = obj.state;
    if (from === state) return null;
    obj.state = state;
    obj.time = 0;
    obj.spread = false;
    if (state === 'burning') this.burning.add(obj);
    else this.burning.delete(obj);
    return { obj, from, to: state };
  }

  // Dragon breath hit an object. kind: 'fire' | 'ice' | 'diamonds'. Returns the change, or null.
  hit(obj, kind) {
    if (!obj || obj.state === 'gone' || obj.state === 'diamond') return null;
    if (kind === 'fire') return obj.state === 'burning' ? null : this.set(obj, 'burning');
    if (kind === 'ice') return obj.state === 'frozen' ? null : this.set(obj, 'frozen');
    if (kind === 'diamonds') return this.set(obj, 'diamond');
    return null;
  }

  // Breath reached the ground at (x, z): freeze water, or melt lake ice.
  // Returns { tile, x, z, to: 'ice' | 'water' } or null.
  hitGround(x, z, kind) {
    if (x < 0 || z < 0 || x >= this.world.width || z >= this.world.height) return null;
    const i = z * this.world.width + x;
    const t = this.world.tiles[i];
    if (kind === 'ice' && t === T.WATER) {
      this.world.tiles[i] = T.ICE;
      return { tile: i, x, z, to: 'ice' };
    }
    if (kind === 'fire' && t === T.ICE) {
      this.world.tiles[i] = T.WATER;
      return { tile: i, x, z, to: 'water' };
    }
    return null;
  }

  // Something bumped into an object: ice shatters.
  touch(obj) {
    if (!obj || obj.state !== 'frozen') return null;
    return this.remove(obj, 'shattered');
  }

  remove(obj, how) {
    const change = this.set(obj, 'gone');
    for (const i of obj.tiles) {
      this.byTile.delete(i);
      this.world.tiles[i] = obj.type === 'tree' ? T.GRASS : T.DIRT;
      if (this.world.treeKind) this.world.treeKind[i] = 0;
    }
    this.onGone(obj, how);
    return { ...change, how };
  }

  // Returns the changes that happened (things catching fire from neighbours, burning away).
  update(dt) {
    const changes = [];
    for (const obj of [...this.burning]) {
      obj.time += dt;
      if (!obj.spread && obj.time >= SPREAD_DELAY) {
        obj.spread = true;
        for (const n of this.neighbours(obj)) if (n.state === 'normal') changes.push(this.set(n, 'burning'));
      }
      if (obj.time >= BURN_TIME[obj.type]) changes.push(this.remove(obj, 'burnt'));
    }
    return changes;
  }
}
