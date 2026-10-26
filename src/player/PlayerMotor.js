// Free movement logic, kept free of three.js so it can be unit tested.
// Up = walk forward, Down = back up, Left/Right = turn smoothly.
// Positions are in world units; tile (x, z) covers [x, x+1) × [z, z+1).
import { DIRS } from '../worldgen.js';

export const WALK_SPEED = 3.0; // tiles per second
export const BACK_SPEED = 1.6;
export const TURN_SPEED = 2.6; // radians per second
export const RADIUS = 0.28; // collision half-size of the player

export const yawForFacing = (f) => Math.atan2(DIRS[f][0], DIRS[f][1]);

export class PlayerMotor {
  constructor({ x, z, facing = 2 }, isWalkable) {
    this.isWalkable = isWalkable;
    this.px = x + 0.5;
    this.pz = z + 0.5;
    this.yaw = yawForFacing(facing); // 0 = facing +z; grows when turning left
    this.speed = 0; // current forward speed (negative = backing up)
    this.turnRate = 0;
    this.walkPhase = 0; // grows with distance walked, drives limb swing
    this.obstacles = () => []; // round things that move around, like dragons: [{ x, z, r }]
    this.onIce = () => false; // (x, z) → true where the ground is ice: you skate (slide) there
  }

  get x() {
    return Math.floor(this.px);
  }

  get z() {
    return Math.floor(this.pz);
  }

  // intent: { forward, back, left, right } — booleans
  update(dt, intent) {
    const turn = (intent.left ? 1 : 0) - (intent.right ? 1 : 0);
    this.turnRate += (turn * TURN_SPEED - this.turnRate) * (1 - Math.exp(-14 * dt));
    if (!turn && Math.abs(this.turnRate) < 0.01) this.turnRate = 0;
    this.yaw += this.turnRate * dt;

    // on ice you skate: a bit faster, and you glide on when you let go
    const ice = this.onIce(this.px, this.pz);
    const want = intent.forward ? WALK_SPEED * (ice ? 1.4 : 1) : intent.back ? -BACK_SPEED : 0;
    this.speed += (want - this.speed) * (1 - Math.exp(-(ice ? 1.6 : 12) * dt));
    if (!want && Math.abs(this.speed) < 0.02) this.speed = 0;

    const step = this.speed * dt;
    const moved = this.move(Math.sin(this.yaw) * step, Math.cos(this.yaw) * step);
    // about one full stride per tile walked; shuffle feet a little when turning on the spot
    this.walkPhase += moved * 2 * Math.PI + Math.abs(this.turnRate) * dt * 1.5;
  }

  // Moves each axis separately so the player slides along walls. Returns distance moved.
  move(dx, dz) {
    let moved = 0;
    // if the ground melted away right under the player, let them walk off it
    const stuck = this.isWalkable(Math.floor(this.px), Math.floor(this.pz)) === false;
    if (dx && (stuck || this.fits(this.px + dx, this.pz))) {
      this.px += dx;
      moved += Math.abs(dx);
    }
    if (dz && (stuck || this.fits(this.px, this.pz + dz))) {
      this.pz += dz;
      moved += Math.abs(dz);
    }
    return moved;
  }

  // isWalkable(tx, tz) returns true (open), false (solid tile) or a number: the radius of a
  // round obstacle in the middle of an otherwise open tile (a tree trunk you can walk around).
  fits(x, z) {
    for (let tz = Math.floor(z - RADIUS); tz <= Math.floor(z + RADIUS); tz++)
      for (let tx = Math.floor(x - RADIUS); tx <= Math.floor(x + RADIUS); tx++) {
        const w = this.isWalkable(tx, tz);
        if (w === false) return false;
        if (typeof w === 'number' && Math.hypot(x - tx - 0.5, z - tz - 0.5) < w + RADIUS) return false;
      }
    // can't walk into a dragon; if one ended up overlapping, moving away is still allowed
    for (const o of this.obstacles()) {
      const d = Math.hypot(x - o.x, z - o.z);
      if (d < o.r + RADIUS && d < Math.hypot(this.px - o.x, this.pz - o.z)) return false;
    }
    return true;
  }

  // 0..1, how much of a full walk the legs should show
  get stride() {
    return Math.min(1, Math.abs(this.speed) / WALK_SPEED + Math.abs(this.turnRate) / TURN_SPEED * 0.3);
  }
}
