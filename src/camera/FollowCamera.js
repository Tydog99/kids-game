// Third-person camera that sits directly behind the player. If a building is
// behind the player it moves in closer and looks down more steeply, so it never
// ends up inside walls.
import * as THREE from 'three';

const DIST = 3.4; // tiles behind
const HEIGHT = 2.1; // above the ground
const LOOK_AHEAD = 2.2;
const MIN_DIST = 0.9;

export class FollowCamera {
  // blocksView(tileX, tileZ) → true for tiles too tall to see through (buildings)
  constructor(camera, blocksView = () => false) {
    this.camera = camera;
    this.blocksView = blocksView;
    this.focus = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.dist = DIST;
    this.first = true;
  }

  clearDistance(fx, fz) {
    for (let d = 0.6; d <= DIST + 0.4; d += 0.2) {
      const x = Math.floor(this.focus.x - fx * d), z = Math.floor(this.focus.z - fz * d);
      if (this.blocksView(x, z)) return Math.max(MIN_DIST, d - 0.5);
    }
    return DIST;
  }

  update(dt, target, yaw) {
    const k = this.first ? 1 : 1 - Math.exp(-14 * dt);
    this.focus.lerp(target, k);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const want = this.clearDistance(fx, fz);
    // snap in quickly (never clip), ease back out slowly
    this.dist = this.first || want < this.dist ? want : this.dist + (want - this.dist) * (1 - Math.exp(-4 * dt));
    this.first = false;
    const h = HEIGHT + (DIST - this.dist) * 0.15;
    this.camera.position.set(this.focus.x - fx * this.dist, this.focus.y + h, this.focus.z - fz * this.dist);
    this.look.set(this.focus.x + fx * LOOK_AHEAD, this.focus.y + 0.5, this.focus.z + fz * LOOK_AHEAD);
    this.camera.lookAt(this.look);
  }
}
