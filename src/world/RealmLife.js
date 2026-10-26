// What makes each dragon land feel alive (see realms.js for where things are):
//   landmarks – Ember's volcano (its crater of lava, smoke and sparks), Glimmer's giant glowing
//               crystal tree, Frost's ice castle
//   critters  – snowmen and waddling penguins, lava bubbles and fire sprites, crystal flowers and
//               butterflies
//   the air   – falling snow, drifting embers or floating sparkles round the player while they're in
//               a land, and the haze tinted to match
import * as THREE from 'three';
import { realmAt } from '../realms.js';
import { buildGeometry } from '../voxel/builder.js';
import { crystalTree } from '../voxel/models/trees.js';

const GROUND = 0.25;
const AIR = 260; // weather particles
const AIR_BOX = { x: 30, y: 14, z: 30 }; // the box of air round the player they drift in
const HAZE = { frost: '#cfe3f5', ember: '#d9775a', glimmer: '#e9d4f7' };
const PASTEL = ['#ff9fd0', '#8ff0ff', '#c9a6ff', '#ffe27a', '#ffffff'];
const rand = (a, b) => a + Math.random() * (b - a);

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const glow = (color, k = 0.8) => new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: k });

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// ---- landmarks ----

function volcano(world, L) {
  const g = new THREE.Group();
  const top = world.rockHeight[Math.floor(L.z) * world.width + Math.floor(L.x)] || 6;
  // the crater's lava pool, glowing and bubbling
  const lava = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.2, 18), glow('#ff6a1a', 1));
  lava.position.y = top + 0.1;
  g.add(lava);
  // two lava streams running down the side, following the rock
  const streamMat = glow('#ff7a1a', 0.9);
  for (const a of [0.6, 2.9]) {
    for (let d = 1.6; d < L.r + 0.5; d += 0.5) {
      const x = L.x + Math.cos(a) * d, z = L.z + Math.sin(a) * d;
      const h = world.rockHeight[Math.floor(z) * world.width + Math.floor(x)] || GROUND;
      const blob = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.55), streamMat);
      blob.position.set(x - L.x, h + 0.04, z - L.z);
      g.add(blob);
    }
  }
  const light = new THREE.PointLight('#ff6a1a', 4, 16, 1.4);
  light.position.y = top + 1.5;
  g.add(light);
  g.position.set(L.x, 0, L.z);
  // smoke and sparks rising out of the crater
  const puffs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: '#ffffff' }), 40);
  puffs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(40 * 3), 3);
  puffs.frustumCulled = false;
  g.add(puffs);
  const tmp = new THREE.Object3D(), c = new THREE.Color();
  return {
    group: g,
    update(dt, t) {
      lava.material.emissiveIntensity = 0.85 + Math.sin(t * 3) * 0.15;
      light.intensity = 3.5 + Math.sin(t * 5) * 0.6;
      for (let i = 0; i < 40; i++) {
        const life = (t * 0.18 + i / 40) % 1;
        const spark = i % 5 === 0;
        tmp.position.set(Math.sin(i * 7.1 + life * 2) * (0.6 + life * 2.5), top + 0.4 + life * (spark ? 4 : 9), Math.cos(i * 3.3 + life * 2) * (0.6 + life * 2.5));
        tmp.scale.setScalar(spark ? 0.18 * (1 - life) : 0.4 + life * 1.8);
        tmp.rotation.set(t + i, t * 0.7 + i, 0);
        tmp.updateMatrix();
        puffs.setMatrixAt(i, tmp.matrix);
        puffs.setColorAt(i, spark ? c.set('#ffb030') : c.setRGB(0.32 + life * 0.35, 0.3 + life * 0.35, 0.3 + life * 0.35));
      }
      puffs.instanceMatrix.needsUpdate = true;
      puffs.instanceColor.needsUpdate = true;
    },
  };
}

