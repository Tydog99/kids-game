// The Crystal Forest's quests in the game (rules in glimmerQuest.js): Luna the crystal unicorn, the
// five dull crystals that Glimmer's diamonds make shine, the singing crystals in the song glade,
// and the star crystal for the top of the giant crystal tree. The reward: a rainbow over the
// forest and sparkly rainbow footsteps wherever you go.
import * as THREE from 'three';
import { realmAt } from '../realms.js';
import { music } from '../audio/Music.js';
import { speak, speakLine } from '../ui/speak.js';
import { load, save } from '../ui/storage.js';
import { loadGlimmerState, applyGlimmer, glimmerStage, glimmerGoal, lunaSays, songStep, CRYSTALS, LUNA } from './glimmerQuest.js';

const GROUND = 0.25;
const TALK_RANGE = 4.5;
const SHINE_RANGE = 2; // diamond breath this close (sideways) to a dull crystal reaches it
const PILLAR_RANGE = 1.3; // stepping this close to a singing crystal sings its note
const STAR_REACH = 3.2; // flying this close to the top of the tree places the star
const PASTEL = ['#ff9fd0', '#ffb36b', '#ffe27a', '#8ff0ff', '#c9a6ff'];
const NOTES = [523, 587, 659, 784, 880]; // each singing crystal's note (C D E G A)
const TRAIL = 60;

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function unicorn() {
  const g = new THREE.Group();
  const white = lambert('#fbf8ff'), hoof = lambert('#c9a6ff');
  const body = mesh(new THREE.BoxGeometry(0.7, 0.55, 1.3), white, 0, 0.95, 0);
  g.add(body);
  for (const [x, z] of [[-0.25, 0.45], [0.25, 0.45], [-0.25, -0.45], [0.25, -0.45]]) {
    g.add(mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), white, x, 0.38, z));
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.12, 0.2), hoof, x, 0.06, z));
  }
  const neck = mesh(new THREE.BoxGeometry(0.34, 0.7, 0.34), white, 0, 1.4, 0.6);
  neck.rotation.x = 0.45;
  g.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 1.8, 0.85);
  head.add(mesh(new THREE.BoxGeometry(0.36, 0.36, 0.62), white, 0, 0, 0.12));
  for (const x of [-0.19, 0.19]) head.add(mesh(new THREE.BoxGeometry(0.03, 0.09, 0.09), lambert('#3a2a5a'), x, 0.05, 0.22));
  const horn = mesh(new THREE.ConeGeometry(0.08, 0.5, 8), new THREE.MeshPhongMaterial({ color: '#ffe27a', emissive: '#c9a6ff', emissiveIntensity: 0.6, shininess: 100 }), 0, 0.38, 0.12);
  horn.rotation.x = 0.35;
  head.add(horn);
  for (const x of [-0.12, 0.12]) head.add(mesh(new THREE.ConeGeometry(0.06, 0.16, 4), white, x, 0.24, -0.08));
  g.add(head);
  // a mane and tail of pastel crystal
  PASTEL.forEach((c, i) => {
    const m = mesh(new THREE.OctahedronGeometry(0.11), lambert(c, { emissive: c, emissiveIntensity: 0.4 }), 0, 1.95 - i * 0.18, 0.62 - i * 0.12);
    m.scale.set(0.8, 1.6, 0.8);
    g.add(m);
    const t = mesh(new THREE.OctahedronGeometry(0.1), lambert(c, { emissive: c, emissiveIntensity: 0.4 }), 0, 1.0 - i * 0.12, -0.72 - i * 0.06);
    t.scale.set(0.8, 1.8, 0.8);
    g.add(t);
  });
  g.userData.head = head;
  return g;
}

// a cluster of crystal shards: dull grey, or shining in rainbow colours
function crystalCluster(shining, seed) {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const c = PASTEL[(i + seed) % PASTEL.length];
    const mat = shining ? new THREE.MeshPhongMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, shininess: 120, flatShading: true }) : new THREE.MeshLambertMaterial({ color: '#8a8a92', flatShading: true });
    const h = i === 0 ? 1.6 : 0.7 + ((i * 7) % 5) * 0.12;
    const shard = mesh(new THREE.OctahedronGeometry(0.28), mat, i === 0 ? 0 : Math.cos(i * 1.3) * 0.4, h / 2, i === 0 ? 0 : Math.sin(i * 1.3) * 0.4);
    shard.scale.set(0.8, h * 1.5, 0.8);
    shard.rotation.set(i === 0 ? 0 : Math.sin(i) * 0.4, i, i === 0 ? 0 : Math.cos(i) * 0.4);
    g.add(shard);
  }
  return g;
}

