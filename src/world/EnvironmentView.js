// How burning, frozen and diamond trees and buildings look: the original model is hidden and a
// copy is shown with a special material, plus flames, smoke, ice shards and ash.
import * as THREE from 'three';

const HEIGHT = { tree: 3.2, building: 6 }; // roughly how tall things are, for flames and shards
const MAX_FLAMES = 900;
const MAX_SHARDS = 400;
const rand = (a, b) => a + Math.random() * (b - a);

const MATERIALS = {
  // charred wood glowing orange, flickering (see update)
  burning: () => new THREE.MeshLambertMaterial({ vertexColors: true, color: '#7a4a3a', emissive: '#ff5a1a', emissiveIntensity: 0.35 }),
  frozen: () =>
    new THREE.MeshPhongMaterial({ color: '#bfeaff', emissive: '#2f6f9a', emissiveIntensity: 0.35, specular: '#ffffff', shininess: 120, transparent: true, opacity: 0.88 }),
  diamond: () =>
    new THREE.MeshPhongMaterial({ color: '#f2eeff', emissive: '#6a5a9a', emissiveIntensity: 0.35, specular: '#ffffff', shininess: 220, flatShading: true }),
};

// Small particle pool drawn as one InstancedMesh.
class Particles {
  constructor(parent, max, geometry, material) {
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    parent.add(this.mesh);
    this.max = max;
    this.list = [];
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.s = new THREE.Vector3();
    this.c = new THREE.Color();
  }

  spawn(p) {
    if (this.list.length < this.max) this.list.push(p);
  }

