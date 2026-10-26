// The Frozen Land's quests in the game (rules in frostQuest.js): Mama Penguin and her igloo
// colony, her five lost chicks, the skating party on the frozen lake, and the Penguin King at the
// ice castle with his crown on the snowy peak.
import * as THREE from 'three';
import { penguin } from '../world/RealmLife.js';
import { realmAt } from '../realms.js';
import { T } from '../tiles.js';
import { speak, speakLine } from '../ui/speak.js';
import { load, save } from '../ui/storage.js';
import { loadFrostState, applyFrost, frostStage, frostGoal, following, mamaSays, kingSays, lakeFrozen, CHICKS, LAKE_FROZEN, KING, MAMA } from './frostQuest.js';

const GROUND = 0.25;
const TALK_RANGE = 4.5;
const FIND_RANGE = 1.6; // walking this close to a lost chick finds it
const HOME_RANGE = 3.5; // …and this close to Mama brings the chicks following you home
const CROWN_REACH = 3; // how close (on a dragon) to grab the crown
const GIVE_RANGE = 4; // …and to give it back to the King

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function chickModel() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const fluff = lambert('#a7adb6');
  const b = mesh(new THREE.SphereGeometry(0.22, 12, 10), fluff, 0, 0.24, 0);
  b.scale.set(1, 1.1, 1);
  body.add(b);
  body.add(mesh(new THREE.SphereGeometry(0.17, 12, 10), fluff, 0, 0.5, 0));
  body.add(mesh(new THREE.SphereGeometry(0.11, 10, 8), lambert('#ffffff'), 0, 0.5, 0.09));
  for (const x of [-0.06, 0.06]) body.add(mesh(new THREE.SphereGeometry(0.025, 6, 5), lambert('#111111'), x, 0.54, 0.17));
  const beak = mesh(new THREE.ConeGeometry(0.035, 0.09, 6), lambert('#333333'), 0, 0.48, 0.19);
  beak.rotation.x = Math.PI / 2;
  body.add(beak);
  for (const x of [-0.07, 0.07]) body.add(mesh(new THREE.BoxGeometry(0.08, 0.03, 0.11), lambert('#ff9a2a'), x, 0.02, 0.04));
  g.add(body);
  g.userData.body = body;
  return g;
}

function crownModel(scale = 1) {
  const g = new THREE.Group();
  const gold = new THREE.MeshPhongMaterial({ color: '#ffd23f', emissive: '#8a5a00', emissiveIntensity: 0.5, shininess: 90 });
  g.add(mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.2, 14, 1, true), gold, 0, 0.1, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(mesh(new THREE.ConeGeometry(0.07, 0.2, 5), gold, Math.cos(a) * 0.3, 0.28, Math.sin(a) * 0.3));
    g.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), lambert(['#e84a5f', '#4ac0ff', '#7af0c8'][i % 3], { emissive: '#333333' }), Math.cos(a) * 0.31, 0.1, Math.sin(a) * 0.31));
  }
  g.children[0].material.side = THREE.DoubleSide;
  g.scale.setScalar(scale);
  return g;
}

function igloo() {
  const g = new THREE.Group();
  const snow = lambert('#f4f9ff');
  const dome = mesh(new THREE.SphereGeometry(2.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), snow);
  g.add(dome);
  // rows of ice blocks
  for (let k = 1; k <= 3; k++) {
    const y = k * 0.55, r = Math.sqrt(2.2 * 2.2 - y * y) + 0.01;
    const line = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 4, 32), lambert('#c9dcef'));
    line.rotation.x = Math.PI / 2;
    line.position.y = y;
    g.add(line);
  }
  const tunnel = mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.4, 12, 1, false, 0, Math.PI), snow, 0, 0, 2.2);
  tunnel.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  g.add(tunnel);
  g.add(mesh(new THREE.CircleGeometry(0.6, 12, 0, Math.PI), lambert('#2a3a55'), 0, 0.01, 2.91));
  return g;
}

