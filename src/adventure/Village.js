// Chapter 4 in the game: the three villagers, their things (a bonfire, an ice-cream cart and a stone
// dragon statue), and catching the breath of the dragon you ride on those things.
import * as THREE from 'three';
import { Villager } from './Villager.js';
import { VILLAGERS, HITS_NEEDED, breathHit, placeVillagers } from './village.js';
import { placeQuestItems } from './questItems.js';
import { Dragon } from '../creatures/Dragon.js';
import { randomLook } from '../voxel/models/looks.js';
import { speak } from '../ui/speak.js';
import { ShowShot } from './ShowShot.js';
import { rainbowDiamond } from '../world/diamondMaterial.js';

const GROUND = 0.25;
const TALK_RANGE = 4.5;
const HIT_RANGE = 2.3; // breath this close (sideways) to a thing reaches it
const HIT_TOP = 4; // …and this low
const BEAM = { ember: '#ff8a4a', frost: '#9fdcff', glimmer: '#7af0c8' };

// ---- the things ----

function bonfire() {
  const g = new THREE.Group();
  const stone = new THREE.MeshLambertMaterial({ color: '#8d8d8d' });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.32), stone);
    s.position.set(Math.cos(a) * 0.95, 0.11, Math.sin(a) * 0.95);
    s.rotation.y = a;
    g.add(s);
  }
  const wood = new THREE.MeshLambertMaterial({ color: '#7a5230' });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.9, 6), wood);
    log.position.set(Math.cos(a) * 0.32, 0.8, Math.sin(a) * 0.32);
    log.rotation.set(Math.sin(a) * 0.38, 0, -Math.cos(a) * 0.38);
    g.add(log);
  }
  // flames (shown once lit)
  const flames = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', vertexColors: false }), 40);
  flames.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(40 * 3), 3);
  flames.frustumCulled = false;
  g.add(flames);
  const light = new THREE.PointLight('#ff9a3c', 0, 9, 1.5);
  light.position.y = 1.4;
  g.add(light);
  return { group: g, flames, light, top: 2.2 };
}

function cart() {
  const g = new THREE.Group();
  const add = (geo, color, x, y, z) => {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  add(new THREE.BoxGeometry(1.6, 0.8, 0.9), '#f5e6c8', 0, 0.75, 0);
  add(new THREE.BoxGeometry(1.64, 0.14, 0.94), '#f07fae', 0, 0.42, 0);
  for (const [x, z] of [[-0.55, 0.48], [0.55, 0.48], [-0.55, -0.48], [0.55, -0.48]]) {
    const w = add(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 14), '#3a3a3a', x, 0.22, z);
    w.rotation.x = Math.PI / 2;
  }
  for (const [x, z] of [[-0.72, 0.38], [0.72, 0.38], [-0.72, -0.38], [0.72, -0.38]]) add(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), '#ffffff', x, 1.75, z);
  // striped canopy
  for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.3, 0.1, 1.1), i % 2 ? '#ffffff' : '#f07fae', -0.75 + i * 0.3, 2.38, 0);
  // the tub: empty and dark, then full of ice and ice cream
  add(new THREE.BoxGeometry(1.2, 0.08, 0.6), '#5a4a3a', 0, 1.16, 0);
  const full = new THREE.Group();
  const ice = new THREE.MeshPhongMaterial({ color: '#d8f4ff', emissive: '#4a7a9a', emissiveIntensity: 0.3, shininess: 90, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), ice);
    c.position.set(-0.45 + (i % 5) * 0.22, 1.25 + Math.floor(i / 5) * 0.12, -0.18 + ((i * 7) % 3) * 0.18);
    c.rotation.set(i, i * 2, 0);
    full.add(c);
  }
  ['#f7c6d9', '#fff3d6', '#8a5236', '#bff0c8'].forEach((col, i) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshLambertMaterial({ color: col }));
    s.position.set(-0.4 + i * 0.27, 1.5, 0.05);
    full.add(s);
  });
  full.scale.setScalar(0.001);
  g.add(full);
  return { group: g, full, top: 2.6 };
}

function statue() {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshLambertMaterial({ color: '#9a9a9a' });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 1.5), new THREE.MeshLambertMaterial({ color: '#7d7468' }));
  plinth.position.y = 0.35;
  plinth.castShadow = true;
  g.add(plinth);
  const d = new Dragon('glimmer');
  d.setMode('sit');
  for (let i = 0; i < 90; i++) d.update(1 / 60);
  const diamond = rainbowDiamond();
  d.root.traverse((o) => {
    if (o.isMesh) {
      o.material = stoneMat;
      o.castShadow = true;
    }
  });
  d.root.scale.setScalar(0.62);
  d.root.position.y = 0.7;
  g.add(d.root);
  const sparkles = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 16);
  sparkles.frustumCulled = false;
  sparkles.visible = false;
  g.add(sparkles);
  return { group: g, dragon: d, stoneMat, diamond, sparkles, top: 3.2 };
}

