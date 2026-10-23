// A villager (Grandpa Ollie, and the townsfolk in chapter 4) who stands still, turns to watch the
// player and waves while talking.
import { Character } from '../player/Character.js';

export class Villager {
  // id: which character model ('grandpa', 'boy', 'girl'); look: color overrides (looks.js)
  constructor(scene, x, z, id = 'grandpa', look = null) {
    this.character = new Character(id, look);
    this.root = this.character.root;
    this.x = x;
    this.z = z;
    this.heading = 0;
    this.wave = 0;
    this.cheering = false; // both arms up, hopping for joy
    this.cheer = 0;
    this.root.position.set(x, 0.25, z);
    scene.add(this.root);
    this.scene = scene;
  }

  // player: { x, z }; talking: wave while speaking
  update(dt, t, player, talking) {
    const dx = player.x - this.x, dz = player.z - this.z, d = Math.hypot(dx, dz);
    if (d < 9) {
      const want = Math.atan2(dx, dz);
      const diff = Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading));
      this.heading += diff * Math.min(1, dt * 4);
    }
    this.root.rotation.y = this.heading;
    this.character.animate(0, 0, t);
    this.wave += ((talking ? 1 : 0) - this.wave) * Math.min(1, dt * 5);
    this.cheer += ((this.cheering ? 1 : 0) - this.cheer) * Math.min(1, dt * 6);
    this.root.position.y = 0.25 + this.cheer * Math.abs(Math.sin(t * 7)) * 0.18;
    if (this.cheer > 0.01) {
      const { armL, armR } = this.character.parts;
      for (const [arm, side] of [[armL, -1], [armR, 1]]) {
        arm.rotation.x = -2.8 * this.cheer;
        arm.rotation.z = side * (0.35 + Math.sin(t * 7) * 0.15) * this.cheer;
      }
      return;
    }
    if (this.wave > 0.01) {
      const arm = this.character.parts.armR;
      arm.rotation.x = -2.5 * this.wave;
      arm.rotation.z = 0.25 * this.wave + Math.sin(t * 9) * 0.35 * this.wave;
    }
  }

  get obstacle() {
    return { x: this.x, z: this.z, r: 0.3 };
  }

  dispose() {
    this.scene.remove(this.root);
    this.character.dispose();
  }
}
