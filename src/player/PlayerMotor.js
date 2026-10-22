// Grid movement logic, kept free of three.js so it can be unit tested.
// Up = step forward, Down = step back, Left/Right = turn 90°.
import { DIRS } from '../worldgen.js';

export const STEP_TIME = 0.24;
export const BACK_STEP_TIME = 0.32;
export const TURN_TIME = 0.16;
export const BUMP_TIME = 0.18;

export const yawForFacing = (f) => Math.atan2(DIRS[f][0], DIRS[f][1]);

export class PlayerMotor {
  constructor({ x, z, facing = 2 }, isWalkable) {
    this.isWalkable = isWalkable;
    this.x = x;
    this.z = z;
    this.facing = facing;
    this.yaw = yawForFacing(facing);
    this.px = x; // rendered (interpolated) position
    this.pz = z;
    this.state = 'idle';
    this.t = 0;
    this.duration = 0;
    this.walkPhase = 0; // grows while walking, drives limb swing
    this.bump = 0; // 0..1 nudge when walking into something
    this.steps = 0;
  }

  // intent: { forward, back, left, right } — booleans.
  // Returns true if the intent started a new move (so queued taps can be cleared).
  update(dt, intent) {
    let remaining = dt;
    let started = false;
    // loop so a held key chains steps without a one-frame pause
    for (let guard = 0; guard < 4 && remaining > 0; guard++) {
      if (this.state === 'idle') {
        if (!this.start(intent)) break;
        started = true;
      }
      const left = this.duration - this.t;
      const used = Math.min(left, remaining);
      this.t += used;
      remaining -= used;
      this.apply();
      if (this.t >= this.duration) this.finish();
    }
    if (this.state === 'idle') this.walkPhase = 0;
    return started;
  }

  start(intent) {
    if (intent.left || intent.right) {
      this.fromYaw = this.yaw;
      this.facing = (this.facing + (intent.left ? 3 : 1)) % 4;
      this.toYaw = this.fromYaw + (intent.left ? Math.PI / 2 : -Math.PI / 2);
      return this.begin('turn', TURN_TIME);
    }
    if (intent.forward || intent.back) {
      const dir = intent.forward ? 1 : -1;
      const [dx, dz] = DIRS[this.facing];
      const tx = this.x + dx * dir, tz = this.z + dz * dir;
      if (!this.isWalkable(tx, tz)) {
        this.bumpDir = dir;
        return this.begin('bump', BUMP_TIME);
      }
      this.fromX = this.x;
      this.fromZ = this.z;
      this.x = tx; // logical tile updates immediately, so nothing else can claim it
      this.z = tz;
      this.stepDir = dir;
      return this.begin('step', dir > 0 ? STEP_TIME : BACK_STEP_TIME);
    }
    return false;
  }

  begin(state, duration) {
    this.state = state;
    this.t = 0;
    this.duration = duration;
    return true;
  }

  apply() {
    const k = this.t / this.duration;
    if (this.state === 'turn') {
      const e = k * k * (3 - 2 * k);
      this.yaw = this.fromYaw + (this.toYaw - this.fromYaw) * e;
    } else if (this.state === 'step') {
      this.px = this.fromX + (this.x - this.fromX) * k;
      this.pz = this.fromZ + (this.z - this.fromZ) * k;
      this.walkPhase = (this.steps + k) * Math.PI;
    } else if (this.state === 'bump') {
      this.bump = Math.sin(k * Math.PI) * this.bumpDir;
    }
  }

  finish() {
    if (this.state === 'step') {
      this.px = this.x;
      this.pz = this.z;
      this.steps++;
    }
    if (this.state === 'turn') this.yaw = this.toYaw;
    this.bump = 0;
    this.state = 'idle';
    this.t = 0;
  }
}
