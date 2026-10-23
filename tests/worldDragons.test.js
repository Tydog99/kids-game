import { describe, it, expect } from 'vitest';
import { generateWorld, isWalkable } from '../src/worldgen.js';
import { WorldDragons } from '../src/world/WorldDragons.js';
import { roomForDragon } from '../src/creatures/dragonSpawns.js';
import * as THREE from 'three';

const world = generateWorld('pallet');
const open = (x, z) => isWalkable(world, x, z);
const make = (n) => {
  const ds = new WorldDragons(new THREE.Scene(), world, open);
  ds.setCount(n);
  return ds;
};

describe('world dragons and the player', () => {
  it('never walk into the player, who stands still in their way', () => {
    const ds = make(6);
    let closest = Infinity;
    // stand the player right in front of each dragon in turn
    for (const d of ds.list) {
      const player = { x: d.x + Math.sin(d.heading) * 4, z: d.z + Math.cos(d.heading) * 4, speed: 0 };
      for (let i = 0; i < 60 * 30; i++) {
        ds.update(1 / 60, player);
        for (const o of ds.list) if (o.y < 0.3) closest = Math.min(closest, o.distanceTo(player.x, player.z));
      }
    }
    expect(closest).toBeGreaterThan(0.25);
  });

  it('a grounded dragon stops and looks at a player who comes close', () => {
    const ds = make(1);
    const d = ds.list[0];
    d.y = 0.25; d.flight = null; d.brain.index = 0; // walking
    const player = { x: d.x + 5, z: d.z, speed: 0 };
    for (let i = 0; i < 60 * 3; i++) ds.update(1 / 60, player);
    expect(d.curious).toBe(true);
    const x = d.x, z = d.z;
    for (let i = 0; i < 60 * 3; i++) ds.update(1 / 60, player);
    expect([d.x, d.z]).toEqual([x, z]);
    const toPlayer = Math.atan2(player.x - d.x, player.z - d.z);
    expect(Math.abs(Math.atan2(Math.sin(toPlayer - d.heading), Math.cos(toPlayer - d.heading)))).toBeLessThan(0.2);
  });

  it('a called dragon lands beside the player within 10 seconds, from anywhere', () => {
    const ds = make(12);
    const player = { x: world.spawn.x + 0.5, z: world.spawn.z + 2.5, speed: 0 };
    for (const d of ds.list) {
      d.callTo(player);
      let t = 0;
      while (d.summon && t < 10) {
        d.update(1 / 60, player);
        t += 1 / 60;
      }
      expect(d.summon).toBeNull();
      expect(t).toBeLessThan(10);
      expect(d.y).toBeCloseTo(0.25);
      expect(roomForDragon(open, Math.floor(d.x), Math.floor(d.z))).toBe(true);
      const gap = d.distanceTo(player.x, player.z);
      expect(gap).toBeGreaterThan(0.5);
      expect(gap).toBeLessThan(12);
    }
  });

  it('trusted dragons stay even when the slider goes to zero', () => {
    const ds = make(5);
    ds.setNames({ 3: 'Sparky' });
    ds.setCount(0);
    expect(ds.list.map((d) => [d.index, d.name])).toEqual([[3, 'Sparky']]);
  });

  it('turning to look at the player never swings the body into them', () => {
    const ds = make(1);
    const d = ds.list[0];
    d.y = 0.25; d.flight = null; d.waiting = 30;
    // player just beside its shoulder
    const side = d.heading + Math.PI / 2;
    const player = { x: d.x + Math.sin(side) * (d.bodyR + 1.2), z: d.z + Math.cos(side) * (d.bodyR + 1.2), speed: 0 };
    let closest = Infinity;
    for (let i = 0; i < 60 * 5; i++) {
      ds.update(1 / 60, player);
      closest = Math.min(closest, d.distanceTo(player.x, player.z));
    }
    expect(closest).toBeGreaterThan(0.5);
  });
});
