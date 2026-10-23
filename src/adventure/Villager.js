// Grandpa Ollie: a villager who stands by his treasure chest, turns to watch the player and waves.
import { Character } from '../player/Character.js';

export class Villager {
  constructor(scene, x, z) {
    this.character = new Character('grandpa');
    this.root = this.character.root;
    this.x = x;
    this.z = z;
    this.heading = 0;
    this.wave = 0;
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