function giantCrystalTree(world, L) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#8a5aaa', emissiveIntensity: 0.45 });
  const tree = new THREE.Mesh(buildGeometry(crystalTree(7), { size: 1 / 8, origin: [4, 0, 4] }), mat);
  tree.scale.setScalar(5.2);
  tree.castShadow = true;
  g.add(tree);
  // smaller clusters round its foot
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.5;
    const side = new THREE.Mesh(buildGeometry(crystalTree(i), { size: 1 / 8, origin: [4, 0, 4] }), mat);
    side.scale.setScalar(2.4 + (i % 2) * 0.8);
    side.position.set(Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9);
    side.rotation.y = a;
    side.castShadow = true;
    g.add(side);
  }
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 0.3, 24), lambert('#e8d8ff'));
  ring.position.y = GROUND + 0.05;
  g.add(ring);
  const motes = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 30);
  motes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(30 * 3), 3);
  motes.frustumCulled = false;
  for (let i = 0; i < 30; i++) motes.setColorAt(i, new THREE.Color(PASTEL[i % PASTEL.length]));
  g.add(motes);
  g.position.set(L.x, GROUND, L.z);
  const tmp = new THREE.Object3D();
  return {
    group: g,
    update(dt, t) {
      mat.emissiveIntensity = 0.4 + (Math.sin(t * 1.4) + 1) * 0.18;
      for (let i = 0; i < 30; i++) {
        const a = i * 2.4 + t * 0.4, life = (t * 0.12 + i / 30) % 1;
        tmp.position.set(Math.cos(a) * (2 + (i % 3)), 0.5 + life * 13, Math.sin(a) * (2 + (i % 3)));
        tmp.scale.setScalar(Math.sin(life * Math.PI) * 1.5);
        tmp.rotation.y = t * 2 + i;
        tmp.updateMatrix();
        motes.setMatrixAt(i, tmp.matrix);
      }
      motes.instanceMatrix.needsUpdate = true;
    },
  };
}

function iceCastle(world, L) {
  const g = new THREE.Group();
  const ice = new THREE.MeshPhongMaterial({ color: '#cfefff', emissive: '#4a8ab0', emissiveIntensity: 0.25, specular: '#ffffff', shininess: 120, transparent: true, opacity: 0.88 });
  const deep = new THREE.MeshPhongMaterial({ color: '#9fd4f5', emissive: '#2f6f9a', emissiveIntensity: 0.3, shininess: 100 });
  const snow = lambert('#ffffff');
  // the keep, with battlements
  g.add(mesh(new THREE.BoxGeometry(4, 5, 4), ice, 0, 2.5, 0));
  for (let i = 0; i < 4; i++)
    for (let k = -1.5; k <= 1.5; k += 1) {
      const [x, z] = [[k, -2], [k, 2], [-2, k], [2, k]][i];
      g.add(mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), ice, x, 5.3, z));
    }
  // four round towers with pointy snowy roofs and blue flags
  for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) {
    g.add(mesh(new THREE.CylinderGeometry(1, 1.1, 6.5, 10), ice, x, 3.25, z));
    g.add(mesh(new THREE.ConeGeometry(1.35, 2.4, 10), deep, x, 7.7, z));
    g.add(mesh(new THREE.ConeGeometry(0.7, 0.9, 10), snow, x, 8.6, z));
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5), lambert('#ffffff'), x, 9.5, z));
    g.add(mesh(new THREE.BoxGeometry(0.7, 0.4, 0.04), lambert('#3b6fd6'), x + 0.35, 9.9, z));
  }
  // a big door and windows of deep blue ice
  g.add(mesh(new THREE.BoxGeometry(1.4, 2.2, 0.1), deep, 0, 1.1, 2.03));
  for (const x of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.6, 0.9, 0.1), deep, x, 3.4, 2.03));
  // icicles round the keep
  for (let i = 0; i < 16; i++) {
    const side = i % 4, k = -1.75 + Math.floor(i / 4) * 1.15;
    const [x, z] = [[k, -2.05], [k, 2.05], [-2.05, k], [2.05, k]][side];
    const icicle = mesh(new THREE.ConeGeometry(0.1, 0.6, 5), ice, x, 4.65, z);
    icicle.rotation.x = Math.PI;
    g.add(icicle);
  }
  g.position.set(L.x, GROUND, L.z);
  // the castle faces back toward the nest
  const r = world.realms.find((r) => r.landmark === L);
  g.rotation.y = Math.atan2(r.nest.x - L.x, r.nest.z - L.z);
  return { group: g, update(dt, t) { ice.emissiveIntensity = 0.22 + Math.sin(t * 1.1) * 0.06; } };
}

