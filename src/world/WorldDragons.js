// Dragons living in the world. Each one follows its own DragonBrain routine:
// wander on open ground, rear up and breathe, sit, then take off, fly around and land.
import { Dragon } from '../creatures/Dragon.js';
import { DragonBrain } from '../creatures/dragonBrain.js';
import { placeDragons, roomForDragon, MAX_DRAGONS } from '../creatures/dragonSpawns.js';
import { createRng } from '../rng.js';

const GROUND = 0.25;
const SPEED = { ember: 1.5, glimmer: 1.1, frost: 1.9 }; // walking, tiles per second
const FLY_SPEED = 5;
const TURN = 1.6; // radians per second
const CRUISE = [6, 10]; // flying height above the ground

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

class WorldDragon {
  constructor(spot, scene, world, open) {
    this.world = world;
    this.open = open; // (x, z) → true if a dragon can stand there
    this.rng = createRng(spot.seed);
    this.dragon = new Dragon(spot.kind);
    this.dragon.enableBreath(scene, GROUND);
    this.brain = new DragonBrain(this.rng.next);
    this.x = spot.x + 0.5;
    this.z = spot.z + 0.5;
    this.y = GROUND;
    this.heading = spot.heading;
    this.speed = SPEED[spot.kind];
    this.target = null;
    this.flight = null; // { phase: 'takeoff' | 'cruise' | 'landing', height }
    this.enter(this.brain.activity, true);
    this.place();
    scene.add(this.dragon.root);
  }

  // Start a new activity.
  enter(activity, first = false) {
    this.target = null;
    this.breathAt = null;
    if (activity === 'walk') this.dragon.setMode('walk');
    if (activity === 'sit') this.dragon.setMode('sit');
    if (activity === 'rear') {
      this.dragon.setMode('rear');
      this.breathAt = 0.9 + this.rng.next() * 0.6;
    }
    if (activity === 'fly') {
      this.dragon.setMode('fly');
      const height = CRUISE[0] + this.rng.next() * (CRUISE[1] - CRUISE[0]);
      // a dragon that starts the game mid-flight is already up in the air
      this.flight = { phase: first ? 'cruise' : 'takeoff', height };
      if (first) this.y = GROUND + height;
    }
  }

  // Pick somewhere to walk to: a straight line over open ground.
  pickWalkTarget() {
    for (let i = 0; i < 12; i++) {
      const a = this.heading + (this.rng.next() - 0.5) * Math.PI * 1.6;
      const d = 3 + this.rng.next() * 9;
      const tx = this.x + Math.sin(a) * d, tz = this.z + Math.cos(a) * d;
      if (this.clearLine(this.x, this.z, tx, tz)) return { x: tx, z: tz };
    }
    return null;
  }

