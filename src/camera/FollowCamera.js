// Third-person camera that sits directly behind the player. If a building is
// behind the player it moves in closer and looks down more steeply, so it never
// ends up inside walls.
import * as THREE from 'three';

const DIST = 2.9; // tiles behind
const HEIGHT = 1.8; // above the ground
const LOOK_AHEAD = 2.2;
const MIN_DIST = 0.9;

export class FollowCamera {
  // blocksView(tileX, tileZ, focusY, x, z) → true where the camera can't see through (buildings, dragons)
  constructor(camera, blocksView = () => false) {
    this.camera = camera;
    this.blocksView = blocksView;
    this.focus = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.dist = DIST;
    this.orbit = 0; // extra angle around the player from dragging
    this.dragging = false;
    this.first = true;
    this.zoom = 1; // further back and higher while riding a dragon
    this.zoomTarget = 1;
  }

  clearDistance(fx, fz) {
    const far = DIST * this.zoom;
    for (let d = 0.6; d <= far + 0.4; d += 0.2) {
      const px = this.focus.x - fx * d, pz = this.focus.z - fz * d;
      if (this.blocksView(Math.floor(px), Math.floor(pz), this.focus.y, px, pz)) return Math.max(MIN_DIST, d - 0.5);
    }
    return far;
  }

  // Mouse/touch drag swings the camera around the player at the same height.
  // Returns to behind the player once they start walking again.
  addOrbit(radians) {
    this.orbit += radians;
  }

  update(dt, target, yaw, moving = false) {
    if (moving && !this.dragging && this.orbit) {
      this.orbit = Math.atan2(Math.sin(this.orbit), Math.cos(this.orbit)); // shortest way back
      this.orbit *= Math.exp(-2.5 * dt);
      if (Math.abs(this.orbit) < 0.002) this.orbit = 0;
    }
    yaw += this.orbit;
    this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-3 * dt));
    const k = this.first ? 1 : 1 - Math.exp(-14 * dt);
    this.focus.lerp(target, k);
    // trail the player's turn slightly so turning feels smooth, not rigid
    this.yaw = this.first ? yaw : this.yaw + (yaw - this.yaw) * (1 - Math.exp(-10 * dt));
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const want = this.clearDistance(fx, fz);
    // snap in quickly (never clip), ease back out slowly
    this.dist = this.first || want < this.dist ? want : this.dist + (want - this.dist) * (1 - Math.exp(-4 * dt));
    this.first = false;
    const h = HEIGHT * this.zoom + (DIST * this.zoom - this.dist) * 0.15;
    this.camera.position.set(this.focus.x - fx * this.dist, this.focus.y + h, this.focus.z - fz * this.dist);
    // aim fairly level so the horizon (where the sun and moon travel) stays in view
    this.look.set(this.focus.x + fx * LOOK_AHEAD * this.zoom, this.focus.y + 1.0, this.focus.z + fz * LOOK_AHEAD * this.zoom);
    this.camera.lookAt(this.look);
  }
}