const LANDMARKS = { volcano, crystalTree: giantCrystalTree, iceCastle };

// ---- critters ----

function snowman() {
  const g = new THREE.Group();
  const white = lambert('#ffffff'), coal = lambert('#222222');
  g.add(mesh(new THREE.SphereGeometry(0.5, 12, 10), white, 0, 0.45, 0));
  g.add(mesh(new THREE.SphereGeometry(0.37, 12, 10), white, 0, 1.12, 0));
  g.add(mesh(new THREE.SphereGeometry(0.27, 12, 10), white, 0, 1.62, 0));
  for (const x of [-0.09, 0.09]) g.add(mesh(new THREE.SphereGeometry(0.04, 6, 5), coal, x, 1.7, 0.23));
  const nose = mesh(new THREE.ConeGeometry(0.05, 0.3, 6), lambert('#ff8a2a'), 0, 1.63, 0.38);
  nose.rotation.x = Math.PI / 2;
  g.add(nose);
  for (const s of [-1, 1]) {
    const arm = mesh(new THREE.BoxGeometry(0.6, 0.05, 0.05), lambert('#6b4423'), s * 0.6, 1.25, 0);
    arm.rotation.z = s * -0.5;
    g.add(arm);
  }
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 10), coal, 0, 1.95, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12), coal, 0, 1.81, 0));
  for (const y of [0.55, 0.8, 1.05]) g.add(mesh(new THREE.SphereGeometry(0.04, 6, 5), coal, 0, y, y < 1 ? 0.45 : 0.36));
  return g;
}

export function penguin() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const black = lambert('#22252e'), white = lambert('#ffffff'), orange = lambert('#ff9a2a');
  const b = mesh(new THREE.SphereGeometry(0.3, 12, 10), black, 0, 0.42, 0);
  b.scale.set(1, 1.35, 0.95);
  body.add(b);
  const belly = mesh(new THREE.SphereGeometry(0.24, 12, 10), white, 0, 0.4, 0.1);
  belly.scale.set(1, 1.3, 0.8);
  body.add(belly);
  body.add(mesh(new THREE.SphereGeometry(0.2, 12, 10), black, 0, 0.86, 0));
  const beak = mesh(new THREE.ConeGeometry(0.06, 0.16, 6), orange, 0, 0.84, 0.21);
  beak.rotation.x = Math.PI / 2;
  body.add(beak);
  for (const x of [-0.07, 0.07]) body.add(mesh(new THREE.SphereGeometry(0.03, 6, 5), white, x, 0.92, 0.16));
  for (const x of [-0.1, 0.1]) body.add(mesh(new THREE.BoxGeometry(0.12, 0.04, 0.18), orange, x, 0.02, 0.06));
  for (const s of [-1, 1]) {
    const wing = mesh(new THREE.BoxGeometry(0.06, 0.4, 0.2), black, s * 0.3, 0.48, 0);
    wing.rotation.z = s * 0.25;
    body.add(wing);
  }
  g.add(body);
  g.userData.body = body;
  return g;
}

export function fireSprite() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.IcosahedronGeometry(0.28, 0), glow('#ffb030', 1)));
  const inner = mesh(new THREE.IcosahedronGeometry(0.16, 0), glow('#fff2a8', 1));
  g.add(inner);
  for (const x of [-0.09, 0.09]) g.add(mesh(new THREE.SphereGeometry(0.035, 6, 5), lambert('#3a1a0a'), x, 0.05, 0.25));
  const flame = mesh(new THREE.ConeGeometry(0.16, 0.45, 6), glow('#ff6a1a', 1), 0, 0.32, 0);
  g.add(flame);
  return g;
}

function crystalFlower(color) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), lambert('#7fd1b0'), 0, 0.25, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const petal = mesh(new THREE.OctahedronGeometry(0.12), glow(color, 0.45), Math.cos(a) * 0.12, 0.55, Math.sin(a) * 0.12);
    petal.scale.set(0.6, 1.4, 0.6);
    petal.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8);
    g.add(petal);
  }
  g.add(mesh(new THREE.OctahedronGeometry(0.07), glow('#ffffff', 0.9), 0, 0.56, 0));
  return g;
}

