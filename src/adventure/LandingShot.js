// A cutscene for after the Dragon Book is picked up: the camera pulls up and away from the
// player and follows the dragons as they fly off to their resting spots and land. Then it
// glides back behind the player.
import * as THREE from 'three';
import { smooth } from './DragonReveal.js';

const GROUND = 0.25;
const PULL_BACK = 2; // seconds for the camera to rise up and away
const HOLD = 1.2; // seconds to watch after the last dragon has landed
const LONGEST = 15; // never longer than this, however far the dragons fly
const RETURN = 1.8;
// how far you can see during the shot (the game's fog and camera range are much shorter)
const VIEW = { near: 45, far: 110 };

export class LandingShot {
  // dragons: the ones flying down; focus: the player's position; yaw: the way they face
  constructor(dragons, focus, yaw, scene) {
    this.dragons = dragons;
    this.fog = scene.fog;
    this.base = { near: this.fog.near, far: this.fog.far, camera: null };
    this.t = 0;
    this.end = null; // when the shot starts heading back
    this.done = false;
    this.p = new THREE.Vector3(focus.x, GROUND, focus.z);
    this.back = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    this.mid = this.centre(new THREE.Vector3());
    this.camAt = null;
    this.look = null;
    this.followPos = new THREE.Vector3();
    this.followLook = new THREE.Vector3();
  }

  // the middle of where the dragons are now
  centre(out) {
    out.set(0, 0, 0);
    for (const d of this.dragons) out.add(new THREE.Vector3(d.x, d.y, d.z));
    return out.divideScalar(Math.max(1, this.dragons.length));
  }

  get landed() {
    return this.dragons.every((d) => d.grounded && !d.summon);
  }

  get locked() {
    return this.end === null || this.t < this.end;
  }

  update(dt, camera, followLook) {
    this.t += dt;
    if (this.end === null) {
      if (this.landed) this.landedAt ??= this.t;
      if ((this.landedAt !== undefined && this.t > this.landedAt + HOLD && this.t > PULL_BACK + 1) || this.t > LONGEST) this.end = this.t;
    }
    if (this.end !== null && this.t >= this.end + RETURN) {
      this.done = true;
      this.see(camera, 0);
      return;
    }

    // high above, somewhere between the player and the dragons, looking down on the dragons;
    // higher when they are far apart so they all fit in
    this.mid.lerp(this.centre(new THREE.Vector3()), Math.min(1, dt * 2));
    const toMid = this.mid.clone().sub(this.p).setY(0);
    const far = toMid.length();
    let spread = 0;
    for (const d of this.dragons) spread = Math.max(spread, Math.hypot(d.x - this.mid.x, d.z - this.mid.z));
    const dir = far > 1 ? toMid.clone().divideScalar(far) : this.back.clone().negate();
    const height = 12 + Math.min(14, spread * 0.3 + far * 0.1);
    const want = this.p.clone().addScaledVector(dir, far * 0.35 - 12 - spread * 0.15).setY(GROUND + height);
    const wantLook = this.mid.clone().setY(GROUND + 1);
    if (!this.camAt) {
      this.camAt = want.clone();
      this.look = wantLook.clone();
    }
    const k = Math.min(1, dt * 1.5);
    this.camAt.lerp(want, k);
    this.look.lerp(wantLook, k);

    const w = this.end === null ? smooth(this.t / PULL_BACK) : 1 - smooth((this.t - this.end) / RETURN);
    this.followPos.copy(camera.position);
    this.followLook.copy(followLook);
    camera.position.lerpVectors(this.followPos, this.camAt, w);
    camera.lookAt(this.followLook.lerp(this.look, w));
    this.see(camera, w);
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
    this.fog.near = this.base.near;
    this.fog.far = this.base.far;
  }
}
