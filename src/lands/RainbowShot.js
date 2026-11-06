// The cutscene once the star is on top of the giant crystal tree: the camera flies in to see the
// star shine, then pulls slowly up and away, swinging round the Crystal Forest while the rainbows
// spread out over it (GlimmerQuest grows them on the same clock, RAINBOW_TIMES). Then it glides
// back behind the player. The fog opens right up so the whole forest can be seen.
import * as THREE from 'three';
import { smooth } from '../adventure/DragonReveal.js';

const STAR = 2.5; // seconds to fly in close to the star
const OUT = 12; // seconds pulling up and away round the forest
const HOLD = 2.5; // seconds to take in the view at the end
const RETURN = 2.5;
const VIEW = { near: 120, far: 210 }; // fog while the shot plays: hardly any

// When the rainbows grow, in seconds from the start of the shot: the big one over the forest,
// then the little ones, one after another.
export const RAINBOW_TIMES = { main: STAR + 0.5, mainFor: 5, extra: STAR + 4, extraEvery: 1.4, extraFor: 2.5 };

export class RainbowShot {
  // star: { x, y, z } the star on the tree; center: { x, z } the middle of the forest
  constructor(star, center, scene) {
    this.star = new THREE.Vector3(star.x, star.y, star.z);
    this.center = new THREE.Vector3(center.x, 0, center.z);
    this.fog = scene.fog;
    this.base = { near: this.fog.near, far: this.fog.far, camera: null };
    this.t = 0;
    this.done = false;
    this.followPos = new THREE.Vector3();
    this.followLook = new THREE.Vector3();
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    // the star close up, from the rainbow's front (+z) side
    this.near = { pos: this.star.clone().add(new THREE.Vector3(6, 2, 13)), look: this.star.clone().add(new THREE.Vector3(0, -1, 0)) };
  }

  get locked() {
    return !this.done && this.t < STAR + OUT + HOLD;
  }

  // the camera's spot k (0..1) of the way through the pull-back: round the forest's middle,
  // further out and higher up, from just in front of the star
  outPose(k) {
    const c = this.center;
    const start = Math.atan2(this.near.pos.x - c.x, this.near.pos.z - c.z);
    const angle = start + k * 1.3;
    const r0 = Math.hypot(this.near.pos.x - c.x, this.near.pos.z - c.z);
    const r = r0 + (78 - r0) * k;
    const pos = new THREE.Vector3(c.x + Math.sin(angle) * r, this.near.pos.y + (38 - this.near.pos.y) * k, c.z + Math.cos(angle) * r);
    const look = this.star.clone().lerp(new THREE.Vector3(c.x, 9, c.z), Math.min(1, k * 1.6));
    return { pos, look };
  }

  update(dt, camera, followLook) {
    this.camera = camera;
    this.t += dt;
    const t = this.t;
    this.followPos.copy(camera.position);
    this.followLook.copy(followLook);
    if (!this.startPos) this.startPos = camera.position.clone(), this.startLook = followLook.clone();

    if (t < STAR) {
      const k = smooth(t / STAR);
      this.pos.lerpVectors(this.startPos, this.near.pos, k);
      this.look.lerpVectors(this.startLook, this.near.look, k);
      this.see(camera, k);
    } else if (t < STAR + OUT + HOLD) {
      const o = this.outPose(smooth(Math.min(1, (t - STAR) / OUT)));
      this.pos.copy(o.pos);
      this.look.copy(o.look);
      this.see(camera, 1);
    } else {
      // back to the follow camera
      const k = smooth((t - STAR - OUT - HOLD) / RETURN);
      if (!this.from) this.from = { pos: this.pos.clone(), look: this.look.clone() };
      this.pos.lerpVectors(this.from.pos, this.followPos, k);
      this.look.lerpVectors(this.from.look, this.followLook, k);
      this.see(camera, 1 - k);
      if (k >= 1) {
        this.done = true;
        this.see(camera, 0);
        return;
      }
    }
    camera.position.copy(this.pos);
    camera.lookAt(this.look);
  }

  // open up the view (w = 1) or put it back as it was (w = 0)
  see(camera, w) {
    this.base.camera ??= camera.far;
    this.fog.near = this.base.near + (VIEW.near - this.base.near) * w;
    this.fog.far = this.base.far + (VIEW.far - this.base.far) * w;
    const far = this.base.camera + (VIEW.far + 10 - this.base.camera) * w;
    if (camera.far !== far) {
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  }

  cancel() {
    this.done = true;
    if (this.camera) this.see(this.camera, 0);
  }
}