function butterfly(color) {
  const g = new THREE.Group();
  const wingMat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.4, side: THREE.DoubleSide });
  const wings = [-1, 1].map((s) => {
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.18, 8), wingMat);
    w.position.x = s * 0.17;
    const hinge = new THREE.Group();
    hinge.add(w);
    g.add(hinge);
    return hinge;
  });
  g.add(mesh(new THREE.BoxGeometry(0.04, 0.04, 0.22), lambert('#3a3a4a')));
  g.userData.wings = wings;
  return g;
}

export class RealmLife {
  constructor(scene, skyScene, world) {
    this.scene = scene;
    this.skyScene = skyScene;
    this.world = world;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.things = []; // { update(dt, t) }
    for (const r of world.realms ?? []) {
      const L = LANDMARKS[r.landmark.what](world, r.landmark);
      this.group.add(L.group);
      this.things.push(L);
      this.addCritters(r);
    }
    this.buildAir();
    this.mix = 0; // how much the current land's air is showing (0..1)
    this.land = null;
  }

  addCritters(r) {
    const P = r.props;
    const add = (obj, at, y = GROUND) => {
      obj.position.set(at.x, y, at.z);
      obj.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(obj);
      return obj;
    };
    if (r.kind === 'frost') {
      P.snowmen.forEach((at) => add(snowman(), at));
      P.penguins.forEach((home, i) => {
        const p = add(penguin(), home);
        let target = null, wait = rand(0, 3);
        this.things.push({
          update: (dt, t) => {
            const body = p.userData.body;
            if (!target) {
              wait -= dt;
              body.rotation.z = 0;
              body.position.y = Math.max(0, Math.sin(t * 6 + i) * 0.08) * (Math.sin(t * 0.7 + i) > 0.6 ? 1 : 0); // a little hop now and then
              if (wait <= 0) target = { x: home.x + rand(-2.5, 2.5), z: home.z + rand(-2.5, 2.5) };
              return;
            }
            const dx = target.x - p.position.x, dz = target.z - p.position.z, d = Math.hypot(dx, dz);
            p.rotation.y = Math.atan2(dx, dz);
            body.rotation.z = Math.sin(t * 12 + i) * 0.18; // waddle
            body.position.y = 0;
            const step = Math.min(d, dt * 0.7);
            p.position.x += (dx / (d || 1)) * step;
            p.position.z += (dz / (d || 1)) * step;
            if (d < 0.05) {
              target = null;
              wait = rand(1.5, 4);
            }
          },
        });
      });
    } else if (r.kind === 'ember') {
      P.sprites.forEach((home, i) => {
        const s = add(fireSprite(), home, 1.2);
        this.things.push({
          update: (dt, t) => {
            const a = t * 0.5 + i * 1.7;
            s.position.set(home.x + Math.cos(a) * 1.5, 1.1 + Math.sin(t * 2.2 + i) * 0.3, home.z + Math.sin(a * 1.3) * 1.5);
            s.scale.setScalar(1 + Math.sin(t * 9 + i * 3) * 0.08);
            s.rotation.y = a + Math.PI / 2;
          },
        });
      });
      const bubbles = P.bubbles.map((at) => add(mesh(new THREE.SphereGeometry(0.34, 10, 8), glow('#ffc23d', 1)), at, 0.2));
      this.things.push({
        update: (dt, t) =>
          bubbles.forEach((b, i) => {
            const k = (t * 0.45 + i * 0.37) % 1; // grows, then pops
            b.scale.setScalar(k < 0.85 ? 0.3 + k * 1.2 : 0.001);
          }),
      });
    } else {
      P.flowers.forEach((at, i) => {
        const f = add(crystalFlower(PASTEL[i % 4]), at);
        f.scale.setScalar(2.1);
      });
      P.butterflies.forEach((home, i) => {
        const b = add(butterfly(PASTEL[i % 4]), home, 1);
        this.things.push({
          update: (dt, t) => {
            const a = t * 0.6 + i * 2.1;
            const x = home.x + Math.sin(a) * 2.2, z = home.z + Math.sin(a * 2) * 1.2;
            b.rotation.y = Math.atan2(x - b.position.x, z - b.position.z);
            b.position.set(x, 1 + Math.sin(t * 1.7 + i) * 0.35, z);
            const flap = Math.sin(t * 16 + i) * 0.9;
            b.userData.wings[0].rotation.z = flap;
            b.userData.wings[1].rotation.z = -flap;
          },
        });
      });
    }
  }

