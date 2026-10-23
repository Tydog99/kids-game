// How the Sky Pitch looks: a striped oval of grass with white lines, tall golden goal hoops at
// each end, towers of stands in four team colours with flags, rolling hills all around, the race
// rings, and fireworks for the finish. Built in pitch coordinates inside a group placed off the
// edge of the world map.
import * as THREE from 'three';
import { PITCH, HOOPS, RING_RADIUS, towers } from './course.js';

const GROUND = 0.25;
const TEAM = [
  ['#9b1c22', '#f2b632'], // scarlet and gold
  ['#1d6b3a', '#c9ced6'], // green and silver
  ['#1f3f8f', '#b07a3b'], // blue and bronze
  ['#e8c21a', '#2a2a2a'], // yellow and black
];

function fieldTexture() {
  const W = 512, H = Math.round((W * PITCH.b) / PITCH.a);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  // mown stripes, clipped to the oval
  g.save();
  g.beginPath();
  g.ellipse(W / 2, H / 2, W / 2 - 2, H / 2 - 2, 0, 0, Math.PI * 2);
  g.clip();
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? '#5fb04a' : '#69bd53';
    g.fillRect((i * W) / 16, 0, W / 16 + 1, H);
  }
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 4;
  g.beginPath();
  g.ellipse(W / 2, H / 2, W / 2 - 6, H / 2 - 6, 0, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(W / 2, H / 2, H * 0.12, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(W / 2, 6);
  g.lineTo(W / 2, H - 6);
  g.stroke();
  // goal areas at each end
  for (const x of [W * 0.1, W * 0.9]) {
    g.beginPath();
    g.ellipse(x, H / 2, W * 0.07, H * 0.25, 0, 0, Math.PI * 2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class SkyPitch {
  // offset: where the pitch's centre is, in world coordinates
  constructor(scene, offset) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.position.set(offset.x, 0, offset.z);
    this.group.visible = false;
    scene.add(this.group);
    const add = (geo, mat, x, y, z, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    this.mats = [];
    const mat = (color, extra = {}) => {
      const m = new THREE.MeshLambertMaterial({ color, ...extra });
      this.mats.push(m);
      return m;
    };

    // the meadow all around, and the pitch on it
    const meadow = add(new THREE.CircleGeometry(PITCH.wall + 40, 64), mat('#4f9a3f'), 0, GROUND - 0.02, 0, false);
    meadow.rotation.x = -Math.PI / 2;
    this.fieldTex = fieldTexture();
    const field = add(new THREE.PlaneGeometry(PITCH.a * 2, PITCH.b * 2), mat('#ffffff', { map: this.fieldTex, transparent: true }), 0, GROUND, 0, false);
    field.rotation.x = -Math.PI / 2;

    // rolling hills of trees round the edge, so the world beyond is a green horizon
    const hillMat = mat('#3f7f36'), hillMat2 = mat('#356f2e');
    const hillGeo = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    for (let i = 0; i < 46; i++) {
      const th = (i / 46) * Math.PI * 2, r = PITCH.wall + 8 + (i % 3) * 5;
      const h = add(hillGeo, i % 2 ? hillMat : hillMat2, Math.cos(th) * r, GROUND - 0.1, Math.sin(th) * r, false);
      h.scale.set(9 + (i % 4) * 2, 5 + ((i * 7) % 5) * 1.6, 9 + (i % 3) * 2);
    }

    // towers of stands in team colours, with a striped cloth, a stand on top and a flag
    const wood = mat('#8a6239'), seat = mat('#d9cdb4');
    for (const t of towers()) {
      const [cloth, trim] = TEAM[t.colour].map((c) => mat(c));
      const height = PITCH.towerTop - 4;
      add(new THREE.BoxGeometry(3.4, height, 3.4), cloth, t.x, GROUND + height / 2, t.z);
      for (let y = 1.5; y < height; y += 2.4) add(new THREE.BoxGeometry(3.5, 0.5, 3.5), trim, t.x, GROUND + y, t.z, false);
      add(new THREE.BoxGeometry(4.6, 0.5, 4.6), wood, t.x, GROUND + height + 0.25, t.z);
      add(new THREE.BoxGeometry(4.2, 1, 1), seat, t.x, GROUND + height + 1, t.z);
      const roof = add(new THREE.ConeGeometry(3.3, 3, 4), cloth, t.x, GROUND + height + 3, t.z);
      roof.rotation.y = Math.PI / 4;
      add(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), wood, t.x, GROUND + height + 5.4, t.z, false);
      const flag = add(new THREE.BoxGeometry(1.2, 0.7, 0.05), trim, t.x + 0.6, GROUND + height + 6, t.z, false);
      flag.userData.wave = Math.random() * 6;
      (this.flags ??= []).push(flag);
    }

    // the goal hoops: tall golden poles with a hoop on top, facing down the pitch
    const gold = new THREE.MeshPhongMaterial({ color: '#f5c542', emissive: '#6b4a00', emissiveIntensity: 0.35, shininess: 80 });
    this.mats.push(gold);
    for (const h of HOOPS) {
      add(new THREE.CylinderGeometry(0.14, 0.2, h.height - h.radius, 8), gold, h.x, GROUND + (h.height - h.radius) / 2, h.z);
      const hoop = add(new THREE.TorusGeometry(h.radius, 0.16, 8, 32), gold, h.x, h.height, h.z);
      hoop.rotation.y = Math.PI / 2;
    }

    // the race rings
    this.ringMat = [];
    this.rings = [];
    this.ringGroup = new THREE.Group();
    this.group.add(this.ringGroup);
    this.light = new THREE.PointLight('#ffd86b', 0, 12, 1.4);
    this.group.add(this.light);

    // fireworks
    this.sparks = [];
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkPos = new Float32Array(3 * 1200);
    this.sparkCol = new Float32Array(3 * 1200);
    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
    this.sparkGeo.setAttribute('color', new THREE.BufferAttribute(this.sparkCol, 3));
    this.fireworks = new THREE.Points(this.sparkGeo, new THREE.PointsMaterial({ size: 0.7, vertexColors: true, transparent: true, depthWrite: false, fog: false }));
    this.fireworks.frustumCulled = false;
    this.group.add(this.fireworks);
  }

  // Show the course: rings in pitch coordinates (from raceCourse()).
  setCourse(rings) {
    for (const m of this.rings) this.ringGroup.remove(m);
    this.rings = rings.map((r) => {
      if (r.goal) {
        // the goal hoop itself is the last ring: a glowing disc shows it's the one to fly through
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(2.3, 32),
          new THREE.MeshBasicMaterial({ color: '#ffe680', transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }),
        );
        disc.position.set(r.x, r.y, r.z);
        disc.rotation.y = Math.PI / 2;
        this.ringGroup.add(disc);
        return disc;
      }
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(RING_RADIUS, 0.22, 10, 40),
        new THREE.MeshPhongMaterial({ color: '#ffd23f', emissive: '#a36a00', emissiveIntensity: 0.5, transparent: true, opacity: 1 }),
      );
      m.position.set(r.x, r.y, r.z);
      m.rotation.y = r.heading;
      this.ringGroup.add(m);
      return m;
    });
  }

  // next: the index of the ring to fly through next (rings before it are done)
  update(dt, t, next) {
    this.rings.forEach((m, i) => {
      const done = i < next, current = i === next, soon = i === next + 1;
      m.visible = !done;
      if (done) return;
      const mat = m.material;
      if (m.geometry.type === 'CircleGeometry') {
        mat.opacity = current ? 0.35 + Math.sin(t * 5) * 0.15 : 0.12;
        return;
      }
      mat.opacity = current ? 1 : soon ? 0.6 : 0.28;
      mat.emissiveIntensity = current ? 0.9 + Math.sin(t * 6) * 0.4 : 0.3;
      m.scale.setScalar(current ? 1 + Math.sin(t * 6) * 0.04 : 1);
    });
    const cur = this.rings[next];
    this.light.intensity = cur ? 3 : 0;
    if (cur) this.light.position.copy(cur.position);
    for (const f of this.flags ?? []) f.rotation.y = Math.sin(t * 3 + f.userData.wave) * 0.4;
    this.updateFireworks(dt);
  }

  // A burst of fireworks at (x, y, z) in pitch coordinates.
  burst(x, y, z, color) {
    const c = new THREE.Color(color);
    for (let i = 0; i < 90; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = 5 + Math.random() * 3;
      const r = Math.sqrt(1 - u * u);
      this.sparks.push({ p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(Math.cos(a) * r * s, u * s, Math.sin(a) * r * s), c, life: 1.4 + Math.random() * 0.6 });
    }
    if (this.sparks.length > 1200) this.sparks.splice(0, this.sparks.length - 1200);
  }

  updateFireworks(dt) {
    let n = 0;
    this.sparks = this.sparks.filter((s) => (s.life -= dt) > 0);
    for (const s of this.sparks) {
      s.v.y -= 4 * dt;
      s.v.multiplyScalar(1 - dt * 0.8);
      s.p.addScaledVector(s.v, dt);
      const fade = Math.min(1, s.life * 1.5);
      this.sparkPos.set([s.p.x, s.p.y, s.p.z], n * 3);
      this.sparkCol.set([s.c.r * fade, s.c.g * fade, s.c.b * fade], n * 3);
      n++;
    }
    this.sparkGeo.setDrawRange(0, n);
    this.sparkGeo.attributes.position.needsUpdate = true;
    this.sparkGeo.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => o.geometry?.dispose());
    for (const m of this.mats) m.dispose();
    this.fieldTex.dispose();
  }
}