export class FrostQuest {
  // realm: the Frozen Land from generateRealmWorld(); nag(text) for friendly reminders
  constructor(game, realm, { nag = () => {} } = {}) {
    this.g = game;
    this.realm = realm;
    this.q = realm.quest;
    this.nag = nag;
    this.key = `frost:${game.world.seed}`;
    this.s = loadFrostState(load(this.key, ''));
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.heard = new Set();
    this.shown = null;
    this.markers = new Map();

    // Mama Penguin and her igloo; a few more penguins of the colony about
    const c = this.q.colony;
    const home = igloo();
    home.position.set(c.x, GROUND, c.z - 1.5);
    this.group.add(home);
    this.mama = penguin();
    this.mama.scale.setScalar(1.35);
    const bow = mesh(new THREE.TorusGeometry(0.08, 0.04, 6, 10), lambert('#ff7ab8'), 0.12, 1.02, 0.05);
    this.mama.userData.body.add(bow);
    const scarf = mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 16), lambert('#e84a5f'), 0, 0.68, 0);
    scarf.rotation.x = Math.PI / 2;
    this.mama.userData.body.add(scarf);
    this.mama.position.set(c.x - 1.6, GROUND, c.z + 1.6);
    this.group.add(this.mama);
    this.colony = Array.from({ length: 6 }, (_, i) => {
      const p = penguin();
      const a = (i / 6) * Math.PI * 2;
      p.userData.home = { x: c.x + Math.cos(a) * 4, z: c.z + Math.sin(a) * 4 };
      p.position.set(p.userData.home.x, GROUND, p.userData.home.z);
      p.userData.seed = i * 1.7;
      this.group.add(p);
      return p;
    });

    // the chicks: lost where they wandered, following you, or home with Mama
    this.chicks = this.q.chicks.map((at, i) => {
      const ch = chickModel();
      ch.scale.setScalar(1.15);
      this.group.add(ch);
      ch.userData.lost = at;
      ch.userData.seed = i * 2.3;
      if (this.s.home.includes(i)) this.placeHome(ch, i);
      else if (this.s.found.includes(i)) {
        const p = game.playerInfo();
        ch.position.set(p.x - 1 - i * 0.6, GROUND, p.z - 1);
      } else ch.position.set(at.x, GROUND, at.z);
      return ch;
    });

    // the Penguin King, in front of the ice castle
    const L = realm.landmark, n = realm.nest;
    const toNest = Math.atan2(n.x - L.x, n.z - L.z);
    this.king = penguin();
    this.king.scale.setScalar(1.8);
    const cape = mesh(new THREE.BoxGeometry(0.55, 0.65, 0.04), lambert('#9b1c22'), 0, 0.5, -0.26);
    cape.rotation.x = 0.12;
    this.king.userData.body.add(cape);
    this.king.position.set(L.x + Math.sin(toNest) * (L.r + 1), GROUND, L.z + Math.cos(toNest) * (L.r + 1));
    this.king.rotation.y = toNest;
    this.group.add(this.king);

    // the crown: on the peak, carried, or back on the King's head
    this.crown = crownModel(1.6);
    this.group.add(this.crown);
    this.playerCrown = null;
    this.placeCrown();
    this.syncMarkers();
    this.lakeCheck = 0;
  }

  placeHome(ch, i) {
    const c = this.q.colony, a = (i / CHICKS) * Math.PI * 2;
    ch.userData.homeAt = { x: c.x - 1.6 + Math.cos(a) * 1.4, z: c.z + 1.6 + Math.sin(a) * 1.4 };
    ch.position.set(ch.userData.homeAt.x, GROUND, ch.userData.homeAt.z);
  }

  placeCrown() {
    this.crown.removeFromParent();
    if (this.s.crown === 'peak') {
      this.crown.scale.setScalar(1.6);
      this.crown.position.set(this.q.peak.x, this.q.peak.top + 1.2, this.q.peak.z);
      this.group.add(this.crown);
    } else if (this.s.crown === 'carried') {
      this.wearOn(this.g.player.character, this.crown, 0.9, 0.35);
    } else {
      this.crown.scale.setScalar(0.55);
      this.crown.position.set(0, 1.08, 0);
      this.crown.rotation.set(0, 0, 0);
      this.king.userData.body.add(this.crown);
      // and the player's own little crown, for being an honorary penguin
      if (!this.playerCrown) {
        this.playerCrown = crownModel(1);
        this.wearOn(this.g.player.character, this.playerCrown, 0.55, 0.02);
      }
    }
  }

  // Put a crown on a character's head (scale, and how far above the top of the head).
  wearOn(character, crown, scale, lift) {
    const head = character.parts.head;
    const geo = head.children[0].geometry;
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    crown.scale.setScalar(scale);
    crown.rotation.set(0, 0, 0);
    crown.position.set((b.min.x + b.max.x) / 2, b.max.y + lift, (b.min.z + b.max.z) / 2);
    head.add(crown);
  }

  set(event) {
    this.s = applyFrost(this.s, event);
    save(this.key, JSON.stringify(this.s));
    this.syncMarkers();
  }

  // A beam over Mama until you've met her, and over the crown while it's on the peak.
  syncMarkers() {
    const tv = this.g.treasureView;
    if (!tv) return;
    const want = new Map();
    if (!this.s.metMama) want.set('mama', [this.q.colony, '#8fd4ff']);
    if (frostStage(this.s) === 'crown' && this.s.crown === 'peak') want.set('crown', [this.q.peak, '#ffd23f']);
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

  // The quest tracker's goal while in the Frozen Land.
  goalHere(p) {
    return this.inLand(p) ? frostGoal(this.s) : null;
  }

  // Where the compass points while in the Frozen Land.
  target(p) {
    if (!this.inLand(p)) return null;
    const stage = frostStage(this.s);
    const mama = { x: this.mama.position.x, z: this.mama.position.z };
    if (stage === 'chicks') {
      // meet Mama first; then the nearest lost chick; once all are found, back to Mama
      if (!this.s.metMama || this.s.found.length === CHICKS) return mama;
      let best = null;
      this.chicks.forEach((ch, i) => {
        if (this.s.found.includes(i)) return;
        const d = Math.hypot(ch.position.x - p.x, ch.position.z - p.z);
        if (!best || d < best.d) best = { x: ch.position.x, z: ch.position.z, d };
      });
      return best ?? mama;
    }
    if (stage === 'lake') return { x: this.q.lake.x, z: this.q.lake.z };
    if (stage === 'crown') return this.s.crown === 'peak' ? { x: this.q.peak.x, z: this.q.peak.z } : { x: this.king.position.x, z: this.king.position.z };
    return null;
  }

  talker() {
    const p = this.g.playerInfo();
    if (Math.hypot(p.x - this.mama.position.x, p.z - this.mama.position.z) < 2.4) return { name: 'Mama Penguin', talk: () => this.say('Mama Penguin', mamaSays(this.s)) };
    if (Math.hypot(p.x - this.king.position.x, p.z - this.king.position.z) < 3) return { name: 'the Penguin King', talk: () => this.say('Penguin King', kingSays(this.s)) };
    return null;
  }

  get obstacles() {
    return [
      { x: this.mama.position.x, z: this.mama.position.z, r: 0.45 },
      { x: this.king.position.x, z: this.king.position.z, r: 0.6 },
      { x: this.q.colony.x, z: this.q.colony.z - 1.5, r: 2.2 },
    ];
  }

  say(who, text) {
    this.shown = text;
    this.heard.add(text);
    this.g.hud.showSpeech({ who, text, onRead: () => speak(text) });
    speak(text);
  }

  update(dt, t) {
    const g = this.g;
    const p = g.playerInfo();
    const near = (o, r) => Math.hypot(p.x - o.position.x, p.z - o.position.z) < r;

    // Mama and the King talk when you first come near (each line once by itself; E repeats it)
    const nearMama = near(this.mama, TALK_RANGE), nearKing = near(this.king, TALK_RANGE);
    if (nearMama && !this.s.metMama) this.set({ type: 'metMama' });
    const line = nearMama ? ['Mama Penguin', mamaSays(this.s)] : nearKing ? ['Penguin King', kingSays(this.s)] : null;
    if (line && this.shown !== line[1] && !this.heard.has(line[1]) && !g.cutscene) this.say(...line);
    else if (!line && this.shown) {
      g.hud.hideSpeech(this.shown);
      this.shown = null;
    }

    this.updateChicks(dt, t, p);
    this.updateLake(dt);
    this.updateCrown(dt, t, p);
    this.animate(dt, t, p);
  }

  updateChicks(dt, t, p) {
    this.chicks.forEach((ch, i) => {
      if (this.s.found.includes(i)) return;
      if (Math.hypot(p.x - ch.position.x, p.z - ch.position.z) < FIND_RANGE + (this.g.riding ? 1 : 0)) {
        this.set({ type: 'chick', index: i });
        this.g.hud.showBanner(`Penguin chick ${this.s.found.length} of ${CHICKS}! 🐧`, true);
        speakLine('n_chick');
      }
    });
    // chicks following you go home when you reach Mama
    if (following(this.s).length && Math.hypot(p.x - this.mama.position.x, p.z - this.mama.position.z) < HOME_RANGE) {
      const before = this.s.home.length;
      this.set({ type: 'home' });
      for (const i of this.s.home) if (!this.chicks[i].userData.homeAt) this.placeHomeLater(i);
      if (this.s.home.length === CHICKS && before < CHICKS) {
        this.g.hud.showBanner('All five chicks are home! 🐧🐧🐧🐧🐧', true);
        this.say('Mama Penguin', MAMA.thanks);
        // then she has an idea… (and doesn't say it over her thank-you)
        this.heard.add(MAMA.skate);
        setTimeout(() => this.say('Mama Penguin', MAMA.skate), 4200);
      } else this.say('Mama Penguin', MAMA.more);
    }
  }

  // a chick that's just come home runs over to its spot by Mama
  placeHomeLater(i) {
    const ch = this.chicks[i], c = this.q.colony, a = (i / CHICKS) * Math.PI * 2;
    ch.userData.homeAt = { x: c.x - 1.6 + Math.cos(a) * 1.4, z: c.z + 1.6 + Math.sin(a) * 1.4 };
  }

  updateLake(dt) {
    if (frostStage(this.s) !== 'lake') return;
    this.lakeCheck -= dt;
    if (this.lakeCheck > 0) return;
    this.lakeCheck = 0.5;
    const w = this.g.world;
    if (lakeFrozen(this.q.lake.tiles, (i) => w.tiles[i] === T.ICE) < LAKE_FROZEN) return;
    this.set({ type: 'lakeFrozen' });
    // freeze the rest, so the whole lake is ice for the party
    for (const i of this.q.lake.tiles) {
      const x = i % w.width, z = (i / w.width) | 0;
      const c = this.g.env.hitGround(x, z, 'ice');
      if (c) this.g.envView.setLakeIce(c.tile, c.x, c.z, true);
    }
    this.g.hud.showBanner('The lake is frozen! Skating party! ⛸️', true);
    speakLine('n_lake');
  }

  updateCrown(dt, t, p) {
    if (this.s.crown === 'peak') {
      this.crown.rotation.y = t * 1.5;
      this.crown.position.y = this.q.peak.top + 1.2 + Math.sin(t * 2) * 0.15;
      const r = this.g.riding;
      if (frostStage(this.s) === 'crown' && r) {
        const d = Math.hypot(r.x - this.crown.position.x, r.y + 1 - this.crown.position.y, r.z - this.crown.position.z);
        if (d < CROWN_REACH) {
          this.set({ type: 'crown' });
          this.placeCrown();
          this.g.hud.showBanner('You got the crown! 👑', true);
          speakLine('n_crown');
        }
      }
    } else if (this.s.crown === 'carried' && Math.hypot(p.x - this.king.position.x, p.z - this.king.position.z) < GIVE_RANGE) {
      this.set({ type: 'crownHome' });
      this.placeCrown();
      this.kingCheer = 6;
      this.g.hud.showBanner("You're an honorary penguin! 👑🐧", true);
      this.heard.add(KING.after); // let his thank-you be heard first
      this.say('Penguin King', KING.thanks);
    }
  }

  animate(dt, t, p) {
    const party = this.s.lake;
    const lake = this.q.lake;
    // skaters glide round the frozen lake, spinning now and then
    const skate = (obj, k, n) => {
      const a = t * (0.35 + (k % 3) * 0.08) + (k / n) * Math.PI * 2;
      const rr = 0.45 + (k % 3) * 0.17;
      const x = lake.x + Math.cos(a) * (lake.rx - 1.5) * rr, z = lake.z + Math.sin(a) * (lake.rz - 1) * rr;
      obj.position.set(x, GROUND, z);
      const spin = Math.sin(t * 0.6 + k) > 0.85;
      obj.rotation.y = spin ? t * 9 : a + Math.PI;
      if (obj.userData.body) obj.userData.body.rotation.z = Math.sin(t * 2 + k) * 0.15;
    };
    const skaters = party ? [...this.colony, ...this.chicks.filter((_, i) => this.s.home.includes(i))] : [];
    skaters.forEach((o, k) => skate(o, k, skaters.length));

    if (!party) {
      this.colony.forEach((pg) => {
        const h = pg.userData.home, k = pg.userData.seed;
        const a = t * 0.3 + k;
        pg.position.set(h.x + Math.sin(a) * 0.8, GROUND, h.z + Math.cos(a * 0.7) * 0.8);
        pg.rotation.y = a + Math.PI / 2;
        pg.userData.body.rotation.z = Math.sin(t * 10 + k) * 0.15;
      });
    }

    // chicks: peeping where they're lost, following you in a line, or by Mama
    let lead = { x: p.x, z: p.z };
    for (const i of following(this.s)) {
      const ch = this.chicks[i];
      const dx = lead.x - ch.position.x, dz = lead.z - ch.position.z, d = Math.hypot(dx, dz);
      if (d > 20) ch.position.set(lead.x - dx / d, GROUND, lead.z - dz / d); // left far behind: catch up
      else if (d > 0.75) {
        const step = Math.min(d - 0.75, dt * (d > 3 ? 7 : 3.2));
        ch.position.x += (dx / d) * step;
        ch.position.z += (dz / d) * step;
        ch.rotation.y = Math.atan2(dx, dz);
        ch.userData.body.rotation.z = Math.sin(t * 16 + i) * 0.22;
      } else ch.userData.body.rotation.z = 0;
      ch.position.y = GROUND + Math.abs(Math.sin(t * 10 + i)) * 0.06;
      lead = { x: ch.position.x, z: ch.position.z };
    }
    this.chicks.forEach((ch, i) => {
      if (!this.s.found.includes(i)) {
        // lost: a little hop and a look around
        ch.position.y = GROUND + Math.max(0, Math.sin(t * 3 + ch.userData.seed)) ** 6 * 0.25;
        ch.rotation.y = Math.sin(t * 0.5 + ch.userData.seed) * 1.5;
      } else if (this.s.home.includes(i) && !party) {
        const h = ch.userData.homeAt;
        if (h) {
          const dx = h.x - ch.position.x, dz = h.z - ch.position.z, d = Math.hypot(dx, dz);
          if (d > 0.05) {
            const step = Math.min(d, dt * 3);
            ch.position.x += (dx / d) * step;
            ch.position.z += (dz / d) * step;
          }
          ch.position.y = GROUND + Math.max(0, Math.sin(t * 4 + i)) ** 4 * 0.15;
        }
      }
    });

    // Mama and the King turn to look at you; the King jumps for joy with his crown back
    for (const o of [this.mama, this.king]) {
      if (Math.hypot(p.x - o.position.x, p.z - o.position.z) < 9) o.rotation.y = Math.atan2(p.x - o.position.x, p.z - o.position.z);
    }
    this.kingCheer = (this.kingCheer ?? 0) - dt;
    this.king.position.y = GROUND + (this.kingCheer > 0 ? Math.abs(Math.sin(t * 7)) * 0.4 : 0);
    this.mama.userData.body.rotation.z = Math.sin(t * 1.5) * 0.05;
  }

  dispose() {
    for (const [, m] of this.markers) this.g.treasureView?.removeMarker(m);
    this.crown.removeFromParent();
    this.playerCrown?.removeFromParent();
    this.g.scene.remove(this.group);
    this.group.traverse((o) => o.geometry?.dispose());
  }
}
