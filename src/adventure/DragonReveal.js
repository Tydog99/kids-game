// A short cutscene for adventure chapter 1: when a golden key is found, the player stops, the
// camera pulls way back and up, and one of the dragons swoops in from the distance and circles
// overhead. Then the camera glides back behind the player and they can move again.
import * as THREE from 'three';

const GROUND = 0.25;
const PULL_BACK = 1.6; // seconds for the camera to rise up and back
const SWOOP_START = 0.8; // the dragon starts its dive in from far away
const SWOOP = 2.6; // seconds of the dive in
const CIRCLE = 4.2; // seconds circling the player
const RETURN = 1.6; // seconds for the camera to come back behind the player
const RADIUS = 7; // of the circle around the player
const HEIGHT = 4.5; // of the circle, above the ground

export const smooth = (k) => {
  k = Math.min(1, Math.max(0, k));
  return k * k * (3 - 2 * k);
};

export class DragonReveal {
  // focus: the player's position; yaw: the way they face; onSee() when the dragon swoops close
  constructor(dragon, focus, yaw, { onSee = () => {}, onDone = () => {} } = {}) {
    this.d = dragon;
    this.t = 0;
    this.onSee = onSee;
    this.onDone = onDone;
    this.seen = false;
    this.done = false;
    const p = (this.p = new THREE.Vector3(focus.x, GROUND, focus.z));
    const fwd = (this.fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)));
    const right = (this.right = new THREE.Vector3(-fwd.z, 0, fwd.x));
    // the wide shot: high up behind the player, looking out past them
    this.wide = p.clone().addScaledVector(fwd, -15).add(new THREE.Vector3(0, 11, 0));
    this.look = new THREE.Vector3();
    this.followPos = new THREE.Vector3();
    this.followLook = new THREE.Vector3();
    this.lookAt = p.clone().addScaledVector(fwd, 6).setY(GROUND + 3);

    // the dragon's path: dive in from far ahead and high up, to a point beside the player, then
    // circle around them
    this.from = p.clone().addScaledVector(fwd, 34).addScaledVector(right, -12).setY(GROUND + 16);
    this.ctrl = p.clone().addScaledVector(fwd, 12).setY(GROUND + 6);
    this.entry = p.clone().addScaledVector(right, RADIUS).setY(GROUND + HEIGHT);
    this.pos = new THREE.Vector3();
    this.prev = null;

    dragon.hidden = false;
    dragon.skyOnly = true;
    dragon.flight = null;
    dragon.target = null;
    dragon.dragon.setMode('fly');
    this.place(0);
    dragon.script = (dt) => this.moveDragon(dt);
  }

  // where the dragon is s seconds into its flight
  path(s, out) {
    if (s < SWOOP) {
      const u = smooth(s / SWOOP) * 0.6 + (s / SWOOP) * 0.4; // ease in a little
      const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
      return out.set(0, 0, 0).addScaledVector(this.from, a).addScaledVector(this.ctrl, b).addScaledVector(this.entry, c);
    }
    // around the player, coming in at their right side heading back toward them
    const th = -((s - SWOOP) / CIRCLE) * Math.PI * 1.6;
    return out
      .copy(this.p)
      .addScaledVector(this.right, Math.cos(th) * RADIUS)
      .addScaledVector(this.fwd, Math.sin(th) * RADIUS)
      .setY(GROUND + HEIGHT + Math.sin(th * 2) * 0.6);
  }

  place(s) {
    const d = this.d;
    this.path(s, this.pos);
    const ahead = this.path(s + 0.05, new THREE.Vector3());
    const heading = Math.atan2(ahead.x - this.pos.x, ahead.z - this.pos.z);
    if (this.prevHeading !== undefined) {
      // lean into the turn
      let turn = heading - this.prevHeading;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      d.dragon.bank += (Math.max(-0.6, Math.min(0.6, -turn * 6)) - d.dragon.bank) * 0.1;
    }
    this.prevHeading = heading;
    d.x = this.pos.x;
    d.y = this.pos.y;
    d.z = this.pos.z;
    d.heading = heading;
  }

  moveDragon() {
    const s = Math.max(0, this.t - SWOOP_START);
    this.place(s);
    if (!this.seen && s > SWOOP * 0.75) {
      this.seen = true;
      this.onSee();
    }
    // a burst of breath partway round the circle, pointing away from the player
    if (!this.breathed && s > SWOOP + CIRCLE * 0.45) {
      this.breathed = true;
      this.d.dragon.breathe(1.4);
    }
  }

  get locked() {
    return !this.done && this.t < SWOOP_START + SWOOP + CIRCLE;
  }

  // Called after the follow camera has placed the camera: blend toward the cutscene's view.
  update(dt, camera, followLook) {
    this.t += dt;
    const end = SWOOP_START + SWOOP + CIRCLE;
    if (this.t >= end && this.d.script) {
      // the dragon flies on by itself from here
      this.d.script = null;
      this.d.dragon.bank = 0;
      this.d.flight = { phase: 'cruise', height: this.d.y - GROUND };
      this.d.target = null;
      this.d.brain.index = 3;
    }
    const w = this.t < end ? smooth(this.t / PULL_BACK) : 1 - smooth((this.t - end) / RETURN);
    if (this.t >= end + RETURN) {
      if (!this.done) {
        this.done = true;
        this.onDone();
      }
      return;
    }
    // look toward the dragon once it's coming in, while keeping the player in the shot
    const k = smooth((this.t - SWOOP_START) / 1.2);
    const dragonAt = new THREE.Vector3(this.d.x, this.d.y, this.d.z);
    const target = this.lookAt.clone().lerp(dragonAt.lerp(this.p, 0.35), k * 0.8);
    this.look.lerp(target, this.t < dt * 1.5 ? 1 : Math.min(1, dt * 3));
    this.followPos.copy(camera.position);
    this.followLook.copy(followLook);
    camera.position.lerpVectors(this.followPos, this.wide, w);
    camera.lookAt(this.followLook.lerp(this.look, w));
  }

  // finish at once (e.g. the game is leaving)
  cancel() {
    if (this.d.script) this.d.script = null;
    this.done = true;
  }
}
