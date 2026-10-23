// A cutscene for after the Dragon Book is picked up: the camera pulls up and away from the
// player, then visits each dragon's resting spot in turn and watches that dragon fly in and land.
// Then it glides back behind the player.
import * as THREE from 'three';
import { smooth } from './DragonReveal.js';

const GROUND = 0.25;
const PULL_BACK = 1.8; // seconds for the camera to rise up and away from the player
const MOVE = 2.2; // seconds to glide over to the next dragon's spot
const AFTER_LANDING = 1.2; // seconds to watch each dragon once it's down
const LONGEST_EACH = 8; // move on even if a dragon hasn't landed by then
const RETURN = 2;
// how far you can see during the shot (the game's fog and camera range are much shorter)
const VIEW = { near: 45, far: 110 };

export class LandingShot {
  // dragons: the ones to watch land, in order; focus: the player's position; yaw: the way they
  // face; launch(d, from): send dragon d off from point `from` to its resting spot
  constructor(dragons, focus, yaw, scene, launch) {
    this.dragons = dragons;
    this.launch = launch;
    this.launched = new Set();
    this.fog = scene.fog;
    this.base = { near: this.fog.near, far: this.fog.far, camera: null };
    this.p = new THREE.Vector3(focus.x, GROUND, focus.z);
    this.t = 0;
    this.done = false;
    this.returning = false;

    // the first pose: high above and behind the player, looking toward the first dragon's spot
    const back = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const first = this.shot(dragons[0]);
    const toFirst = first.look.clone().sub(this.p).setY(0).normalize();
    this.poses = [{ pos: this.p.clone().addScaledVector(back, 6).addScaledVector(toFirst, -6).setY(GROUND + 16), look: this.p.clone().lerp(first.look, 0.5) }];
    this.camAt = null;
    this.look = null;
    this.from = null;
    this.step = -1; // -1: pulling back; then the index of the dragon being watched
    this.stepT = 0;
    this.followPos = new THREE.Vector3();
    this.followLook = new THREE.Vector3();
  }

  // Where to watch dragon d land from: on the player's side of its spot, a little above, so it
  // flies in toward the camera.
  shot(d) {
    const s = new THREE.Vector3(d.restSpot.x, GROUND, d.restSpot.z);
    const u = s.clone().sub(this.p).setY(0);
    if (u.lengthSq() < 1) u.set(0, 0, 1);
    u.normalize();
    const side = new THREE.Vector3(-u.z, 0, u.x);
    return {
      pos: s.clone().addScaledVector(u, -10).addScaledVector(side, 3).setY(GROUND + 6),
      look: s.clone().setY(GROUND + 1.2),
      // the dragon comes in from beyond its spot, high up, curving in from the side
      from: s.clone().addScaledVector(u, 16).addScaledVector(side, -9).setY(GROUND + 9),
    };
  }

  get locked() {
    return !this.done && !this.returning;
  }

  // start gliding from the current view to `to`
  glide(to) {
    this.from = { pos: this.camAt.clone(), look: this.look.clone() };
    this.to = to;
    this.stepT = 0;
  }

  update(dt, camera, followLook) {
    this.camera = camera;
    this.t += dt;
    this.stepT += dt;
    if (!this.camAt) {
      // the shot starts from wherever the follow camera is
      this.camAt = camera.position.clone();
      this.look = followLook.clone();
      this.glide(this.poses[0]);
    }

    if (!this.returning) {
      const d = this.dragons[this.step];
      const moving = this.step === -1 ? PULL_BACK : MOVE;
      const landed = d && d.grounded && !d.summon;
      if (landed) this.landedAt ??= this.stepT;
      const next =
        this.stepT > moving &&
        (this.step === -1 || (this.landedAt !== undefined && this.stepT > this.landedAt + AFTER_LANDING) || this.stepT > moving + LONGEST_EACH);
      if (next) {
        this.landedAt = undefined;
        this.step++;
        const nd = this.dragons[this.step];
        if (nd) {
          const shot = this.shot(nd);
          this.glide(shot);
          this.launchOne(nd, shot.from);
        } else {
          this.returning = true;
          this.stepT = 0;
          this.from = { pos: this.camAt.clone(), look: this.look.clone() };
          this.launchRest();
        }
      }
    }

    if (this.returning) {
      // back to the follow camera
      const k = smooth(this.stepT / RETURN);
      this.followPos.copy(camera.position);
      this.followLook.copy(followLook);
      camera.position.lerpVectors(this.from.pos, this.followPos, k);
      camera.lookAt(this.from.look.clone().lerp(this.followLook, k));
      this.see(camera, 1 - k);
      if (k >= 1) {
        this.done = true;
        this.see(camera, 0);
      }
      return;
    }

    // glide between poses, rising up in the middle of long moves so the camera clears the trees
    const moving = this.step === -1 ? PULL_BACK : MOVE;
    const k = smooth(this.stepT / moving);
    const span = this.from.pos.distanceTo(this.to.pos);
    this.camAt.lerpVectors(this.from.pos, this.to.pos, k);
    this.camAt.y += Math.sin(k * Math.PI) * Math.min(14, span * 0.25);
    this.look.lerpVectors(this.from.look, this.to.look, k);
    // turn to keep the dragon in view as it comes in
    const d = this.dragons[this.step];
    if (d) this.look.lerp(new THREE.Vector3(d.x, d.y + 0.6, d.z).lerp(this.to.look, 0.4), k * 0.7);
    camera.position.copy(this.camAt);
    camera.lookAt(this.look);
    this.see(camera, this.step === -1 ? k : 1);
  }

  launchOne(d, from) {
    if (this.launched.has(d)) return;
    this.launched.add(d);
    this.launch(d, from);
  }

  // any dragon not yet sent off goes now (straight from where it is)
  launchRest() {
    for (const d of this.dragons) this.launchOne(d, null);
  }

  // open up the view (w = 1) or put it back as it was (w = 0)
  see(camera, w) {
    this.base.camera ??= camera.far;
    this.fog.near = this.base.near + (VIEW.near - this.base.near) * w;
    this.fog.far = this.base.far + (VIEW.far - this.base.far) * w;
    const far = this.base.camera + (VIEW.far + 5 - this.base.camera) * w;
    if (camera.far !== far) {
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  }

  cancel() {
    this.done = true;
    this.launchRest();
    if (this.camera) this.see(this.camera, 0);
  }
}
