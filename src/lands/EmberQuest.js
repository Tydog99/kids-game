// The Fire Mountains' quests in the game (rules in emberQuest.js): Flicker the fire sprite and the
// five sleepy sprites to warm with Ember's fire, the lava river round the island that Frost's ice
// turns into stepping stones, and the dragon egg that hatches in the volcano's crater into a baby
// dragon that follows you everywhere.
import * as THREE from 'three';
import { fireSprite } from '../world/RealmLife.js';
import { realmAt } from '../realms.js';
import { T } from '../tiles.js';
import { BabyDragon } from '../creatures/BabyDragon.js';
import { DRAGONS } from '../creatures/dragonModels.js';
import { suggestName, cleanName } from '../creatures/trust.js';
import { speak, speakLine } from '../ui/speak.js';
import { load, save } from '../ui/storage.js';
import { loadEmberState, applyEmber, emberStage, emberGoal, flickerSays, SPRITES, FLICKER } from './emberQuest.js';

const GROUND = 0.25;
const TALK_RANGE = 4.5;
const WARM_RANGE = 1.9; // breath this close (sideways) to a sleepy sprite reaches it
const EGG_REACH = 1.4; // walking this close to the egg picks it up
const CRATER_REACH = 5; // flying this close to the crater (with the egg) sets it down there

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// a fire sprite gone cold: grey, droopy and puffing a little smoke
function coldSprite() {
  const g = fireSprite();
  g.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.color.set('#8d8a88');
    o.material.emissive?.set('#000000');
  });
  return g;
}

function fireEgg() {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhongMaterial({ color: '#e8742a', emissive: '#ff5a1a', emissiveIntensity: 0.35, shininess: 60 });
  const egg = mesh(new THREE.SphereGeometry(0.32, 16, 12), mat);
  egg.scale.set(1, 1.35, 1);
  g.add(egg);
  // golden speckles
  for (let i = 0; i < 10; i++) {
    const a = i * 2.4, y = -0.25 + (i / 10) * 0.6;
    const r = 0.33 * Math.sqrt(1 - (y / 0.44) ** 2);
    g.add(mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshLambertMaterial({ color: '#ffd23f', emissive: '#8a5a00' }), Math.cos(a) * r, y, Math.sin(a) * r));
  }
  g.userData.mat = mat;
  return g;
}

