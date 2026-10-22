// Dragon breath: fire, ice or diamonds, as pooled voxel-style particles in world space.
import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);

const TYPES = {
  fire: {
    max: 420,
    rate: 170, // particles per second while breathing
    speed: [5, 7.5],
    spread: 0.16,
    life: [0.5, 0.8],
    size: [0.08, 0.34],
    gravity: 1.6, // hot air rises
    drag: 1.2,
    geometry: () => new THREE.BoxGeometry(1, 1, 1),
    // solid (unlit) colors rather than additive glow, so the flame stays orange on a bright sky
    material: () => new THREE.MeshBasicMaterial(),
    // yellow → orange → red, finishing as a puff of smoke
    color: (t, c, seed) => {
      const stops = seed < 0.25 ? ['#fff3a0', '#ffd23f', '#ff9a2a', '#e8541c'] : ['#ffd23f', '#ff8a1f', '#e8401c', '#6b5a55'];
      const k = Math.min(0.999, t) * (stops.length - 1);
      const i = Math.floor(k);
      return c.set(stops[i]).lerp(new THREE.Color(stops[i + 1]), k - i);
    },
    light: '#ff8a2a',
  },
  ice: {
    max: 380,
    rate: 125,
    speed: [4.5, 6.5],
    spread: 0.2,
    life: [0.7, 1.1],
    size: [0.06, 0.22],
    gravity: -2.2, // cold mist sinks
    drag: 1.4,
    geometry: () => new THREE.OctahedronGeometry(1, 0).scale(0.55, 1.4, 0.55), // ice shard
    material: () => new THREE.MeshLambertMaterial({ emissive: '#7fd8ff', emissiveIntensity: 0.45 }),
    color: (t, c, seed) => c.set(seed < 0.4 ? '#ffffff' : seed < 0.75 ? '#c9f3ff' : '#86d6ff'),
    light: '#7fd8ff',
  },
  diamonds: {
    max: 220,
    rate: 38,
    speed: [3.5, 5.5],
    spread: 0.38,
    up: 0.45, // tossed upward in an arc
    life: [3, 4],
    size: [0.12, 0.12],
    gravity: -9.8,
    drag: 0.15,
    bounce: true,
    geometry: () => new THREE.OctahedronGeometry(1, 0).scale(1, 1.35, 1), // faceted gem
    material: () => new THREE.MeshPhongMaterial({ flatShading: true, shininess: 140, specular: '#ffffff', emissive: '#334', emissiveIntensity: 0.35 }),
    color: (t, c, seed) => c.set(['#ffffff', '#ff9fd0', '#8ff0ff', '#c9a6ff', '#ffe27a'][Math.floor(seed * 5)]),
    light: '#fff2ff',
  },
};

export class Breath {
  constructor(scene, type) {
    this.type = TYPES[type];
    this.scene = scene;
    const T = this.type;
    this.mesh = new THREE.InstancedMesh(T.geometry(), T.material(), T.max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = type === 'diamonds';
    scene.add(this.mesh);
    this.light = new THREE.PointLight(T.light, 0, 6, 1.5);
    scene.add(this.light);
    this.particles = [];
    this.carry = 0;
    this.glow = 0;
    this.tmp = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(), c: new THREE.Color(), e: new THREE.Euler(), up: new THREE.Vector3(0, 1, 0) };
  }

  // origin/dir: mouth position and facing in world space. ground: y of the floor.
  update(dt, breathing, origin, dir, ground = 0) {
    const T = this.type;
    // spawn
    if (breathing) {
      this.carry += T.rate * dt;
      const side = new THREE.Vector3().crossVectors(dir, this.tmp.up).normalize();
      const up = new THREE.Vector3().crossVectors(side, dir).normalize();
      while (this.carry >= 1 && this.particles.length < T.max) {
        this.carry -= 1;
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * T.spread;
        const v = dir.clone()
          .addScaledVector(side, Math.cos(a) * r)
          .addScaledVector(up, Math.sin(a) * r + (T.up ?? 0))
          .normalize()
          .multiplyScalar(rand(...T.speed));
        this.particles.push({
          p: origin.clone().addScaledVector(dir, 0.05),
          v,
          age: 0,
          life: rand(...T.life),
          seed: Math.random(),
          spin: new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)),
          rot: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        });
      }
    } else {
      this.carry = 0;
    }

    // light at the mouth flickers while breathing
    this.glow += ((breathing ? 1 : 0) - this.glow) * Math.min(1, dt * 10);
    this.light.position.copy(origin).addScaledVector(dir, 0.6);
    this.light.intensity = this.glow * (6 + Math.random() * 3);

    // simulate
    const { m, q, s, c, e } = this.tmp;
    let n = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const P = this.particles[i];
      P.age += dt;
      if (P.age >= P.life) {
        this.particles.splice(i, 1);
        continue;
      }
      P.v.y += T.gravity * dt;
      P.v.multiplyScalar(Math.exp(-T.drag * dt));
      P.p.addScaledVector(P.v, dt);
      P.rot.addScaledVector(P.spin, dt);
      if (T.bounce && P.p.y < ground + 0.1) {
        P.p.y = ground + 0.1;
        if (P.v.y < 0) P.v.y *= -0.45;
        P.v.x *= 0.7;
        P.v.z *= 0.7;
        P.spin.multiplyScalar(0.8);
      } else if (!T.bounce && P.p.y < ground + 0.02) {
        P.p.y = ground + 0.02;
        P.v.y = Math.max(0, P.v.y);
      }
    }
    for (const P of this.particles) {
      const t = P.age / P.life;
      let size;
      if (T.bounce) {
        // diamonds: pop in, twinkle, shrink away at the very end
        size = T.size[0] * Math.min(1, P.age * 8) * (t > 0.85 ? (1 - t) / 0.15 : 1) * (0.9 + 0.1 * Math.sin(P.age * 20 + P.seed * 10));
      } else {
        // puffs grow as they spread out, then shrink away
        size = (T.size[0] + (T.size[1] - T.size[0]) * Math.min(1, t * 1.6)) * (t > 0.75 ? (1 - t) / 0.25 : 1);
      }
      e.set(P.rot.x, P.rot.y, P.rot.z);
      q.setFromEuler(e);
      s.setScalar(size);
      m.compose(P.p, q, s);
      this.mesh.setMatrixAt(n, m);
      this.mesh.setColorAt(n, T.color(t, c, P.seed));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.mesh, this.light);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