function star(scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color: '#fff3b0', emissive: '#ffd23f', emissiveIntensity: 0.8, shininess: 120, flatShading: true });
  const core = mesh(new THREE.OctahedronGeometry(0.35), mat);
  g.add(core);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = mesh(new THREE.ConeGeometry(0.14, 0.5, 5), mat, Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0);
    p.rotation.z = a - Math.PI / 2;
    g.add(p);
  }
  g.scale.setScalar(scale);
  return g;
}

export class GlimmerQuest {
  constructor(game, realm, { nag = () => {} } = {}) {
    this.g = game;
    this.realm = realm;
    this.q = realm.quest;
    this.nag = nag;
    this.key = `glimmer:${game.world.seed}`;
    this.s = loadGlimmerState(load(this.key, ''));
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.heard = new Set();
    this.shown = null;
    this.markers = new Map();

    this.luna = unicorn();
    this.luna.position.set(this.q.glade.x, GROUND, this.q.glade.z);
    this.group.add(this.luna);

    this.crystals = this.q.crystals.map((at, i) => this.makeCrystal(i, at));

    // the song glade: a ring of singing crystal pillars on glowing pads
    this.pillars = this.q.pillars.map((at, i) => {
      const g = new THREE.Group();
      const c = PASTEL[i];
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.06, 20), new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.15 }));
      pad.position.y = GROUND + 0.03;
      g.add(pad);
      const mat = new THREE.MeshPhongMaterial({ color: c, emissive: c, emissiveIntensity: 0.2, shininess: 120, flatShading: true });
      const pillar = mesh(new THREE.OctahedronGeometry(0.45), mat, 0, 1.4, 0);
      pillar.scale.set(0.8, 2.6, 0.8);
      g.add(pillar);
      g.position.set(at.x, 0, at.z);
      g.userData = { mat, pad, glow: 0, at };
      this.group.add(g);
      return g;
    });
    this.sung = [];
    this.onPillar = -1;
    this.showTune = 0; // time into Luna's showing of the tune

    // the star: with Luna (shown floating over her horn), carried, or on top of the tree
    this.star = star(1.2);
    this.group.add(this.star);
    this.treeLight = null;
    this.rainbow = null;
    this.trail = null;
    this.placeStar();
    this.syncMarkers();
  }

  makeCrystal(i, at) {
    const shining = this.s.shining.includes(i);
    const c = crystalCluster(shining, i);
    c.position.set(at.x, GROUND, at.z);
    c.userData = { i, at, pop: shining ? 1 : 0 };
    this.group.add(c);
    return c;
  }

  placeStar() {
    this.star.removeFromParent();
    if (this.s.star === 'luna') {
      this.group.add(this.star);
      this.star.visible = glimmerStage(this.s) === 'star';
    } else if (this.s.star === 'carried') {
      this.star.visible = true;
      this.star.scale.setScalar(0.8);
      this.star.position.set(0, 1.55, 0);
      this.g.player.character.root.add(this.star);
    } else {
      this.star.visible = true;
      this.star.scale.setScalar(2.2);
      this.star.position.set(this.q.tree.x, this.q.tree.top + 1, this.q.tree.z);
      this.group.add(this.star);
      this.celebrate(false);
    }
  }

  // the reward: the tree's star shines, a rainbow over the forest, rainbow footsteps
  celebrate(fresh) {
    if (!this.rainbow) {
      const g = new THREE.Group();
      PASTEL.forEach((c, i) => {
        const arc = new THREE.Mesh(new THREE.TorusGeometry(26 - i * 1.1, 0.55, 6, 48, Math.PI), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, fog: false, depthWrite: false }));
        g.add(arc);
      });
      const b = this.realm.bounds;
      g.position.set((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2);
      this.group.add(g);
      this.rainbow = g;
    }
    if (!this.treeLight) {
      this.treeLight = new THREE.PointLight('#fff3b0', fresh ? 0 : 3, 30, 1.2);
      this.treeLight.position.set(this.q.tree.x, this.q.tree.top + 1, this.q.tree.z);
      this.group.add(this.treeLight);
    }
    if (!this.trail) this.makeTrail();
  }

  makeTrail() {
    this.trail = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.06), new THREE.MeshBasicMaterial({ color: '#ffffff' }), TRAIL);
    this.trail.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(TRAIL * 3), 3);
    this.trail.frustumCulled = false;
    this.g.scene.add(this.trail);
    this.trailBits = [];
    this.trailTimer = 0;
  }

  set(event) {
    this.s = applyGlimmer(this.s, event);
    save(this.key, JSON.stringify(this.s));
    this.syncMarkers();
  }

  syncMarkers() {
    const tv = this.g.treasureView;
    if (!tv) return;
    const stage = glimmerStage(this.s);
    const want = new Map();
    if (!this.s.metLuna) want.set('luna', [this.q.glade, '#c9a6ff']);
    if (stage === 'song') want.set('song', [this.q.song, '#ff9fd0']);
    if (this.s.star === 'carried') want.set('tree', [this.q.tree, '#ffd23f']);
    for (const [k, beam] of this.markers) if (!want.has(k)) {
      tv.removeMarker(beam);
      this.markers.delete(k);
    }
    for (const [k, [at, color]] of want) if (!this.markers.has(k)) this.markers.set(k, tv.addMarker(Math.floor(at.x), Math.floor(at.z), color));
  }

  // ---- for the game ----

  inLand(p) {
    return realmAt(this.g.world, Math.floor(p.x), Math.floor(p.z)) === this.realm;
  }

  goalHere(p) {
    return this.inLand(p) ? glimmerGoal(this.s) : null;
  }

  target(p) {
    if (!this.inLand(p)) return null;
    const stage = glimmerStage(this.s);
    if (stage === 'crystals') {
      if (!this.s.metLuna) return this.q.glade;
      let best = null;
      this.crystals.forEach((c) => {
        if (this.s.shining.includes(c.userData.i)) return;
        const d = Math.hypot(c.position.x - p.x, c.position.z - p.z);
        if (!best || d < best.d) best = { x: c.position.x, z: c.position.z, d };
      });
      return best ?? this.q.glade;
    }
    if (stage === 'song') return this.q.song;
    if (stage === 'star') return this.s.star === 'carried' ? this.q.tree : this.q.glade;
    return null;
  }

  talker() {
    const p = this.g.playerInfo();
    if (Math.hypot(p.x - this.luna.position.x, p.z - this.luna.position.z) < 2.6) return { name: 'Luna', talk: () => this.say(lunaSays(this.s)) };
    return null;
  }

  get obstacles() {
    return [{ x: this.luna.position.x, z: this.luna.position.z, r: 0.7 }];
  }

  say(text) {
    this.shown = text;
    this.heard.add(text);
    this.g.hud.showSpeech({ who: 'Luna', text, onRead: () => speak(text) });
    speak(text);
  }

  update(dt, t) {
    const g = this.g;
    const p = g.playerInfo();
    const nearLuna = Math.hypot(p.x - this.luna.position.x, p.z - this.luna.position.z) < TALK_RANGE;
    if (nearLuna && !this.s.metLuna) this.set({ type: 'metLuna' });
    // Luna hands over the star once the song is sung and you come back to her
    if (nearLuna && glimmerStage(this.s) === 'star' && this.s.star === 'luna') {
      this.set({ type: 'star' });
      this.placeStar();
      g.hud.showBanner('Luna gave you the star crystal! ⭐', true);
    }
    const line = nearLuna ? lunaSays(this.s) : null;
    if (line && this.shown !== line && !this.heard.has(line) && !g.cutscene) this.say(line);
    else if (!line && this.shown) {
      g.hud.hideSpeech(this.shown);
      this.shown = null;
    }

    this.catchBreath();
    this.updateSong(dt, t, p);
    this.updateStar(t);
    this.animate(dt, t, p);
  }

  // Glimmer's diamonds make dull crystals shine (other breath gets a hint).
  catchBreath() {
    const d = this.g.riding?.dragon;
    if (!d?.breath) return;
    for (const P of d.breath.particles) {
      if (P.glimmer) continue;
      for (const c of this.crystals) {
        const i = c.userData.i;
        if (this.s.shining.includes(i) || P.p.y > 5 || Math.hypot(P.p.x - c.position.x, P.p.z - c.position.z) > SHINE_RANGE) continue;
        P.glimmer = true;
        if (d.spec.breath === 'diamonds') this.shine(i);
        else this.nag('Dull crystals need sparkly diamonds! Glimmer breathes diamonds.');
      }
    }
  }

  shine(i) {
    this.set({ type: 'shine', index: i });
    const old = this.crystals[i];
    this.group.remove(old);
    old.traverse((o) => o.geometry?.dispose());
    this.crystals[i] = this.makeCrystal(i, old.userData.at);
    this.crystals[i].userData.pop = 0; // grows in with a little bounce
    music.chime?.([NOTES[i % 5] * 2, NOTES[(i + 2) % 5] * 2]);
    if (this.s.shining.length === CRYSTALS) {
      this.g.hud.showBanner('All the crystals shine! Now go to the song glade 🎵', true);
      speakLine('n_crystals');
    } else {
      this.g.hud.showBanner(`Crystal ${this.s.shining.length} of ${CRYSTALS} shines! 💎`, true);
      speakLine('n_crystal');
    }
  }

  // The singing crystals: Luna shows the tune by lighting them one by one; walk into them in order.
  updateSong(dt, t, p) {
    if (glimmerStage(this.s) !== 'song') return;
    const tune = this.q.tune;
    const inGlade = Math.hypot(p.x - this.q.song.x, p.z - this.q.song.z) < 9;
    if (!inGlade) {
      this.showTune = 0;
      this.sung = [];
      return;
    }
    if (!this.explained) {
      this.explained = true;
      this.g.hud.showBanner('Watch the crystals light up, then walk to them in the same order! 🎵', true);
      speakLine('n_song_how');
    }
    // while you haven't started singing, the crystals show the tune, again and again
    if (!this.sung.length) {
      const before = this.showTune;
      this.showTune += dt;
      const beat = 0.9, loop = tune.length * beat + 2.5;
      const k = Math.floor((this.showTune % loop) / beat), kb = Math.floor((before % loop) / beat);
      if (k < tune.length && (k !== kb || before === 0)) this.glow(tune[k], true);
    }
    // stepping onto a crystal's pad sings it
    let on = -1;
    this.pillars.forEach((pl, i) => {
      if (Math.hypot(p.x - pl.userData.at.x, p.z - pl.userData.at.z) < PILLAR_RANGE) on = i;
    });
    if (on !== -1 && on !== this.onPillar) {
      this.glow(on, true);
      this.sung.push(on);
      const r = songStep(tune, this.sung);
      if (r === 'wrong') {
        this.sung = [];
        this.showTune = 0;
        this.g.hud.showBanner('Oops! Watch the lights and try again 🎵', true);
        speak(LUNA.oops);
      } else if (r === 'done') {
        this.set({ type: 'sang' });
        this.sung = [];
        music.chime?.([...tune.map((i) => NOTES[i] * 2), 1568]);
        this.g.hud.showBanner('You sang the crystal song! 🎵✨', true);
        speakLine('n_song');
      }
    }
    this.onPillar = on;
  }

  glow(i, sing) {
    this.pillars[i].userData.glow = 1;
    if (sing) music.chime?.([NOTES[i] * 2]);
  }

  updateStar(t) {
    if (this.s.star !== 'carried') return;
    const r = this.g.riding;
    if (!r) return;
    const top = { x: this.q.tree.x, y: this.q.tree.top + 1, z: this.q.tree.z };
    if (Math.hypot(r.x - top.x, r.y + 1 - top.y, r.z - top.z) < STAR_REACH || (Math.hypot(r.x - top.x, r.z - top.z) < 2.5 && r.y > top.y - 3)) {
      this.set({ type: 'starPlaced' });
      this.placeStar();
      this.celebrate(true);
      this.glowUp = 0;
      this.g.hud.showBanner('The whole forest is glowing! 🌈', true);
      speakLine('n_star');
    }
  }

  animate(dt, t, p) {
    // Luna turns to look at you and swishes her head
    this.luna.rotation.y = Math.atan2(p.x - this.luna.position.x, p.z - this.luna.position.z);
    this.luna.userData.head.rotation.x = Math.sin(t * 1.3) * 0.08;
    if (this.s.star === 'luna' && this.star.visible) {
      this.star.position.set(this.luna.position.x, 3.2 + Math.sin(t * 2) * 0.2, this.luna.position.z);
      this.star.rotation.z = t;
    }
    if (this.s.star === 'carried') this.star.rotation.z = t * 2;
    if (this.s.star === 'tree') this.star.rotation.y = t * 0.8;
    // shining crystals pulse (and pop in when freshly lit)
    for (const c of this.crystals) {
      const shining = this.s.shining.includes(c.userData.i);
      if (!shining) continue;
      c.userData.pop = Math.min(1, c.userData.pop + dt * 2);
      const k = c.userData.pop;
      c.scale.setScalar(k < 1 ? 1 + Math.sin(k * Math.PI) * 0.4 : 1);
      c.rotation.y = t * 0.3 + c.userData.i;
    }
    // singing crystals fade after lighting up
    for (const pl of this.pillars) {
      const u = pl.userData;
      u.glow = Math.max(0, u.glow - dt * 1.4);
      u.mat.emissiveIntensity = 0.2 + u.glow * 1.2;
      u.pad.material.emissiveIntensity = 0.15 + u.glow * 0.8;
      pl.children[1].position.y = 1.4 + u.glow * 0.3;
    }
    if (this.treeLight && this.glowUp !== undefined) {
      this.glowUp += dt;
      this.treeLight.intensity = Math.min(3, this.glowUp * 1.5);
    }
    if (this.rainbow) this.rainbow.children.forEach((a, i) => (a.material.opacity = 0.45 + Math.sin(t * 0.8 + i * 0.4) * 0.1));
    this.updateTrail(dt, t, p);
  }

  // rainbow sparkles left behind wherever you walk (or fly)
  updateTrail(dt, t, p) {
    if (!this.trail) return;
    const moving = this.g.riding ? Math.abs(this.g.riding.motor?.speed ?? 0) > 0.3 : this.g.player.motor.speed > 0.3;
    this.trailTimer -= dt;
    if (moving && this.trailTimer <= 0) {
      this.trailTimer = 0.05;
      const y = this.g.riding ? this.g.riding.y + 0.3 : GROUND + 0.1;
      this.trailBits.push({ x: p.x + (Math.random() - 0.5) * 0.4, y, z: p.z + (Math.random() - 0.5) * 0.4, age: 0, c: new THREE.Color(PASTEL[Math.floor(Math.random() * PASTEL.length)]) });
      if (this.trailBits.length > TRAIL) this.trailBits.shift();
    }
    const o = new THREE.Object3D();
    let n = 0;
    this.trailBits = this.trailBits.filter((b) => (b.age += dt) < 1.6);
    for (const b of this.trailBits) {
      o.position.set(b.x, b.y + b.age * 0.6, b.z);
      o.scale.setScalar(Math.sin((1 - b.age / 1.6) * Math.PI) * 1.6 + 0.2);
      o.rotation.set(t * 3, t * 2 + b.x, 0);
      o.updateMatrix();
      this.trail.setMatrixAt(n, o.matrix);
      this.trail.setColorAt(n, b.c);
      n++;
    }
    this.trail.count = n;
    this.trail.instanceMatrix.needsUpdate = true;
    this.trail.instanceColor.needsUpdate = true;
  }

  dispose() {
    for (const [, m] of this.markers) this.g.treasureView?.removeMarker(m);
    this.star.removeFromParent();
    if (this.trail) {
      this.g.scene.remove(this.trail);
      this.trail.geometry.dispose();
    }
    this.g.scene.remove(this.group);
    this.group.traverse((o) => o.geometry?.dispose());
  }
}