const BUILD = { bonfire, cart, statue };

export class Village {
  // progress: the adventure progress (adventure.js); story: the Story (for Ollie and the magic
  // ring, which villagers stay away from); onHelped(kind) when a villager is helped
  constructor(game, progress, { story, onHelped = () => {}, nag = () => {} } = {}) {
    this.g = game;
    this.progress = progress;
    this.onHelped = onHelped;
    this.nag = nag;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    const c = game.hunt.chest;
    const items = placeQuestItems(game.world, game.startTile(), [{ x: c.x, z: c.z, solid: true }]);
    const keepClear = [
      { x: c.x, z: c.z },
      { x: Math.floor(story.ollie.x), z: Math.floor(story.ollie.z) },
      ...game.dragons.list.filter((d) => d.restSpot).map((d) => ({ x: Math.floor(d.restSpot.x), z: Math.floor(d.restSpot.z) })),
      items.egg,
      items.flower,
      ...items.gems,
    ];
    if (story.race) keepClear.push({ x: Math.floor(story.race.ringAt.x), z: Math.floor(story.race.ringAt.z) });
    const placed = placeVillagers(game.world, game.startTile(), (x, z) => game.walkable(x, z) === true, keepClear);
    this.jobs = placed.map((p, i) => {
      const spec = VILLAGERS[p.kind];
      const look = randomLook(spec.look, 1000 + i * 77 + game.world.seed.length);
      const person = new Villager(game.scene, p.villager.x, p.villager.z, spec.look, look);
      const view = BUILD[spec.thing]();
      view.group.position.set(p.thing.x + 0.5, GROUND, p.thing.z + 0.5);
      view.group.rotation.y = Math.atan2(p.villager.x - p.thing.x - 0.5, p.villager.z - p.thing.z - 0.5);
      this.group.add(view.group);
      return { kind: p.kind, spec, person, view, at: { x: p.thing.x + 0.5, z: p.thing.z + 0.5 }, hits: 0, done: !!progress.helped[p.kind], cheer: 0, lit: 0 };
    });
    this.markers = new Map();
    this.shown = null;
    this.heard = new Set(); // lines already said by themselves; after that, press E to hear them
    this.sync();
  }

  // Show who still needs help (a beam over them), and finished jobs as finished.
  sync() {
    for (const job of this.jobs) {
      job.done = job.done || !!this.progress.helped[job.kind];
      if (job.done) job.lit = Math.max(job.lit, 1);
      const want = !job.done && (this.progress.chapter === 'village');
      const has = this.markers.get(job.kind);
      if (want && !has) this.markers.set(job.kind, this.g.treasureView.addMarker(Math.floor(job.at.x), Math.floor(job.at.z), BEAM[job.kind]));
      if (!want && has) {
        this.g.treasureView.removeMarker(has);
        this.markers.delete(job.kind);
      }
    }
  }

  get obstacles() {
    return this.jobs.flatMap((j) => [j.person.obstacle, { x: j.at.x, z: j.at.z, r: 0.7 }]);
  }

  update(dt, t) {
    const g = this.g;
    const p = g.playerInfo();
    this.catchBreath();

    // the closest villager talks when you first come near (each line once by itself; E repeats it)
    let near = null;
    for (const job of this.jobs) {
      const d = Math.hypot(p.x - job.person.x, p.z - job.person.z);
      if (d < TALK_RANGE && (!near || d < near.d)) near = { job, d };
    }
    const text = near ? (near.job.done ? near.job.spec.thanks : near.job.spec.want) : null;
    if (near && this.shown !== text && !this.heard.has(text) && !g.cutscene) this.say(near.job, text);
    else if (!near && this.shown) {
      g.hud.hideSpeech(this.shown);
      this.shown = null;
    }

    for (const job of this.jobs) {
      job.cheer -= dt;
      job.person.cheering = job.cheer > 0;
      job.person.update(dt, t, p, this.shown && near?.job === job);
      this.animate(job, dt, t);
    }
  }

  say(job, text) {
    this.shown = text;
    this.heard.add(text);
    this.g.hud.showSpeech({ who: job.spec.name, text, onRead: () => speak(text) });
    speak(text);
  }

  // The villager close enough to talk to with E: { name, talk() }, or null.
  talker() {
    const p = this.g.playerInfo();
    const job = this.jobs.find((j) => Math.hypot(p.x - j.person.x, p.z - j.person.z) < 2.2);
    return job ? { name: job.spec.name, talk: () => this.say(job, job.done ? job.spec.thanks : job.spec.want) } : null;
  }

