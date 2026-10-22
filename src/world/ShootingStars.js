// Renders shooting stars as glowing ribbons with a fading tail.
import * as THREE from 'three';
import { makeMeteor, meteorPoint, spawnChance } from './shootingStars.js';

const RADIUS = 33; // distance of the sky dome from the camera
const SEGMENTS = 18;
const MAX = 8;

export class ShootingStars {
  constructor(scene) {
    this.scene = scene;
    this.perSecond = 0;
    this.view = new THREE.Vector3();
    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    });
    this.pool = Array.from({ length: MAX }, () => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 2 * 3), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * 2 * 3), 3));
      const idx = [];
      for (let i = 0; i < SEGMENTS; i++) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.renderOrder = 2;
      scene.add(mesh);
      return { mesh, meteor: null, t: 0 };
    });
  }

  update(dt, camera, night) {
    if (Math.random() < spawnChance(this.perSecond, dt, night)) {
      const slot = this.pool.find((s) => !s.meteor);
      if (slot) {
        camera.getWorldDirection(this.view);
        slot.meteor = makeMeteor(Math.random, Math.atan2(this.view.z, this.view.x));
        slot.t = 0;
        slot.mesh.visible = true;
      }
    }
    const cam = camera.position;
    const tmp = new THREE.Vector3(), side = new THREE.Vector3(), along = new THREE.Vector3();
    for (const s of this.pool) {
      if (!s.meteor) continue;
      const m = s.meteor;
      s.t += dt;
      const k = s.t / m.duration;
      if (k >= 1.25) {
        s.meteor = null;
        s.mesh.visible = false;
        continue;
      }
      // the head races along then stops; the tail catches up and the whole thing fades
      const head = Math.min(1, k) * m.length;
      const tail = Math.max(0, head - m.length * 0.45);
      const fade = (k < 0.1 ? k / 0.1 : 1) * (k > 1 ? 1 - (k - 1) / 0.25 : 1) * night;
      const pos = s.mesh.geometry.attributes.position.array, col = s.mesh.geometry.attributes.color.array;
      for (let i = 0; i <= SEGMENTS; i++) {
        const f = i / SEGMENTS; // 0 = tail end, 1 = head
        const p = meteorPoint(m, tail + (head - tail) * f);
        tmp.set(p[0] * RADIUS, p[1] * RADIUS, p[2] * RADIUS);
        // ribbon width faces the camera (the dome is centered on it)
        const q = meteorPoint(m, tail + (head - tail) * f + 0.001);
        along.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
        side.copy(along).cross(tmp).normalize().multiplyScalar(0.05 + 0.24 * f * f);
        const o = i * 6;
        pos[o] = cam.x + tmp.x + side.x; pos[o + 1] = cam.y + tmp.y + side.y; pos[o + 2] = cam.z + tmp.z + side.z;
        pos[o + 3] = cam.x + tmp.x - side.x; pos[o + 4] = cam.y + tmp.y - side.y; pos[o + 5] = cam.z + tmp.z - side.z;
        const b = f * f * fade; // brightest at the head
        col[o] = col[o + 3] = b;
        col[o + 1] = col[o + 4] = b * 0.97;
        col[o + 2] = col[o + 5] = b * 0.85 + f * 0.15 * fade;
      }
      s.mesh.geometry.attributes.position.needsUpdate = true;
      s.mesh.geometry.attributes.color.needsUpdate = true;
    }
  }

  dispose() {
    for (const s of this.pool) {
      s.mesh.geometry.dispose();
      this.scene.remove(s.mesh);
    }
    this.material.dispose();
  }
}
