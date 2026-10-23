// Dragons living in the world. Each one follows its own DragonBrain routine:
// wander on open ground, rear up and breathe, sit, then take off, fly around and land.
// They never walk or land into the player, get curious when the player comes close, can come to
// trust the player, fly over when called, and can be ridden.
import { Dragon } from '../creatures/Dragon.js';
import { DragonBrain } from '../creatures/dragonBrain.js';
import { placeDragons, roomForDragon, MAX_DRAGONS } from '../creatures/dragonSpawns.js';
import { DRAGON_VOXEL as V } from '../creatures/dragonModels.js';
import { RideMotor, GROUND_Y as GROUND } from '../creatures/rideMotor.js';
import { createRng } from '../rng.js';

// World dragons are bigger than the designs so a rider fits on their backs.
export const DRAGON_SCALE = { ember: 1.5, glimmer: 1.9, frost: 1.4 };
const SPEED = { ember: 2.1, glimmer: 1.8, frost: 2.5 }; // walking, tiles per second
const FLY_SPEED = 6;
const TURN = 1.6; // radians per second
const CRUISE = [6, 10]; // flying height above the ground
const CURIOUS = 4.5; // tiles from its body: a dragon stops to look at a player this close
const BORED = 6.5; // …and goes back to what it was doing once they're this far away
const WAIT_FOR_RIDER = 60; // seconds a called dragon waits by the player
export const SUMMON_HEIGHT = 5;

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class WorldDragon {
  constructor(index, spot, scene, world, open) {
    this.index = index;
    this.kind = spot.kind;
    this.world = world;
    this.open = open; // (x, z) → true if a dragon can stand there
    this.rng = createRng(spot.seed);
    this.dragon = new Dragon(spot.kind);
    this.scale = DRAGON_SCALE[spot.kind];
    this.dragon.root.scale.setScalar(this.scale);
    this.dragon.manualAltitude = true;
    this.dragon.enableBreath(scene, GROUND);
    this.brain = new DragonBrain(this.rng.next);
    this.x = spot.x + 0.5;
    this.z = spot.z + 0.5;
    this.y = GROUND;
    this.heading = spot.heading;
    this.speed = SPEED[spot.kind];
    this.target = null;
    this.flight = null; // { phase: 'takeoff' | 'cruise' | 'landing' | 'down', height }
    this.trust = 0; // 0..1, see creatures/trust.js
    this.name = null; // set once it trusts the player
    this.curious = false;
    this.summon = null; // flying over to the player: { phase, spot, timer }
    this.waiting = 0; // seconds left waiting by the player after being called
    this.motor = null; // RideMotor while ridden
    this.skyOnly = false; // adventure chapter 1: stays up in the sky, never lands
    this.restSpot = null; // adventure: where it lands and waits for the player
    this.hidden = false; // adventure: not seen yet (until its key is found)
    this.script = null; // (dt) => moves the dragon itself, for a cutscene
    const { center, radii } = this.dragon.spec.torso;
    this.bodyOffset = center[2] * V * this.scale; // body center, ahead of the hips
    this.bodyHalf = radii[2] * V * this.scale * 0.55;
    this.bodyR = radii[0] * V * this.scale * 1.05;
    this.enter(this.brain.activity, true);
    this.place();
    scene.add(this.dragon.root);
  }

  get trusted() {
    return this.name !== null;
  }

  get grounded() {
    return this.y <= GROUND + 0.01;
  }

  get ridden() {
    return this.motor !== null;
  }

  // Two circles covering the body, front and back, for collisions with the player.
  circles(x = this.x, z = this.z, heading = this.heading) {
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const cx = x + fx * this.bodyOffset, cz = z + fz * this.bodyOffset;
    return [
      { x: cx + fx * this.bodyHalf, z: cz + fz * this.bodyHalf, r: this.bodyR },
      { x: cx - fx * this.bodyHalf, z: cz - fz * this.bodyHalf, r: this.bodyR },
    ];
  }

  // Distance from (px, pz) to the edge of the dragon's body.
  distanceTo(px, pz, x = this.x, z = this.z, heading = this.heading) {
    return Math.min(...this.circles(x, z, heading).map((c) => Math.hypot(px - c.x, pz - c.z) - c.r));
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
      // sky-only dragons (adventure chapter 1) fly lower, where the camera can see them
      const [lo, hi] = this.skyOnly ? [3.5, 5] : CRUISE;
      const height = lo + this.rng.next() * (hi - lo);
      // a dragon that starts the game mid-flight is already up in the air
      this.flight = { phase: first ? 'cruise' : 'takeoff', height };
      if (first) this.y = GROUND + height;
    }
  }

  // Pick somewhere to walk to: a straight line over open ground that keeps clear of the player.
  pickWalkTarget(player) {
    for (let i = 0; i < 12; i++) {
      const a = this.heading + (this.rng.next() - 0.5) * Math.PI * 1.6;
      const d = 3 + this.rng.next() * 9;
      const tx = this.x + Math.sin(a) * d, tz = this.z + Math.cos(a) * d;
      if (this.clearLine(this.x, this.z, tx, tz, player)) return { x: tx, z: tz };
    }
    return null;
  }

  clearLine(x0, z0, x1, z1, player) {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.5);
    const h = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 1; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
      if (!roomForDragon(this.open, Math.floor(x), Math.floor(z))) return false;
      if (player && this.distanceTo(player.x, player.z, x, z, h) < 1.2) return false;
    }
    return true;
  }

  pickFlyTarget(player) {
    // sky-only dragons often swoop over the player, so they get noticed
    if (this.skyOnly && player && this.rng.next() < 0.85) {
      const a = this.rng.next() * Math.PI * 2, r = 6 + this.rng.next() * 12;
      return { x: player.x + Math.sin(a) * r, z: player.z + Math.cos(a) * r };
    }
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

  // Turn on the spot toward (tx, tz) — usually the player — without swinging the body into them.
  face(dt, tx, tz, rate = 2.5) {
    const diff = wrapAngle(Math.atan2(tx - this.x, tz - this.z) - this.heading);
    const next = this.heading + Math.max(-rate * dt, Math.min(rate * dt, diff));
    const gap = this.distanceTo(tx, tz, this.x, this.z, next);
    if (gap > 0.8 || gap >= this.distanceTo(tx, tz)) this.heading = next;
  }

  // player: { x, z, speed } (null while the player is riding this dragon)
  update(dt, player) {
    this.dragon.root.visible = !this.hidden;
    if (this.hidden) return;
    if (this.motor) return this.finish(dt);
    if (this.script) {
      this.script(dt);
      return this.finish(dt);
    }
    if (this.skyOnly && !this.flight) {
      // take off (or, at the very start, already be up there) and stay in the air
      this.brain.index = 3; // 'fly'
      this.enter('fly', this.y > GROUND + 1);
    }
    if (this.summon) {
      this.updateSummon(dt, player);
      return this.finish(dt);
    }
    if (this.waiting > 0) {
      this.waiting -= dt;
      this.dragon.setMode('sit');
      this.dragon.stride = 0;
      if (player) this.face(dt, player.x, player.z);
      this.brain.hold = true;
      if (this.waiting <= 0) {
        this.brain.hold = false;
        this.enter(this.brain.activity);
      }
      return this.finish(dt);
    }

    // a grounded dragon stops to look at a player who comes close
    const near = player ? this.distanceTo(player.x, player.z) : Infinity;
    if (this.grounded && !this.flight?.phase?.match(/takeoff|cruise|landing/)) {
      if (!this.curious && near < CURIOUS) {
        this.curious = true;
        this.target = null;
        this.breathAt = null;
      } else if (this.curious && near > BORED) {
        this.curious = false;
        this.enter(this.brain.activity);
      }
    } else this.curious = false;
    if (this.curious) {
      this.brain.hold = true;
      this.dragon.setMode('sit');
      this.dragon.stride = 0;
      this.face(dt, player.x, player.z);
      return this.finish(dt);
    }

    if (this.brain.update(dt)) this.enter(this.brain.activity);
    const act = this.brain.activity;
    const t = this.brain.elapsed;
    this.dragon.stride = 0;

    if (act === 'walk') {
      this.dragon.setMode('walk');
      if (!this.target) this.target = this.pickWalkTarget(player);
      if (this.target) {
        const px = this.x, pz = this.z, ph = this.heading;
        const left = this.steer(dt, this.target.x, this.target.z, this.speed);
        // never cut a corner into a tree or wall, or walk into the player
        const blocked =
          !roomForDragon(this.open, Math.floor(this.x), Math.floor(this.z)) ||
          (player && this.distanceTo(player.x, player.z) < 1.2 && this.distanceTo(player.x, player.z) < this.distanceTo(player.x, player.z, px, pz, ph));
        if (blocked) {
          this.x = px;
          this.z = pz;
          this.target = null;
        } else {
          this.dragon.stride = 1;
          if (left < 0.4) this.target = null;
        }
      }
    } else if (act === 'rear') {
      // don't breathe when the player is out in front
      if (this.breathAt !== null && t >= this.breathAt && !this.playerInFront(player, 10)) {
        this.dragon.breathe(1.8 + this.rng.next());
        this.breathAt = null;
      }
    } else if (act === 'fly') {
      this.updateFlight(dt, player);
    }

    // flying runs over its time until the dragon has landed somewhere open
    this.brain.hold = act === 'fly' && this.flight && this.flight.phase !== 'down';
    if (act !== 'fly' && this.flight) this.flight = null;
    return this.finish(dt);
  }

  playerInFront(player, range) {
    if (!player) return false;
    const dx = player.x - this.x, dz = player.z - this.z, d = Math.hypot(dx, dz);
    return d < range && (dx * Math.sin(this.heading) + dz * Math.cos(this.heading)) / (d || 1) > 0.5;
  }

  finish(dt) {
    this.place();
    this.dragon.update(dt);
  }

  // Somewhere open to land, near (x, z) and not on the player.
  landingSpot(player, x = this.x, z = this.z) {
    if (roomForDragon(this.open, Math.floor(x), Math.floor(z)) && (!player || this.distanceTo(player.x, player.z, x, z) > 1.5)) return { x, z };
    return null;
  }

  updateFlight(dt, player) {
    const f = this.flight;
    if (!f) return;
    if (f.phase === 'takeoff') {
      // climb while moving forward
      this.x += Math.sin(this.heading) * FLY_SPEED * 0.5 * dt;
      this.z += Math.cos(this.heading) * FLY_SPEED * 0.5 * dt;
      this.y = Math.min(GROUND + f.height, this.y + 2.2 * dt);
      if (this.y >= GROUND + f.height - 0.01) f.phase = 'cruise';
    } else if (f.phase === 'cruise') {
      if (!this.target) this.target = this.pickFlyTarget(player);
      const left = this.steer(dt, this.target.x, this.target.z, FLY_SPEED, 0.9);
      if (left < 2) this.target = null;
      this.y += (GROUND + f.height - this.y) * Math.min(1, dt);
      // occasionally a burst of breath in flight (not toward the player)
      if (!this.dragon.breathing && this.rng.next() < dt * 0.06 && !this.playerInFront(player, 12)) this.dragon.breathe(1.2);
      if (this.brain.timeLeft <= 0 && !this.skyOnly) f.phase = 'landing';
    } else if (f.phase === 'landing') {
      // keep flying forward until over open ground away from the player, then come straight down
      if (this.landingSpot(player)) {
        this.y = Math.max(GROUND, this.y - 2.5 * dt);
        if (this.y <= GROUND + 0.001) f.phase = 'down';
      } else {
        this.x += Math.sin(this.heading) * FLY_SPEED * 0.6 * dt;
        this.z += Math.cos(this.heading) * FLY_SPEED * 0.6 * dt;
        this.heading += 0.4 * dt; // gentle circle while looking for a spot
        this.x = Math.min(this.world.width - 6, Math.max(6, this.x));
        this.z = Math.min(this.world.height - 6, Math.max(6, this.z));
      }
    }
  }

  // ---- called by the player ----

  // Fly over and land next to the player (within 10 seconds from anywhere on the map).
  // Fly to a fixed spot, land, and stay there (adventure: the dragons coming down to rest).
  flyTo(spot) {
    this.skyOnly = false;
    this.restSpot = spot;
    this.summon = { phase: this.grounded ? 'takeoff' : 'cruise', spot, timer: 0, fixed: true };
    this.curious = false;
    this.brain.hold = true;
    this.flight = null;
    this.target = null;
    this.dragon.setMode('fly');
  }

  callTo(player) {
    if (this.motor) return;
    this.summon = { phase: this.grounded ? 'takeoff' : 'cruise', spot: null, timer: 0 };
    this.curious = false;
    this.waiting = 0;
    this.brain.hold = true;
    this.flight = null;
    this.target = null;
    this.dragon.setMode('fly');
    this.dragon.stride = 0;
    this.pickSummonSpot(player);
  }

  // An open spot near the player, in front of them (where they're looking, away from the camera
  // behind them) when the player's facing is known, otherwise on the side the dragon comes from.
  pickSummonSpot(player) {
    const from = player.heading ?? Math.atan2(this.x - player.x, this.z - player.z);
    let best = null;
    for (const r of [3, 4, 5, 6.5, 8, 10]) {
      for (let i = 0; i < 16; i++) {
        const a = from + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 8);
        const x = player.x + Math.sin(a) * (r + this.bodyR), z = player.z + Math.cos(a) * (r + this.bodyR);
        // land facing the player
        const h = Math.atan2(player.x - x, player.z - z);
        if (roomForDragon(this.open, Math.floor(x), Math.floor(z)) && this.distanceTo(player.x, player.z, x, z, h) > 1.6) {
          best = { x, z };
          break;
        }
      }
      if (best) break;
    }
    if (best) this.summon.spot = best;
  }

  updateSummon(dt, player) {
    const s = this.summon;
    s.timer += dt;
    this.dragon.setMode('fly');
    if (!s.fixed && player && (s.timer % 0.5 < dt || !s.spot)) this.pickSummonSpot(player); // the player may be moving
    const spot = s.spot ?? { x: this.x, z: this.z };
    const dist = Math.hypot(spot.x - this.x, spot.z - this.z);
    if (s.phase === 'takeoff' || s.phase === 'cruise') {
      // go to a safe height, speeding straight over: fast enough to arrive in a few seconds
      const H = GROUND + SUMMON_HEIGHT;
      this.y += Math.sign(H - this.y) * Math.min(Math.abs(H - this.y), 5 * dt);
      const clear = Math.min(1, (this.y - GROUND) / 2.5); // up off the ground before speeding off
      const speed = (s.fixed ? Math.min(9, Math.max(5, dist / 3)) : Math.min(45, Math.max(8, dist / 3.5))) * clear;
      this.steer(dt, spot.x, spot.z, speed, 4);
      if (dist < 1) s.phase = 'landing';
    } else if (s.phase === 'landing') {
      this.x += (spot.x - this.x) * Math.min(1, dt * 4);
      this.z += (spot.z - this.z) * Math.min(1, dt * 4);
      if (player) this.face(dt, player.x, player.z, 3);
      this.y = Math.max(GROUND, this.y - 5 * dt);
      if (this.y <= GROUND + 0.001) {
        this.summon = null;
        this.waiting = s.fixed ? Infinity : WAIT_FOR_RIDER; // resting dragons stay put
        this.dragon.setMode('sit');
      }
    }
  }

  // ---- riding ----

  mount(tile) {
    this.summon = null;
    this.waiting = 0;
    this.curious = false;
    this.flight = null;
    this.brain.hold = true;
    this.motor = new RideMotor({ x: this.x, z: this.z, y: this.y, heading: this.heading }, tile);
    this.dragon.setMode(this.motor.grounded ? 'walk' : 'fly');
  }

  ride(dt, intent) {
    const m = this.motor;
    const wasGrounded = m.grounded;
    m.update(dt, intent);
    this.x = m.x;
    this.z = m.z;
    this.y = m.y;
    this.heading = m.heading;
    const d = this.dragon;
    d.setMode(m.grounded ? 'walk' : 'fly');
    d.stride = m.grounded ? Math.min(1, Math.abs(m.speed) / 2.5 + Math.abs(m.turnRate) * 0.15) : 0;
    // nose up when climbing, down when sinking; lean into turns
    d.extraPitch += ((m.grounded ? 0 : -m.vy * 0.07) - d.extraPitch) * Math.min(1, dt * 5);
    d.bank += ((m.grounded ? 0 : -m.turnRate * 0.18 * Math.min(1, Math.abs(m.speed) / 3 + 0.4)) - d.bank) * Math.min(1, dt * 5);
    if (intent.breathe) d.breathe(0.25);
    return { landed: !wasGrounded && m.grounded, tookOff: wasGrounded && !m.grounded };
  }

  dismount() {
    this.motor = null;
    this.dragon.extraPitch = 0;
    this.dragon.bank = 0;
    this.waiting = 20; // stays put for a bit so you can climb back on
    this.brain.hold = true;
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
    this.byIndex = new Map();
    this.wild = 0;
    this.names = {}; // index → name, for dragons that trust the player
  }

  get list() {
    return [...this.byIndex.values()];
  }

  // Trusted dragons are always around; the slider sets how many others there are.
  setCount(n) {
    this.wild = Math.max(0, Math.min(this.spots.length, n));
    this.sync();
  }

  setNames(names) {
    this.names = { ...names };
    for (const d of this.list) d.name = this.names[d.index] ?? null;
    this.sync();
  }

  sync() {
    for (const [i, d] of this.byIndex) {
      if (i >= this.wild && !(i in this.names) && !d.ridden) {
        d.dispose(this.scene);
        this.byIndex.delete(i);
      }
    }
    for (let i = 0; i < this.spots.length; i++) {
      if ((i < this.wild || i in this.names) && !this.byIndex.has(i)) {
        const d = new WorldDragon(i, this.spots[i], this.scene, this.world, this.open);
        d.name = this.names[i] ?? null;
        this.byIndex.set(i, d);
      }
    }
  }

  get(index) {
    return this.byIndex.get(index);
  }

  // Grounded dragons are solid to the player.
  obstacles(except) {
    const out = [];
    for (const d of this.byIndex.values()) if (d !== except && !d.hidden && d.y < GROUND + 1) out.push(...d.circles());
    return out;
  }

  // player: { x, z, speed } or null
  update(dt, player) {
    for (const d of this.byIndex.values()) d.update(dt, d.ridden ? null : player);
  }

  dispose() {
    for (const d of this.byIndex.values()) d.dispose(this.scene);
    this.byIndex.clear();
  }
}
