// A short cutscene that swings the camera round to look at something (a lit bonfire and a happy
// villager, say), holds there, then glides back behind the player.
import * as THREE from 'three';
import { smooth } from './DragonReveal.js';

const IN = 1.1, OUT = 1.1;

export class ShowShot {
  // from: where the camera goes; look: what it looks at; hold: seconds to stay there
  constructor(from, look, hold = 3) {
    this.from = new THREE.Vector3(from.x, from.y, from.z);
    this.look = new THREE.Vector3(look.x, look.y, look.z);
    this.hold = hold;
    this.t = 0;
    this.done = false;
    this.followPos = new THREE.Vector3();
    this.followLook = new THREE.Vector3();
  }

  get locked() {
    return !this.done && this.t < IN + this.hold;
  }

  update(dt, camera, followLook) {
    this.t += dt;
    const w = this.t < IN + this.hold ? smooth(this.t / IN) : 1 - smooth((this.t - IN - this.hold) / OUT);
    if (this.t >= IN + this.hold + OUT) {
      this.done = true;
      return;
    }
    this.followPos.copy(camera.position);
    this.followLook.copy(followLook);
    camera.position.lerpVectors(this.followPos, this.from, w);
    camera.lookAt(this.followLook.lerp(this.look, w));
  }

  cancel() {
    this.done = true;
  }
}
