// A baby dragon (hatched in the Fire Mountains) that follows the player everywhere: trotting
// behind on foot, flying alongside when the player rides, hopping about and puffing little smoke
// rings when it stops.
import * as THREE from 'three';
import { Dragon } from './Dragon.js';

const GROUND = 0.25;
const SCALE = 0.42;
const PUFFS = 12;

export class BabyDragon {
  constructor(scene, kind, at) {
    this.scene = scene;
    this.dragon = new Dragon(kind);
    this.dragon.root.scale.setScalar(SCALE);
    this.root = this.dragon.root;
    this.root.position.set(at.x, GROUND, at.z);
    scene.add(this.root);
    this.heading = 0;
    this.y = GROUND;
    // little puffs of smoke (and a spark or two)
    this.puffs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: '#ffffff' }), PUFFS);
    this.puffs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PUFFS * 3), 3);
    this.puffs.frustumCulled = false;
    scene.add(this.puffs);
    this.puffList = [];
    this.puffTimer = 3;
    this.tmp = new THREE.Object3D();
    this.mouth = new THREE.Vector3();
    this.c = new THREE.Color();
  }

  // player: { x, z, heading }; riding: the dragon being ridden, or null
  update(dt, t, player, riding) {
    const d = this.dragon;
    const flying = !!riding && riding.y > GROUND + 0.5;
    // where to be: just behind and beside the player (beside the big dragon, a little lower, when flying)
    const back = flying ? 1.2 : 1.6, side = flying ? 2.6 * riding.scale * 0.6 : 0.9;
    const h = player.heading;
    const want = {
      x: player.x - Math.sin(h) * back + Math.cos(h) * side,
      z: player.z - Math.cos(h) * back - Math.sin(h) * side,
      y: flying ? riding.y + 0.2 : GROUND,
    };
    const p = this.root.position;
    const dx = want.x - p.x, dz = want.z - p.z, dist = Math.hypot(dx, dz);
    if (dist > 30) p.set(want.x, want.y, want.z); // left far behind: catch up at once
    const speed = Math.min(14, 2 + dist * 2.2);
    const moving = dist > 0.25;
    if (moving) {
      const step = Math.min(dist, speed * dt);
      p.x += (dx / dist) * step;
      p.z += (dz / dist) * step;
      const turn = Math.atan2(dx, dz) - this.heading;
      this.heading += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 8);
    } else {
      // stopped: turn to look the way the player looks
      const turn = h - this.heading;
      this.heading += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 3);
    }
    this.y += (want.y - this.y) * Math.min(1, dt * 4);
    // a happy hop now and then while waiting on the ground
    const hop = !flying && !moving ? Math.max(0, Math.sin(t * 5)) ** 4 * (Math.sin(t * 0.9) > 0.5 ? 0.25 : 0) : 0;
    p.y = this.y + hop;
    this.root.rotation.y = this.heading;
    d.setMode(flying || this.y > GROUND + 0.4 ? 'fly' : !moving ? 'sit' : 'walk');
    d.stride = moving && !flying ? Math.min(1, dist) : 0;
    d.update(dt);
    this.updatePuffs(dt, moving || flying);
  }

  updatePuffs(dt, busy) {
    this.puffTimer -= dt;
    if (this.puffTimer <= 0 && !busy) {
      this.puffTimer = 3 + Math.random() * 4;
      this.dragon.mouth.getWorldPosition(this.mouth);
      const f = new THREE.Vector3(Math.sin(this.heading), 0.4, Math.cos(this.heading));
      for (let i = 0; i < 5; i++) this.puffList.push({ p: this.mouth.clone(), v: f.clone().multiplyScalar(0.6 + Math.random() * 0.5).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, Math.random() * 0.3, (Math.random() - 0.5) * 0.3)), age: 0, spark: i === 0 });
    }
    this.puffList = this.puffList.filter((q) => (q.age += dt) < 1.4);
    let n = 0;
    for (const q of this.puffList) {
      if (n >= PUFFS) break;
      q.p.addScaledVector(q.v, dt);
      const k = q.age / 1.4;
      this.tmp.position.copy(q.p);
      this.tmp.scale.setScalar((q.spark ? 0.05 : 0.08 + k * 0.12) * (1 - k * 0.5));
      this.tmp.rotation.set(q.age * 3, q.age * 2, 0);
      this.tmp.updateMatrix();
      this.puffs.setMatrixAt(n, this.tmp.matrix);
      this.puffs.setColorAt(n, q.spark ? this.c.set('#ffb030') : this.c.setRGB(0.55 + k * 0.3, 0.55 + k * 0.3, 0.55 + k * 0.3));
      n++;
    }
    this.puffs.count = n;
    this.puffs.instanceMatrix.needsUpdate = true;
    if (this.puffs.instanceColor) this.puffs.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.root, this.puffs);
    this.root.traverse((o) => o.geometry?.dispose());
    this.puffs.geometry.dispose();
    this.dragon.dispose();
  }
}