  clearLine(x0, z0, x1, z1) {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.5);
    for (let i = 1; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
      if (!roomForDragon(this.open, Math.floor(x), Math.floor(z))) return false;
    }
    return true;
  }

  pickFlyTarget() {
    const m = 8;
    return {
      x: m + this.rng.next() * (this.world.width - 2 * m),
      z: m + this.rng.next() * (this.world.height - 2 * m),
    };
  }

  // Turn toward (tx, tz) and move forward; returns the distance left.
  steer(dt, tx, tz, speed, turnRate = TURN) {
    const want = Math.atan2(tx - this.x, tz - this.z);
    const diff = wrapAngle(want - this.heading);
    this.heading += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
    const dist = Math.hypot(tx - this.x, tz - this.z);
    // slow down for sharp turns so dragons don't skid sideways
    const go = speed * Math.max(0, Math.cos(diff)) * dt;
    this.x += Math.sin(this.heading) * Math.min(go, dist);
    this.z += Math.cos(this.heading) * Math.min(go, dist);
    return dist;
  }

  update(dt) {
    if (this.brain.update(dt)) this.enter(this.brain.activity);
    const act = this.brain.activity;
    const t = this.brain.elapsed;

    if (act === 'walk') {
      if (!this.target) this.target = this.pickWalkTarget();
      if (this.target) {
        const px = this.x, pz = this.z;
        const left = this.steer(dt, this.target.x, this.target.z, this.speed);
        // never cut a corner into a tree or wall while turning
        if (!roomForDragon(this.open, Math.floor(this.x), Math.floor(this.z))) {
          this.x = px;
          this.z = pz;
          this.target = null;
        } else if (left < 0.4) this.target = null;
        this.dragon.setMode('walk');
      }
    } else if (act === 'rear') {
      if (this.breathAt !== null && t >= this.breathAt) {
        this.dragon.breathe(1.8 + this.rng.next());
        this.breathAt = null;
      }
    } else if (act === 'fly') {
      this.updateFlight(dt);
    }

    // flying runs over its time until the dragon has landed somewhere open
    this.brain.hold = act === 'fly' && this.flight && this.flight.phase !== 'down';
    if (act !== 'fly' && this.flight) this.flight = null;
    this.place();
    this.dragon.update(dt);
  }

  updateFlight(dt) {
    const f = this.flight;
    if (!f) return;
    const ground = GROUND;
    if (f.phase === 'takeoff') {
      // climb while moving forward
      this.x += Math.sin(this.heading) * FLY_SPEED * 0.5 * dt;
      this.z += Math.cos(this.heading) * FLY_SPEED * 0.5 * dt;
      this.y = Math.min(ground + f.height, this.y + 2.2 * dt);
      if (this.y >= ground + f.height - 0.01) f.phase = 'cruise';
    } else if (f.phase === 'cruise') {
      if (!this.target) this.target = this.pickFlyTarget();
      const left = this.steer(dt, this.target.x, this.target.z, FLY_SPEED, 0.9);
      if (left < 2) this.target = null;
      this.y += (ground + f.height - this.y) * Math.min(1, dt);
      // occasionally a burst of breath in flight
      if (!this.dragon.breathing && this.rng.next() < dt * 0.06) this.dragon.breathe(1.2);
      if (this.brain.timeLeft <= 0) f.phase = 'landing';
    } else if (f.phase === 'landing') {
      // keep flying forward until over open ground, then come straight down
      const tx = Math.floor(this.x), tz = Math.floor(this.z);
      if (roomForDragon(this.open, tx, tz)) {
        this.y = Math.max(ground, this.y - 2.5 * dt);
        if (this.y <= ground + 0.001) {
          f.phase = 'down';
          this.dragon.setMode('walk'); // the hover lift eases off for a soft touch-down
        }
      } else {
        this.x += Math.sin(this.heading) * FLY_SPEED * 0.6 * dt;
        this.z += Math.cos(this.heading) * FLY_SPEED * 0.6 * dt;
        this.heading += 0.4 * dt; // gentle circle while looking for a spot
        this.x = Math.min(this.world.width - 6, Math.max(6, this.x));
        this.z = Math.min(this.world.height - 6, Math.max(6, this.z));
      }
    }
  }

  place() {
    this.dragon.root.position.set(this.x, this.y, this.z);
    this.dragon.root.rotation.y = this.heading;
  }

  dispose(scene) {
    scene.remove(this.dragon.root);
    this.dragon.dispose();
    this.dragon.root.traverse((o) => o.geometry?.dispose());
  }
}

export class WorldDragons {
  // open(x, z): can a dragon stand on this tile (no buildings, water, trees, chest…)
  constructor(scene, world, open) {
    this.scene = scene;
    this.world = world;
    this.open = open;
    this.spots = placeDragons(world, MAX_DRAGONS);
    this.list = [];
  }

  setCount(n) {
    n = Math.max(0, Math.min(this.spots.length, n));
    while (this.list.length > n) this.list.pop().dispose(this.scene);
    while (this.list.length < n) this.list.push(new WorldDragon(this.spots[this.list.length], this.scene, this.world, this.open));
  }

  update(dt) {
    for (const d of this.list) d.update(dt);
  }

  dispose() {
    this.setCount(0);
  }
}