  // Breath from the dragon you're riding reaching a villager's thing.
  catchBreath() {
    const d = this.g.riding?.dragon;
    if (!d?.breath) return;
    for (const P of d.breath.particles) {
      if (P.village) continue;
      for (const job of this.jobs) {
        if (job.done) continue;
        if (Math.hypot(P.p.x - job.at.x, P.p.z - job.at.z) > HIT_RANGE || P.p.y > HIT_TOP) continue;
        P.village = true;
        const next = breathHit(job, d.spec.breath);
        job.hits = next.hits;
        if (next.wrong) {
          this.nag(job.spec.wrong);
          continue;
        }
        if (next.done) this.helped(job);
      }
    }
  }

  helped(job) {
    job.done = true;
    job.cheer = 5;
    this.say(job, job.spec.thanks);
    this.g.hud.showBanner(`You helped ${job.spec.name}! 🎉`, true);
    // look at what you did: the camera swings round to the thing and the cheering villager
    if (!this.g.cutscene) {
      const vx = job.person.x - job.at.x, vz = job.person.z - job.at.z, n = Math.hypot(vx, vz) || 1;
      const sx = -vz / n, sz = vx / n; // to the side of the line from the thing to the villager
      const mid = { x: (job.at.x + job.person.x) / 2, z: (job.at.z + job.person.z) / 2 };
      const r = this.g.riding;
      const side = r && (r.x - mid.x) * sx + (r.z - mid.z) * sz < 0 ? -1 : 1; // the side you're on
      // somewhere open to look from (not inside a house or a tree), on your side if possible
      const clear = (x, z) => [0.5, 0.75, 1].every((k) => this.g.walkable(Math.floor(mid.x + (x - mid.x) * k), Math.floor(mid.z + (z - mid.z) * k)) === true);
      let at = null;
      for (const dist of [6, 5, 4, 3])
        for (const sd of [side, -side]) {
          const x = mid.x + sx * sd * dist, z = mid.z + sz * sd * dist;
          if (!at && clear(x, z)) at = { x, y: 2.4, z };
        }
      at ??= { x: mid.x + sx * side * 4, y: 4, z: mid.z + sz * side * 4 };
      this.g.cutscene = new ShowShot(at, { x: mid.x, y: 1.1, z: mid.z }, 3.2);
    }
    this.onHelped(job.kind);
    this.sync();
  }

  animate(job, dt, t) {
    const v = job.view;
    const k = job.done ? 1 : job.hits / HITS_NEEDED; // how far along the job is
    job.lit += (k - job.lit) * Math.min(1, dt * 3);
    const f = job.lit;
    if (job.spec.thing === 'bonfire') {
      // flames that grow as it catches
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
      for (let i = 0; i < 40; i++) {
        const life = (t * (0.8 + (i % 5) * 0.12) + i * 0.37) % 1;
        const a = i * 2.4;
        p.set(Math.cos(a) * 0.3 * (1 - life), 0.5 + life * 1.9 * f, Math.sin(a) * 0.3 * (1 - life));
        const size = (0.32 - life * 0.25) * f;
        s.setScalar(Math.max(0.0001, size));
        q.setFromEuler(new THREE.Euler(t * 2 + i, t * 3 + i, 0));
        m.compose(p, q, s);
        v.flames.setMatrixAt(i, m);
        c.set(life < 0.3 ? '#fff2a8' : life < 0.65 ? '#ffb030' : '#ff5a1f');
        v.flames.setColorAt(i, c);
      }
      v.flames.instanceMatrix.needsUpdate = true;
      v.flames.instanceColor.needsUpdate = true;
      v.light.intensity = f * (3 + Math.sin(t * 13) * 0.6 + Math.sin(t * 7.3) * 0.4);
    } else if (job.spec.thing === 'cart') {
      v.full.scale.setScalar(Math.max(0.001, f));
    } else if (job.spec.thing === 'statue') {
      // stone turning to diamond
      v.stoneMat.color.set('#9a9a9a').lerp(new THREE.Color('#c8fff4'), f);
      if (f > 0.98 && !v.shiny) {
        v.shiny = true;
        v.dragon.root.traverse((o) => o.isMesh && (o.material = v.diamond));
      }
      v.diamond.userData.time.value = t;
      v.sparkles.visible = f > 0.98;
      if (v.sparkles.visible) {
        const o = new THREE.Object3D();
        for (let i = 0; i < 16; i++) {
          const a = i * 2.39 + t * 0.6, life = (t * 0.7 + i / 16) % 1;
          o.position.set(Math.cos(a) * 0.9, 0.9 + life * 2, Math.sin(a) * 0.9);
          o.scale.setScalar(Math.sin(life * Math.PI) * 1.4);
          o.rotation.y = t * 4 + i;
          o.updateMatrix();
          v.sparkles.setMatrixAt(i, o.matrix);
        }
        v.sparkles.instanceMatrix.needsUpdate = true;
      }
    }
  }

  dispose() {
    for (const [, m] of this.markers) this.g.treasureView.removeMarker(m);
    for (const job of this.jobs) job.person.dispose();
    this.g.scene.remove(this.group);
    this.group.traverse((o) => o.geometry?.dispose());
  }
}