  // step(p, dt) → false to remove. look(p, color) → size.
  update(dt, step, look) {
    let n = 0;
    for (let i = this.list.length - 1; i >= 0; i--) if (step(this.list[i], dt) === false) this.list.splice(i, 1);
    for (const p of this.list) {
      const size = look(p, this.c);
      this.e.set(p.rot?.x ?? 0, p.rot?.y ?? 0, p.rot?.z ?? 0);
      this.q.setFromEuler(this.e);
      this.s.setScalar(size);
      this.mesh.setMatrixAt(n, this.m.compose(p.pos, this.q, this.s));
      this.mesh.setColorAt(n, this.c);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

export class EnvironmentView {
  constructor(scene, worldView) {
    this.scene = scene;
    this.worldView = worldView;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.materials = { burning: MATERIALS.burning(), frozen: MATERIALS.frozen(), diamond: MATERIALS.diamond() };
    this.overlays = new Map(); // obj id → mesh
    this.collapsing = []; // burnt things sinking away

    // flames and smoke: little cubes that rise, flicker from yellow to red, then turn to grey smoke
    this.flames = new Particles(this.group, MAX_FLAMES, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    // ice shards from shattering
    this.shards = new Particles(
      this.group,
      MAX_SHARDS,
      new THREE.OctahedronGeometry(1, 0).scale(0.5, 1.4, 0.5),
      new THREE.MeshPhongMaterial({ color: '#d8f4ff', emissive: '#3a7aa0', emissiveIntensity: 0.4, shininess: 120, transparent: true, opacity: 0.9 }),
    );
    this.shards.mesh.castShadow = true;
    // ash left behind where something burnt away
    this.ash = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.04, 1), new THREE.MeshLambertMaterial({ color: '#3b3330' }), 600);
    this.ash.count = 0;
    this.ash.receiveShadow = true;
    this.group.add(this.ash);
    this.light = new THREE.PointLight('#ff7a2a', 0, 14, 1.4);
    this.group.add(this.light);
    this.time = 0;
    this.emitCarry = 0;
  }

  // The original mesh for an object and the matrix that places it in the world.
  original(obj) {
    if (obj.type === 'tree') {
      const t = this.worldView.treeInstances.get(obj.tiles[0]);
      if (!t) return null;
      const matrix = new THREE.Matrix4();
      t.mesh.getMatrixAt(t.index, matrix);
      return { geometry: t.mesh.geometry, matrix, hide: () => this.hideTree(t) };
    }
    const mesh = this.worldView.buildingMeshes[obj.building];
    mesh.updateMatrixWorld(true);
    return { geometry: mesh.geometry, matrix: mesh.matrixWorld.clone(), hide: () => (mesh.visible = false) };
  }

  hideTree(t) {
    t.mesh.setMatrixAt(t.index, new THREE.Matrix4().makeScale(0, 0, 0));
    t.mesh.instanceMatrix.needsUpdate = true;
  }

  // An object changed state (see environment.js).
  show(obj, how) {
    const old = this.overlays.get(obj.id);
    if (obj.state === 'gone') {
      if (how === 'shattered') {
        if (old) this.removeOverlay(obj);
        this.shatter(obj);
      } else if (old) {
        // burnt: sink into the ground and leave ash
        this.overlays.delete(obj.id);
        this.collapsing.push({ mesh: old, t: 0, base: old.matrix.clone() });
        this.addAsh(obj);
      }
      return;
    }
    const src = old ? { geometry: old.geometry, matrix: old.matrix } : this.original(obj);
    if (!src) return;
    if (!old) src.hide();
    if (old) this.group.remove(old);
    const mesh = new THREE.Mesh(src.geometry, this.materials[obj.state]);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(src.matrix);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.overlays.set(obj.id, mesh);
  }

  removeOverlay(obj) {
    this.group.remove(this.overlays.get(obj.id));
    this.overlays.delete(obj.id);
  }

  addAsh(obj) {
    if (this.ash.count >= this.ash.instanceMatrix.count) return;
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(obj.x + obj.w / 2, 0.27, obj.z + obj.d / 2),
      new THREE.Quaternion(),
      new THREE.Vector3(obj.w * 0.9, 1, obj.d * 0.9),
    );
    this.ash.setMatrixAt(this.ash.count++, m);
    this.ash.instanceMatrix.needsUpdate = true;
    this.ash.computeBoundingSphere();
  }

  shatter(obj) {
    const n = obj.type === 'tree' ? 26 : 70;
    const h = HEIGHT[obj.type];
    for (let i = 0; i < n; i++) {
      this.shards.spawn({
        pos: new THREE.Vector3(obj.x + Math.random() * obj.w, 0.3 + Math.random() * h, obj.z + Math.random() * obj.d),
        vel: new THREE.Vector3(rand(-3, 3), rand(1, 5), rand(-3, 3)),
        rot: new THREE.Vector3(rand(0, 6), rand(0, 6), rand(0, 6)),
        spin: new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)),
        size: rand(0.06, obj.type === 'tree' ? 0.16 : 0.26),
        age: 0,
        life: rand(1.2, 2),
      });
    }
  }

  // burning: the burning objects (from Environment)
  update(dt, burning) {
    this.time += dt;
    // flicker the burning glow
    this.materials.burning.emissiveIntensity = 0.3 + Math.sin(this.time * 17) * 0.06 + Math.sin(this.time * 5.3) * 0.05;

    // new flames, shared out across everything on fire
    const list = [...burning];
    if (list.length) {
      this.emitCarry += Math.min(420, list.length * (list.length < 4 ? 40 : 22)) * dt;
      while (this.emitCarry >= 1) {
        this.emitCarry -= 1;
        const o = list[Math.floor(Math.random() * list.length)];
        const h = HEIGHT[o.type] * (1 - Math.min(1, o.time / 20) * 0.5);
        this.flames.spawn({
          pos: new THREE.Vector3(o.x + Math.random() * o.w, 0.3 + Math.random() * h, o.z + Math.random() * o.d),
          vel: new THREE.Vector3(rand(-0.3, 0.3), rand(1.2, 2.4), rand(-0.3, 0.3)),
          rot: new THREE.Vector3(0, rand(0, 3), 0),
          size: rand(0.18, o.type === 'tree' ? 0.42 : 0.65),
          age: 0,
          life: rand(0.8, 1.6),
          seed: Math.random(),
        });
      }
      // a warm light on the nearest bit of fire to the camera centre
      const o = list[0];
      this.light.position.set(o.x + o.w / 2, 1.5, o.z + o.d / 2);
      this.light.intensity = 6 + Math.random() * 2;
    } else this.light.intensity = 0;

    const flameColors = ['#fff3a0', '#ffd23f', '#ff8a1f', '#e8401c'];
    const smoke = new THREE.Color('#5d5654');
    this.flames.update(
      dt,
      (p, dt) => {
        p.age += dt;
        p.pos.addScaledVector(p.vel, dt);
        return p.age < p.life;
      },
      (p, c) => {
        const t = p.age / p.life;
        if (t < 0.6) {
          const k = (t / 0.6) * (flameColors.length - 1), i = Math.min(flameColors.length - 2, Math.floor(k));
          c.set(flameColors[i]).lerp(new THREE.Color(flameColors[i + 1]), k - i);
        } else c.copy(smoke).multiplyScalar(1.2 - (t - 0.6));
        return p.size * (t < 0.6 ? 1 - t * 0.6 : 0.7 + (t - 0.6)); // shrink as flames, puff up as smoke
      },
    );

    this.shards.update(
      dt,
      (p, dt) => {
        p.age += dt;
        p.vel.y -= 9.8 * dt;
        p.pos.addScaledVector(p.vel, dt);
        p.rot.addScaledVector(p.spin, dt);
        if (p.pos.y < 0.3) {
          p.pos.y = 0.3;
          p.vel.multiplyScalar(0.4);
          p.vel.y = Math.abs(p.vel.y) * 0.5;
          p.spin.multiplyScalar(0.5);
        }
        return p.age < p.life;
      },
      (p, c) => {
        c.setRGB(1, 1, 1);
        const t = p.age / p.life;
        return p.size * (t > 0.7 ? (1 - t) / 0.3 : 1);
      },
    );

    // burnt things sink into the ground
    for (let i = this.collapsing.length - 1; i >= 0; i--) {
      const c = this.collapsing[i];
      c.t += dt / 0.8;
      const k = Math.max(0, 1 - c.t);
      const pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      c.base.decompose(pos, q, s);
      c.mesh.matrix.compose(pos, q, s.set(s.x * (0.6 + 0.4 * k), s.y * k, s.z * (0.6 + 0.4 * k)));
      if (c.t >= 1) {
        this.group.remove(c.mesh);
        this.collapsing.splice(i, 1);
      }
    }
  }

  dispose() {
    this.scene.remove(this.group);
    for (const m of Object.values(this.materials)) m.dispose();
    this.flames.mesh.geometry.dispose();
    this.shards.mesh.geometry.dispose();
    this.ash.geometry.dispose();
  }
}