  // Weather particles that drift round the player: snow, embers or sparkles.
  buildAir() {
    this.air = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }), AIR);
    this.air.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(AIR * 3), 3);
    this.air.frustumCulled = false;
    this.air.visible = false;
    this.scene.add(this.air);
    this.motes = Array.from({ length: AIR }, () => ({
      p: new THREE.Vector3(rand(-1, 1) * AIR_BOX.x / 2, rand(0, AIR_BOX.y), rand(-1, 1) * AIR_BOX.z / 2),
      seed: Math.random(),
    }));
    this.tmp = new THREE.Object3D();
    this.c = new THREE.Color();
  }

  // player: { x, z } (where the player, or their dragon, is)
  update(dt, t, player) {
    for (const th of this.things) th.update(dt, t);
    const land = player ? realmAt(this.world, Math.floor(player.x), Math.floor(player.z)) : null;
    if (land) this.land = land;
    this.mix += ((land ? 1 : 0) - this.mix) * Math.min(1, dt * 1.5);
    this.air.visible = this.mix > 0.02 && !!this.land;
    if (!this.land) return;
    this.tint(this.land.kind);
    if (this.air.visible) this.updateAir(dt, t, player, this.land.kind);
  }

  // the haze (fog and sky) takes on the land's colour, as bright as the sky already is
  tint(kind) {
    const k = this.mix * 0.55;
    if (k < 0.01) return;
    const haze = this.c.set(HAZE[kind]);
    for (const col of [this.scene.fog?.color, this.skyScene.background]) {
      if (!col?.isColor) continue;
      const bright = (col.r + col.g + col.b) / 3, hb = (haze.r + haze.g + haze.b) / 3;
      const target = haze.clone().multiplyScalar(Math.max(0.12, bright / hb));
      col.lerp(target, k);
    }
  }

  updateAir(dt, t, player, kind) {
    const half = { x: AIR_BOX.x / 2, z: AIR_BOX.z / 2 };
    for (let i = 0; i < AIR; i++) {
      const m = this.motes[i], p = m.p;
      if (kind === 'frost') {
        p.y -= dt * (0.9 + m.seed * 0.6);
        p.x += Math.sin(t * 0.8 + m.seed * 20) * dt * 0.4;
      } else if (kind === 'ember') {
        p.y += dt * (0.5 + m.seed * 0.8);
        p.x += Math.sin(t * 1.3 + m.seed * 20) * dt * 0.3;
      } else {
        p.y += Math.sin(t * 0.9 + m.seed * 30) * dt * 0.25;
        p.x += Math.cos(t * 0.5 + m.seed * 30) * dt * 0.2;
      }
      if (p.y < 0) p.y += AIR_BOX.y;
      if (p.y > AIR_BOX.y) p.y -= AIR_BOX.y;
      if (p.x < -half.x) p.x += AIR_BOX.x;
      if (p.x > half.x) p.x -= AIR_BOX.x;
      const size = (kind === 'frost' ? 0.09 : kind === 'ember' ? 0.07 : 0.08 * (0.6 + Math.sin(t * 4 + m.seed * 40) * 0.5)) * this.mix;
      this.tmp.position.set(player.x + p.x, p.y, player.z + p.z);
      this.tmp.scale.setScalar(Math.max(0.001, size));
      this.tmp.rotation.set(t + m.seed * 9, t * 0.7 + m.seed * 5, 0);
      this.tmp.updateMatrix();
      this.air.setMatrixAt(i, this.tmp.matrix);
      if (kind === 'frost') this.c.set(m.seed < 0.7 ? '#ffffff' : '#dcecff');
      else if (kind === 'ember') this.c.set(m.seed < 0.45 ? '#ff8a2a' : m.seed < 0.6 ? '#ffd23f' : '#5a504c');
      else this.c.set(PASTEL[Math.floor(m.seed * PASTEL.length)]);
      this.air.setColorAt(i, this.c);
    }
    this.air.instanceMatrix.needsUpdate = true;
    this.air.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.group, this.air);
    this.group.traverse((o) => o.geometry?.dispose());
    this.air.geometry.dispose();
  }
}