export class EmberQuest {
  // realm: the Fire Mountains from generateRealmWorld(); nag(text) for friendly reminders
  constructor(game, realm, { nag = () => {} } = {}) {
    this.g = game;
    this.realm = realm;
    this.q = realm.quest;
    this.nag = nag;
    this.key = `ember:${game.world.seed}`;
    this.s = loadEmberState(load(this.key, ''));
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.heard = new Set();
    this.shown = null;
    this.markers = new Map();

    // Flicker floats over a ring of warm stones at the hearth
    const h = this.q.hearth;
    const stone = new THREE.MeshLambertMaterial({ color: '#4a3f3f' });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.group.add(mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), stone, h.x + Math.cos(a) * 1.3, GROUND + 0.15, h.z + Math.sin(a) * 1.3));
    }
    this.group.add(mesh(new THREE.CylinderGeometry(1, 1, 0.08, 16), new THREE.MeshLambertMaterial({ color: '#ff7a1a', emissive: '#ff5a1a', emissiveIntensity: 0.8 }), h.x, GROUND + 0.05, h.z));
    this.flicker = fireSprite();
    this.flicker.scale.setScalar(2.4);
    this.flicker.position.set(h.x, 1.6, h.z);
    this.group.add(this.flicker);

    // the five sprites: sleepy and cold where they are, or warm and dancing at the hearth
    this.sprites = this.q.sprites.map((at, i) => this.makeSprite(i, this.s.warm.includes(i), at));

    // the lava river's stepping stones (any already made) and the egg
    this.stoneMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.96, 0.18, 0.96), new THREE.MeshLambertMaterial({ color: '#2e2828' }), 600);
    this.stoneMesh.count = 0;
    this.stoneMesh.receiveShadow = true;
    this.group.add(this.stoneMesh);
    this.steam = [];
    for (const tile of this.s.stones) this.coolTile(tile, false);
    this.egg = fireEgg();
    this.placeEgg();

    this.baby = null;
    if (this.s.egg === 'hatched') this.hatchBaby(false);
    this.syncMarkers();
  }

  makeSprite(i, warm, at) {
    const sp = warm ? fireSprite() : coldSprite();
    sp.userData.at = at;
    sp.userData.i = i;
    sp.position.set(at.x, warm ? 1.2 : 0.45, at.z);
    this.group.add(sp);
    return sp;
  }

  placeEgg() {
    this.egg.removeFromParent();
    const ch = this.g.player.character;
    this.egg.scale.setScalar(this.s.egg === 'carried' ? 0.7 : 1); // smaller overhead, so you can see past it
    if (this.s.egg === 'island') {
      this.egg.position.set(this.q.island.x, GROUND + 0.45, this.q.island.z);
      this.group.add(this.egg);
    } else if (this.s.egg === 'carried') {
      this.egg.position.set(0, 1.32, 0.05);
      ch.root.add(this.egg);
    } else if (this.s.egg === 'crater') {
      const c = this.q.crater, w = this.g.world;
      const top = w.rockHeight[Math.floor(c.z) * w.width + Math.floor(c.x)] || 6;
      this.egg.position.set(c.x + 1.1, top + 0.55, c.z);
      this.group.add(this.egg);
    }
    this.g.carryingOther = this.s.egg === 'carried';
    if (!this.g.story) ch.carrying = this.g.carryingOther;
  }

  // Lava cooled into a stepping stone by ice breath.
  coolTile(tile, fresh = true) {
    const w = this.g.world;
    w.tiles[tile] = T.VOLCANIC;
    const x = tile % w.width, z = (tile / w.width) | 0;
    const m = new THREE.Matrix4().makeTranslation(x + 0.5, 0.2, z + 0.5);
    if (this.stoneMesh.count < 600) {
      this.stoneMesh.setMatrixAt(this.stoneMesh.count++, m);
      this.stoneMesh.instanceMatrix.needsUpdate = true;
    }
    if (fresh) this.steam.push({ x: x + 0.5, z: z + 0.5, age: 0, mesh: this.steamPuff(x + 0.5, z + 0.5) });
  }

  steamPuff(x, z) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshLambertMaterial({ color: '#e8e8e8', transparent: true, opacity: 0.8 }));
    m.position.set(x, 0.5, z);
    this.group.add(m);
    return m;
  }

  set(event) {
    this.s = applyEmber(this.s, event);
    save(this.key, JSON.stringify(this.s));
    this.syncMarkers();
  }

  // A beam over Flicker until you've met, over the egg while it waits on the island, and over the
  // crater while you carry the egg.
  syncMarkers() {
    const tv = this.g.treasureView;
    if (!tv) return;
    const stage = emberStage(this.s);
    const want = new Map();
    if (!this.s.metFlicker) want.set('flicker', [this.q.hearth, '#ff8a4a']);
    if (stage === 'river') want.set('egg', [this.q.island, '#ffd23f']);
    if (this.s.egg === 'carried' || this.s.egg === 'crater') want.set('crater', [this.q.crater, '#ff5a1a']);
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
    return this.inLand(p) ? emberGoal(this.s) : null;
  }

  target(p) {
    if (!this.inLand(p)) return null;
    const stage = emberStage(this.s);
    if (stage === 'sprites') {
      if (!this.s.metFlicker) return this.q.hearth;
      let best = null;
      this.sprites.forEach((sp, i) => {
        if (this.s.warm.includes(i)) return;
        const d = Math.hypot(sp.position.x - p.x, sp.position.z - p.z);
        if (!best || d < best.d) best = { x: sp.position.x, z: sp.position.z, d };
      });
      return best ?? this.q.hearth;
    }
    if (stage === 'river') return this.q.island;
    if (stage === 'hatch') return this.q.crater;
    return null;
  }

  talker() {
    const p = this.g.playerInfo();
    if (Math.hypot(p.x - this.q.hearth.x, p.z - this.q.hearth.z) < 2.6) return { name: 'Flicker', talk: () => this.say(flickerSays(this.s)) };
    return null;
  }

  get obstacles() {
    return [{ x: this.q.hearth.x, z: this.q.hearth.z, r: 1.3 }];
  }

  say(text) {
    this.shown = text;
    this.heard.add(text);
    this.g.hud.showSpeech({ who: 'Flicker', text, onRead: () => speak(text) });
    speak(text);
  }

  update(dt, t) {
    const g = this.g;
    const p = g.playerInfo();
    const nearFlicker = Math.hypot(p.x - this.q.hearth.x, p.z - this.q.hearth.z) < TALK_RANGE;
    if (nearFlicker && !this.s.metFlicker) this.set({ type: 'metFlicker' });
    // once all the sprites are warm, Flicker says thank you (then, a moment later, asks about the river)
    if (nearFlicker && this.pendingThanks && !g.cutscene) {
      this.pendingThanks = false;
      this.say(FLICKER.thanks);
      setTimeout(() => this.heard.delete(FLICKER.river), 3800);
    }
    const line = nearFlicker ? flickerSays(this.s) : null;
    if (line && this.shown !== line && !this.heard.has(line) && !g.cutscene) this.say(line);
    else if (!line && this.shown) {
      g.hud.hideSpeech(this.shown);
      this.shown = null;
    }

    this.catchBreath();
    this.updateEgg(dt, t, p);
    this.animate(dt, t, p);
    this.baby?.update(dt, t, p, g.riding);
  }

  // The ridden dragon's breath: fire warms sleepy sprites and hatches the egg; ice cools lava.
  catchBreath() {
    const r = this.g.riding;
    const d = r?.dragon;
    if (!d?.breath) return;
    const kind = d.spec.breath;
    const w = this.g.world;
    // like freezing a lake, the cold reaches the lava right under the dragon's neck and head too,
    // so a path of stones starts at the shore rather than where the breath first lands
    if (kind === 'ice' && d.breathing && d.breathOpen > 0.5 && r.y < 4) {
      const mouth = d.mouth.getWorldPosition(this.tmpMouth ?? (this.tmpMouth = new THREE.Vector3()));
      for (let k = 0.3; k <= 1.001; k += 0.1) {
        const tx = Math.floor(r.x + (mouth.x - r.x) * k), tz = Math.floor(r.z + (mouth.z - r.z) * k), i = tz * w.width + tx;
        if (w.tiles[i] === T.LAVA && realmAt(w, tx, tz) === this.realm) {
          this.coolTile(i);
          this.set({ type: 'stone', tile: i });
        }
      }
    }
    for (const P of d.breath.particles) {
      if (P.ember) continue;
      // sleepy sprites
      for (const sp of this.sprites) {
        const i = sp.userData.i;
        if (this.s.warm.includes(i) || P.p.y > 5 || Math.hypot(P.p.x - sp.position.x, P.p.z - sp.position.z) > WARM_RANGE) continue;
        P.ember = true;
        if (kind === 'fire') this.warm(i);
        else this.nag("Brrr! Sleepy sprites need Ember's fire!");
      }
      // lava → stepping stones, anywhere in the Fire Mountains
      if (kind === 'ice' && P.p.y < 7.5) {
        const tx = Math.floor(P.p.x), tz = Math.floor(P.p.z), i = tz * w.width + tx;
        if (w.tiles[i] === T.LAVA && realmAt(w, tx, tz) === this.realm) {
          P.ember = true;
          this.coolTile(i);
          this.set({ type: 'stone', tile: i });
        }
      }
      // the egg in the crater
      // (fire anywhere over the crater reaches down to it: the dragon can't fly down inside)
      const e = this.egg.position;
      if (this.s.egg === 'crater' && Math.hypot(P.p.x - e.x, P.p.z - e.z) < 2.6 && P.p.y - e.y < 5.5) {
        P.ember = true;
        if (kind === 'fire') this.hatch();
        else this.nag('Breathe fire on the egg with Ember!');
      }
    }
  }

  warm(i) {
    this.set({ type: 'warm', index: i });
    const old = this.sprites[i];
    this.group.remove(old);
    old.traverse((o) => o.geometry?.dispose());
    this.sprites[i] = this.makeSprite(i, true, old.userData.at);
    this.sprites[i].position.copy(old.position).setY(1.2);
    this.sprites[i].userData.loop = 0; // a happy loop-the-loop
    if (this.s.warm.length === SPRITES) {
      this.g.hud.showBanner('All the fire sprites are warm! 🔥', true);
      this.heard.add(FLICKER.river); // let Flicker say thank you first, when you're back
      this.pendingThanks = true;
    } else {
      this.g.hud.showBanner(`Fire sprite ${this.s.warm.length} of ${SPRITES} is warm! 🔥`, true);
      speakLine('n_sprite');
    }
  }

  updateEgg(dt, t, p) {
    const g = this.g;
    if (this.s.egg === 'island' && emberStage(this.s) === 'river' && !g.riding) {
      if (Math.hypot(p.x - this.egg.position.x, p.z - this.egg.position.z) < EGG_REACH) {
        this.set({ type: 'egg' });
        this.placeEgg();
        g.hud.showBanner('You found a warm dragon egg! 🥚🔥', true);
        speakLine('n_egg');
      }
    } else if (this.s.egg === 'island' && emberStage(this.s) === 'sprites' && !g.riding && Math.hypot(p.x - this.egg.position.x, p.z - this.egg.position.z) < EGG_REACH) {
      this.nag('Help Flicker warm up the fire sprites first!');
    }
    if (this.s.egg === 'carried' && g.riding) {
      const c = this.q.crater, w = g.world;
      const top = w.rockHeight[Math.floor(c.z) * w.width + Math.floor(c.x)] || 6;
      if (Math.hypot(g.riding.x - c.x, g.riding.z - c.z) < CRATER_REACH && g.riding.y > top - 1) {
        this.set({ type: 'eggSet' });
        this.placeEgg();
        g.hud.showBanner('The egg is in the volcano! Now breathe fire on it with Ember 🔥', true);
        speakLine('n_egg_set');
      }
    }
  }

  hatch() {
    this.set({ type: 'hatch' });
    this.hatching = 0; // shake, crack, and out pops the baby
    this.g.hud.showBanner('The egg is hatching! 🐣', true);
    speakLine('n_hatch');
  }

  hatchBaby(fresh) {
    const at = fresh ? { x: this.egg.position.x, z: this.egg.position.z } : this.g.playerInfo();
    this.baby = new BabyDragon(this.g.scene, 'ember', at);
    if (fresh) {
      this.baby.root.position.y = this.egg.position.y - 0.3;
      this.baby.y = this.baby.root.position.y;
    }
    this.egg.removeFromParent();
    this.syncMarkers();
    if (fresh && !this.s.babyName) {
      this.g.naming = true;
      const spec = DRAGONS.ember;
      this.g.hud.askName({ title: 'Your baby dragon hatched!', suggestion: suggestName('ember'), color: spec.colors.body }, (name) => {
        this.g.naming = false;
        this.set({ type: 'name', name: cleanName(name, 'ember') });
        this.g.hud.showBanner(`${this.s.babyName} will follow you everywhere! 🐉💛`, true);
      });
    }
  }

  animate(dt, t, p) {
    // Flicker bobs and flickers; warm sprites dance round the hearth
    this.flicker.position.y = 1.6 + Math.sin(t * 2) * 0.2;
    this.flicker.rotation.y = Math.atan2(p.x - this.q.hearth.x, p.z - this.q.hearth.z);
    this.flicker.scale.setScalar(2.4 * (1 + Math.sin(t * 9) * 0.04));
    const h = this.q.hearth;
    this.sprites.forEach((sp, k) => {
      const i = sp.userData.i;
      if (!this.s.warm.includes(i)) {
        // sleepy: slumped, rocking gently
        sp.rotation.z = Math.sin(t * 1.2 + i) * 0.15;
        sp.position.y = 0.45 + Math.sin(t * 1.5 + i) * 0.03;
        return;
      }
      // warm: fly back to the hearth and dance round it
      const a = t * 0.9 + (i / SPRITES) * Math.PI * 2;
      const want = { x: h.x + Math.cos(a) * 2.6, y: 1.2 + Math.sin(t * 3 + i) * 0.35, z: h.z + Math.sin(a) * 2.6 };
      const pos = sp.position;
      const k2 = Math.min(1, dt * 1.5);
      pos.x += (want.x - pos.x) * k2;
      pos.y += (want.y - pos.y) * k2;
      pos.z += (want.z - pos.z) * k2;
      if (sp.userData.loop !== undefined && sp.userData.loop < 1) {
        sp.userData.loop += dt;
        sp.rotation.x = sp.userData.loop * Math.PI * 2;
      } else sp.rotation.set(0, a + Math.PI / 2, 0);
      sp.scale.setScalar(1 + Math.sin(t * 9 + k) * 0.08);
    });
    // the egg glows (and shakes, then cracks open, when it hatches)
    const mat = this.egg.userData.mat;
    mat.emissiveIntensity = 0.3 + (Math.sin(t * 2.5) + 1) * 0.15;
    if (this.s.egg === 'island' || this.s.egg === 'crater') this.egg.rotation.y = t * 0.6;
    if (this.hatching !== undefined && this.hatching !== null) {
      this.hatching += dt;
      this.egg.rotation.z = Math.sin(this.hatching * 30) * 0.25 * Math.min(1, this.hatching);
      mat.emissiveIntensity = 0.6 + this.hatching;
      if (this.hatching > 1.4) {
        this.hatching = null;
        this.hatchBaby(true);
      }
    }
    // steam over freshly cooled lava
    this.steam = this.steam.filter((s) => {
      s.age += dt;
      s.mesh.position.y = 0.5 + s.age * 1.5;
      s.mesh.scale.setScalar(1 + s.age * 1.5);
      s.mesh.material.opacity = Math.max(0, 0.8 - s.age * 0.8);
      if (s.age < 1) return true;
      this.group.remove(s.mesh);
      s.mesh.geometry.dispose();
      return false;
    });
  }

  dispose() {
    for (const [, m] of this.markers) this.g.treasureView?.removeMarker(m);
    this.egg.removeFromParent();
    this.g.carryingOther = false;
    this.baby?.dispose();
    this.g.scene.remove(this.group);
    this.group.traverse((o) => o.geometry?.dispose());
  }
}
