// Movement for a dragon the player is riding (hover style). Pure, so it can be tested.
// Ground: ↑/↓ walk, ←/→ turn, Space takes off.
// Air: ↑ fly forward, ↓ slow down and back up, let go to hover, Space rise, Shift sink.
// Sinking all the way down onto open ground lands; over water, trees and roofs it hovers instead.

export const RIDE = {
  walk: 3.2,
  walkBack: 1.4,
  fly: 7.5,
  flyBack: 2.5,
  turn: 2.0,
  climb: 3.6,
  sink: 3.2,
  ceiling: 16, // highest the dragon can fly
  radius: 0.75, // footprint
};

export const GROUND_Y = 0.25;

const smooth = (from, to, rate, dt) => from + (to - from) * (1 - Math.exp(-rate * dt));

export class RideMotor {
  // tile(tx, tz) → { top, land }: highest point of whatever is on the tile, and whether a dragon
  // can stand there. Open ground is { top: GROUND_Y, land: true }.
  constructor({ x, z, y = GROUND_Y, heading = 0 }, tile) {
    this.tile = tile;
    this.x = x;
    this.z = z;
    this.y = y;
    this.heading = heading;
    this.speed = 0;
    this.turnRate = 0;
    this.vy = 0;
    this.grounded = y <= GROUND_Y + 0.01 && this.canLand(x, z);
  }

  // Every tile under the dragon's footprint.
  each(x, z, fn) {
    const r = RIDE.radius;
    for (let tz = Math.floor(z - r); tz <= Math.floor(z + r); tz++)
      for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) if (fn(this.tile(tx, tz)) === false) return false;
    return true;
  }

  canLand(x, z) {
    return this.each(x, z, (t) => t.land);
  }

  // Lowest the dragon can be here (on the ground, or just above trees, roofs, water…)
  floorAt(x, z) {
    let top = GROUND_Y;
    this.each(x, z, (t) => {
      top = Math.max(top, t.top);
    });
    return top;
  }

  fits(x, z) {
    return this.grounded ? this.canLand(x, z) : this.floorAt(x, z) <= this.y + 0.05;
  }

  update(dt, intent) {
    const turn = (intent.left ? 1 : 0) - (intent.right ? 1 : 0);
    this.turnRate = smooth(this.turnRate, turn * RIDE.turn, 10, dt);
    this.heading += this.turnRate * dt;

    if (this.grounded && intent.up) {
      this.grounded = false;
      this.vy = RIDE.climb;
    }
    const fwd = this.grounded ? RIDE.walk : RIDE.fly;
    const back = this.grounded ? RIDE.walkBack : RIDE.flyBack;
    this.speed = smooth(this.speed, intent.forward ? fwd : intent.back ? -back : 0, this.grounded ? 8 : 2.5, dt);
    if (!intent.forward && !intent.back && Math.abs(this.speed) < 0.02) this.speed = 0;

    // horizontal: each axis separately so the dragon slides along walls
    const dx = Math.sin(this.heading) * this.speed * dt, dz = Math.cos(this.heading) * this.speed * dt;
    if (dx && this.fits(this.x + dx, this.z)) this.x += dx;
    if (dz && this.fits(this.x, this.z + dz)) this.z += dz;

    if (this.grounded) {
      this.vy = 0;
      this.y = GROUND_Y;
      return;
    }
    this.vy = smooth(this.vy, intent.up ? RIDE.climb : intent.down ? -RIDE.sink : 0, 4, dt);
    this.y = Math.min(RIDE.ceiling, this.y + this.vy * dt);
    const floor = this.floorAt(this.x, this.z);
    if (this.y <= floor) {
      this.y = floor;
      this.vy = Math.max(0, this.vy);
      if (floor <= GROUND_Y + 0.001 && this.canLand(this.x, this.z)) {
        this.grounded = true;
        this.speed = Math.min(this.speed, RIDE.walk);
      }
    }
  }
}
