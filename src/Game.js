// One play session: a generated world, the player and the follow camera.
import * as THREE from 'three';
import { generateWorld, isWalkable, tileAt, TREE_KIND, TOWN_HALF, DIRS } from './worldgen.js';
import { T } from './tiles.js';
import { WorldRenderer } from './world/WorldRenderer.js';
import { Environment } from './world/environment.js';
import { EnvironmentView } from './world/EnvironmentView.js';
import { Player } from './player/Player.js';
import { Input } from './player/input.js';
import { FollowCamera } from './camera/FollowCamera.js';
import { Hud } from './ui/Hud.js';
import { placeTreasure, TreasureHunt } from './treasure.js';
import { Story } from './adventure/Story.js';
import { TreasureView } from './world/TreasureView.js';
import { RADIUS as PLAYER_RADIUS } from './player/PlayerMotor.js';
import { addLights, SKY } from './scene.js';
import { createRng } from './rng.js';
import { DayCycle } from './world/DayCycle.js';
import { WorldDragons } from './world/WorldDragons.js';
import { GROUND_Y } from './creatures/rideMotor.js';
import { updateTrust, heartsFor, suggestName, cleanName } from './creatures/trust.js';
import { DRAGONS } from './creatures/dragonModels.js';
import { MAX_DRAGONS } from './creatures/dragonSpawns.js';
import { DAY_LENGTHS, DEFAULT_DAY_INDEX } from './world/skyState.js';
import { METEOR_RATES, DEFAULT_METEOR_INDEX } from './world/shootingStars.js';
import { load, save } from './ui/storage.js';
import { music } from './audio/Music.js';

const OAK_TRUNK_RADIUS = 0.16;
const ENV_TOP = { tree: 3.6, building: 6.8 }; // breath below this height hits the thing on that tile
const MOUNT_REACH = 1.3; // how close (to the dragon's body) the player must be to climb on
const TRUST_SHOW = 7; // show trust hearts when this close to an untrusted dragon
const WALK_HINT = '⬆ walk &nbsp; ⬇ back up &nbsp; ⬅ ➡ turn &nbsp; 🖱 drag to look around';
const RIDE_HINT = '⬆ fly &nbsp; ⬅ ➡ turn &nbsp; <b>Space</b> up &nbsp; <b>Shift</b> down &nbsp; <b>F</b> breathe &nbsp; <b>E</b> climb off';
// what's on each tile, for a ridden dragon: how high it reaches and whether it can land there
const TILE_TOP = { [T.TREE]: 3.8, [T.BUILDING]: 7, [T.WATER]: 1.2, [T.LAVA]: 1.2 };

const TOWN_PREFIX = ['Maple', 'Pebble', 'Ember', 'Mossy', 'Sunny', 'Acorn', 'Willow', 'Cobble', 'Breezy', 'Fern', 'Cinder', 'Berry'];
const TOWN_SUFFIX = ['Town', 'Village', 'Hollow', 'Meadow', 'City'];

export class Game {
  // mode: 'adventure' (the Dragon Keeper story) or 'free' (free play)
  // onOptions: opens the Options menu (from the HUD button)
  constructor(seed, characterId, onExit, canvas, mode = 'free', onOptions = () => {}) {
    this.world = generateWorld(seed);
    this.mode = mode;
    if (mode === 'adventure') {
      this.hunt = new TreasureHunt(placeTreasure(this.world));
      const c = this.hunt.chest;
      this.chestTile = c.z * this.world.width + c.x;
    }
    this.scene = new THREE.Scene();
    // the sky is its own layer, drawn first; the world is drawn over it (see main.js)
    this.skyScene = new THREE.Scene();
    this.skyScene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 18, 40);
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 42);
    this.lights = addLights(this.scene);

    this.worldView = new WorldRenderer(this.world);
    this.scene.add(this.worldView.group);
    // trees and buildings that dragon breath can burn, freeze or turn to diamond
    this.envView = new EnvironmentView(this.scene, this.worldView);
    this.env = new Environment(this.world, (obj, how) => this.envView.show(obj, how));

    this.player = new Player(this.startTile(), characterId, (x, z) => this.walkable(x, z));
    this.scene.add(this.player.object);
    this.playerView = new THREE.Vector3();
    this.focusPoint = new THREE.Vector3();
    // buildings block the camera's view, unless you're flying above them
    this.follow = new FollowCamera(
      this.camera,
      (x, z, y, px, pz) => y < 6 && (tileAt(this.world, x, z) === T.BUILDING || this.dragonAt(px, pz)),
    );
    this.input = new Input();
    const savedIndex = (key, fallback, count) => {
      const n = Number(load(key, fallback));
      return Number.isInteger(n) && n >= 0 && n < count ? n : fallback;
    };
    const dayIndex = savedIndex('daySpeed', DEFAULT_DAY_INDEX, DAY_LENGTHS.length);
    const meteorIndex = savedIndex('meteors', DEFAULT_METEOR_INDEX, METEOR_RATES.length);
    const dragonCount = savedIndex('dragons', 3, MAX_DRAGONS + 1);
    this.dayCycle = new DayCycle(this.scene, this.skyScene, this.lights, { dayLength: DAY_LENGTHS[dayIndex] });
    this.dayCycle.shootingStars.perSecond = METEOR_RATES[meteorIndex].perSecond;
    this.hud = new Hud({
      seed,
      onExit,
      onOptions,
      input: this.input,
      dayIndex,
      onDaySpeed: (i) => {
        this.dayCycle.dayLength = DAY_LENGTHS[i];
        save('daySpeed', String(i));
      },
      dragonCount,
      musicVolume: music.volume,
      onMusicVolume: (n) => {
        music.setVolume(n);
        music.unlock();
        save('music', String(n));
      },
      onDragonCount: (n) => {
        this.dragons.setCount(n);
        save('dragons', String(n));
      },
      meteorIndex,
      onMeteorRate: (i) => {
        this.dayCycle.shootingStars.perSecond = METEOR_RATES[i].perSecond;
        save('meteors', String(i));
      },
    });

    this.setupDragToOrbit(canvas);

    // dragons roam where they have open ground (no trees, water, buildings or the chest)
    this.dragons = new WorldDragons(this.scene, this.world, (x, z) => this.walkable(x, z) === true);
    if (mode !== 'adventure') this.dragons.setCount(dragonCount);
    // dragons that trust you are saved per world
    this.namesKey = `trusted:${seed}`;
    let names = {};
    try {
      names = JSON.parse(load(this.namesKey, '{}')) ?? {};
    } catch {
      /* ignore a corrupt save */
    }
    this.dragons.setNames(names);
    this.player.motor.obstacles = () => (this.riding ? [] : [...this.dragons.obstacles(), ...(this.story ? [this.story.ollie.obstacle] : [])]);
    this.riding = null; // the WorldDragon being ridden
    this.naming = false; // the dragon-naming box is open
    this.modal = false; // something like the Dragon Book is open; the game waits
    this.refreshMyDragons(true);

    if (this.hunt) {
      this.treasureView = new TreasureView(this.scene, this.hunt);
      this.hud.hideDragonSlider();
      this.story = new Story(this);
    }

    const nameRng = createRng(`${seed}:names`);
    const prefixes = [...TOWN_PREFIX];
    this.towns = this.world.towns.map((t) => ({
      ...t,
      name: `${prefixes.splice(nameRng.int(0, prefixes.length - 1), 1)[0]} ${nameRng.pick(TOWN_SUFFIX)}`,
    }));
    this.currentTown = undefined;
  }

  setupDragToOrbit(canvas) {
    let lastX = 0;
    const down = (e) => {
      if (this.suspended || (e.button !== 0 && e.button !== 2)) return;
      this.follow.dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('dragging');
    };
    const move = (e) => {
      if (!this.follow.dragging) return;
      // drag right → look right (like mouse-look in most games)
      this.follow.addOrbit(-(e.clientX - lastX) * 0.008);
      lastX = e.clientX;
    };
    const up = () => {
      this.follow.dragging = false;
      canvas.classList.remove('dragging');
    };
    const menu = (e) => e.preventDefault();
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', menu);
    canvas.classList.add('orbit');
    this.removeDrag = () => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('contextmenu', menu);
      canvas.classList.remove('orbit', 'dragging');
    };
  }

  // Start a couple of steps out from the store door, so the camera has room behind the
  // player instead of being squeezed under the store's awning.
  startTile() {
    const { x, z, facing } = this.world.spawn;
    const [dx, dz] = DIRS[facing];
    let steps = 0;
    while (steps < 2 && this.walkable(x + dx * (steps + 1), z + dz * (steps + 1)) === true) steps++;
    return { x: x + dx * steps, z: z + dz * steps, facing };
  }

  // Oak tiles are open except for the trunk, so you can walk under the canopy.
  // Trees in the border wall stay solid so nobody walks off the map.
  walkable(x, z) {
    const w = this.world;
    if (z * w.width + x === this.chestTile && x >= 0 && x < w.width) return false;
    const border = x < 2 || z < 2 || x >= w.width - 2 || z >= w.height - 2;
    if (!border && tileAt(w, x, z) === T.TREE && w.treeKind[z * w.width + x] === TREE_KIND.OAK) return OAK_TRUNK_RADIUS;
    return isWalkable(w, x, z);
  }

  townAt(x, z) {
    return this.towns.find((t) => Math.abs(x - t.cx + 0.5) <= TOWN_HALF && Math.abs(z - t.cz + 0.5) <= TOWN_HALF);
  }

  // ---- dragon breath vs. trees and buildings ----

  applyChange(change) {
    if (change && change.to !== 'gone') this.envView.show(change.obj);
  }

  // Breath from the dragon you're riding hits whatever tree or building it reaches.
  breathHits() {
    const d = this.riding?.dragon;
    if (!d?.breath) return;
    const kind = d.spec.breath;
    // the cold (or heat) also reaches the water right under the dragon's neck and head, so a
    // frozen path starts at the shore instead of where the breath first lands
    if (d.breathing && d.breathOpen > 0.5 && (kind === 'ice' || kind === 'fire') && this.riding.y < 3) {
      const mouth = d.mouth.getWorldPosition(this.tmpMouth ?? (this.tmpMouth = new THREE.Vector3()));
      const r = this.riding;
      for (let k = 0.3; k <= 1.001; k += 0.1) {
        const x = r.x + (mouth.x - r.x) * k, z = r.z + (mouth.z - r.z) * k;
        const c = this.env.hitGround(Math.floor(x), Math.floor(z), kind);
        if (c) this.envView.setLakeIce(c.tile, c.x, c.z, c.to === 'ice');
      }
    }
    for (const P of d.breath.particles) {
      if (P.used) continue;
      const tx = Math.floor(P.p.x), tz = Math.floor(P.p.z);
      const obj = this.env.at(tx, tz);
      if (!obj) {
        // breath passing over a lake: ice freezes the water, fire melts lake ice
        if (P.p.y < (kind === 'fire' ? 4 : 6)) {
          const c = this.env.hitGround(tx, tz, kind);
          if (c) {
            P.used = true;
            this.envView.setLakeIce(c.tile, c.x, c.z, c.to === 'ice');
          }
        }
        continue;
      }
      if (P.p.y > ENV_TOP[obj.type]) continue;
      // breath that can't change this thing (fire on fire, diamonds on diamond) carries on past it
      const change = this.env.hit(obj, kind);
      if (!change) continue;
      P.used = true;
      this.applyChange(change);
    }
  }

  // Bumping into something frozen shatters it (on foot, or on a dragon close to the ground).
  touchIce() {
    let x, z, r;
    if (this.riding) {
      if (this.riding.y > 2.5) return;
      ({ x, z } = this.riding);
      r = 0.95;
    } else {
      ({ px: x, pz: z } = this.player.motor);
      r = PLAYER_RADIUS + 0.15;
    }
    for (let tz = Math.floor(z - r); tz <= Math.floor(z + r); tz++)
      for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
        const obj = this.env.at(tx, tz);
        if (obj?.state !== 'frozen') continue;
        // distance from (x, z) to this tile's square
        const dx = Math.max(tx - x, 0, x - (tx + 1)), dz = Math.max(tz - z, 0, z - (tz + 1));
        if (Math.hypot(dx, dz) <= r) this.env.touch(obj);
      }
  }

  // ---- dragons: trust, calling, riding ----

  tileForDragon(tx, tz) {
    const w = this.world;
    if (this.walkable(tx, tz) === true) return { top: GROUND_Y, land: true };
    if (tx < 0 || tz < 0 || tx >= w.width || tz >= w.height) return { top: 99, land: false };
    if (tz * w.width + tx === this.chestTile) return { top: 1.4, land: false };
    return { top: TILE_TOP[tileAt(w, tx, tz)] ?? 3.8, land: false };
  }

  // Is a grounded dragon (other than the one being ridden) standing at this point?
  dragonAt(x, z) {
    for (const d of this.dragons?.list ?? []) if (d !== this.riding && d.y < GROUND_Y + 1 && d.distanceTo(x, z) < 0.4) return true;
    return false;
  }

  playerInfo() {
    const m = this.player.motor;
    return { x: m.px, z: m.pz, speed: Math.abs(m.speed), heading: m.yaw };
  }

  refreshMyDragons(force = false) {
    this.statusTimer = (this.statusTimer ?? 0) - 1;
    if (!force && this.statusTimer > 0) return;
    this.statusTimer = 15;
    const mine = this.dragons.list.filter((d) => d.trusted).sort((a, b) => a.index - b.index);
    this.hud.showMyDragons(
      mine.map((d) => ({
        index: d.index,
        name: d.name,
        color: DRAGONS[d.kind].colors.body,
        status: d === this.riding ? 'Riding' : d.summon ? 'On the way…' : d.waiting > 0 ? 'Waiting for you' : '',
      })),
      (index) => this.callDragon(index),
    );
  }

  callDragon(index) {
    const d = this.dragons.get(index);
    if (!d) return;
    if (this.riding) {
      this.hud.showBanner(this.riding === d ? `You're riding ${d.name}!` : `Climb off ${this.riding.name} first`, true);
      return;
    }
    d.callTo(this.playerInfo());
    this.hud.showBanner(`${d.name} is on the way!`, true);
    this.refreshMyDragons(true);
  }

  // Trust builds with grounded dragons you stay close to; shows hearts for the closest one.
  updateTrust(dt) {
    const p = this.playerInfo();
    let shown = null;
    for (const d of this.dragons.list) {
      if (d.trusted) continue;
      const distance = d.distanceTo(p.x, p.z);
      // in the adventure, a dragon only starts to trust you once you've helped it
      if (this.story && !this.story.canBefriend(d)) {
        d.trust = 0;
        if (this.story.trustHint(d) && distance < TRUST_SHOW && d.grounded && (!shown || distance < shown.distance)) shown = { d, distance };
        continue;
      }
      if (!this.naming) d.trust = updateTrust(d.trust, dt, { distance, grounded: d.grounded && !d.summon, playerSpeed: p.speed });
      if (distance < TRUST_SHOW && d.grounded && (!shown || distance < shown.distance)) shown = { d, distance };
      if (d.trust >= 1 && !this.naming) this.befriend(d);
    }
    if (!shown || this.riding) return this.hud.showTrust(null);
    const { d } = shown;
    const kind = DRAGONS[d.kind].name;
    const locked = this.story && !this.story.canBefriend(d);
    const text = locked
      ? this.story.trustHint(d)
      : d.trust >= 1 ? `${kind} trusts you!` : shown.distance > 3.5 ? `Come closer to make friends with ${kind}` : p.speed > 0.3 ? `Stay calm… ${kind} is watching you` : `${kind} is getting to know you…`;
    this.hud.showTrust({ hearts: heartsFor(d.trust), text, color: DRAGONS[d.kind].colors.body });
  }

  befriend(d) {
    this.naming = true;
    this.hud.showTrust(null);
    const spec = DRAGONS[d.kind];
    this.hud.askName({ title: `${spec.name} trusts you!`, suggestion: suggestName(d.kind), color: spec.colors.body }, (name) => {
      this.naming = false;
      const names = { ...this.dragons.names, [d.index]: cleanName(name, d.kind) };
      this.dragons.setNames(names);
      if (this.story) this.story.onBefriend(d, names[d.index]);
      else save(this.namesKey, JSON.stringify(names));
      this.hud.showBanner(`${names[d.index]} is your dragon! Press E to ride`, true);
      this.refreshMyDragons(true);
    });
  }

  nearestRideable() {
    const p = this.playerInfo();
    let best = null;
    for (const d of this.dragons.list) {
      if (!d.trusted || !d.grounded || d.summon) continue;
      const dist = d.distanceTo(p.x, p.z);
      if (dist < MOUNT_REACH && (!best || dist < best.dist)) best = { d, dist };
    }
    return best?.d ?? null;
  }

  mount(d) {
    this.riding = d;
    d.mount((x, z) => this.tileForDragon(x, z));
    const ch = this.player.character;
    const s = d.scale;
    ch.root.removeFromParent();
    d.dragon.hips.add(ch.root);
    ch.root.scale.setScalar(1 / s);
    ch.root.rotation.set(0, 0, 0);
    // the character's hips (0.4 above its feet) go on the dragon's seat
    ch.root.position.copy(d.dragon.seat).add(new THREE.Vector3(0, -0.36 / s, 0));
    ch.seated = true;
    ch.shadow.visible = false;
    this.follow.zoomTarget = 1.9 + (s - 1.4) * 0.6;
    this.hud.setRiding(true);
    this.hud.setHint(RIDE_HINT);
    this.hud.showBanner(`Riding ${d.name}! Space to fly up, Shift to fly down`, true);
    this.refreshMyDragons(true);
  }

  dismount() {
    const d = this.riding;
    const m = this.player.motor;
    // step off beside the dragon onto open ground
    const fits = (x, z) => this.walkable(Math.floor(x), Math.floor(z)) === true && m.fits(x, z) && d.distanceTo(x, z) > 0.35;
    let spot = null;
    for (let r = d.bodyR + 1.6; r < d.bodyR + 5 && !spot; r += 0.5)
      for (let i = 0; i < 16 && !spot; i++) {
        const a = d.heading + Math.PI / 2 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 8);
        const x = d.x + Math.sin(a) * r, z = d.z + Math.cos(a) * r;
        if (fits(x, z)) spot = { x, z };
      }
    if (!spot) return this.hud.showBanner('No room to climb off here', true);
    d.dismount();
    const ch = this.player.character;
    ch.root.removeFromParent();
    this.scene.add(ch.root);
    ch.root.scale.setScalar(1);
    ch.seated = false;
    ch.shadow.visible = true;
    m.px = spot.x;
    m.pz = spot.z;
    m.speed = 0;
    // turn to face the dragon, so the camera ends up behind the player and not inside the dragon
    m.yaw = Math.atan2(d.x + Math.sin(d.heading) * d.bodyOffset - spot.x, d.z + Math.cos(d.heading) * d.bodyOffset - spot.z);
    this.player.sync(0);
    this.follow.first = true;
    this.riding = null;
    this.follow.zoomTarget = 1;
    this.hud.setRiding(false);
    this.hud.setHint(WALK_HINT);
    this.refreshMyDragons(true);
  }

  update(dt, t) {
    const blocked = this.naming || this.modal;
    if (this.modal) this.input.clearTaps();
    const interact = blocked ? false : this.input.takeTap('interact');
    let p;
    if (this.riding) {
      const d = this.riding;
      d.ride(dt, blocked ? {} : this.input.peek());
      this.input.clearTaps();
      // keep the player's position in step for town names, treasure, etc.
      const m = this.player.motor;
      m.px = d.x;
      m.pz = d.z;
      m.yaw = d.heading;
      m.speed = d.motor.speed;
      this.player.character.animate(0, 0, t);
      if (interact) {
        if (d.motor.grounded) this.dismount();
        else this.hud.showBanner('Land first: hold Shift to fly down', true);
      }
      p = this.focusPoint.set(d.x, d.y + 0.9 * d.scale, d.z);
    } else {
      if (interact) {
        const d = this.nearestRideable();
        if (d) this.mount(d);
        else if (this.story?.examinable()) this.story.examine(this.story.examinable());
        else if (this.story?.nearOllie()) this.story.talk();
      }
      if (!this.riding) {
        this.player.update(dt, blocked ? { peek: () => ({}), clearTaps() {} } : this.input, t);
        p = this.player.position;
      } else p = this.focusPoint.set(this.riding.x, this.riding.y + 0.9 * this.riding.scale, this.riding.z);
    }
    const yaw = this.riding ? this.riding.heading : this.player.motor.yaw;
    const moving = this.riding ? this.riding.motor.speed !== 0 : this.player.motor.speed !== 0;
    this.follow.update(dt, p, yaw, moving);
    this.dayCycle.update(dt, p, this.camera);
    music.setNight(this.dayCycle.state.stars > 0.5); // softer music once the stars are out
    this.camera.updateMatrixWorld();
    this.playerView.set(p.x, p.y + 0.7, p.z).applyMatrix4(this.camera.matrixWorldInverse);
    this.worldView.setPlayerView(this.playerView);
    this.worldView.update(t);
    this.dragons.update(dt, this.riding ? null : this.playerInfo());
    this.breathHits();
    this.touchIce();
    for (const c of this.env.update(dt)) this.applyChange(c);
    this.envView.update(dt, this.env.burning);
    this.updateTrust(dt);
    this.refreshMyDragons();
    if (this.riding) {
      const d = this.riding;
      this.hud.showPrompt(d.motor.grounded ? `E · climb off ${d.name}` : null);
    } else {
      const d = this.nearestRideable();
      const look = !d && this.story?.examinable();
      const ollie = !d && !look && this.story?.nearOllie();
      this.hud.showPrompt(d ? `🐉 E · ride ${d.name}` : look ? `📖 E · look at ${DRAGONS[look.kind].name}` : ollie ? '💬 E · talk to Grandpa Ollie' : null);
    }

    const m = this.player.motor;
    if (this.hunt) this.updateHunt(dt, t, m);
    this.story?.update(dt, t);
    const town = this.townAt(m.x, m.z);
    if (town !== this.currentTown) {
      if (town) this.hud.showBanner(town.name);
      else if (this.currentTown) this.hud.showBanner('Route');
      this.currentTown = town;
    }
    this.hud.update();
  }

  updateHunt(dt, t, m) {
    // keys and the chest can be reached from a dragon's back, but not while flying high
    const reach = this.riding ? (this.riding.y < 3 ? this.riding.bodyR : -1) : PLAYER_RADIUS;
    const events = reach < 0 ? [] : this.hunt.update(dt, m.px, m.pz, reach);
    for (const e of events) {
      this.story?.onHuntEvent(e);
      if (e.type === 'key') {
        this.treasureView.collectKey(e.key);
        if (e.count < this.hunt.keys.length) this.hud.showBanner(`Golden key ${e.count} of ${this.hunt.keys.length}!`, true);
      } else if (e.type === 'allKeys') {
        this.treasureView.showChestBeam();
        this.hud.showBanner('All 3 keys! Head back to the treasure chest', true);
      } else if (e.type === 'locked') {
        this.hud.showBanner(e.missing === 1 ? 'Locked! Find 1 more golden key' : `Locked! Find ${e.missing} more golden keys`, true);
      } else if (e.type === 'open') {
        this.treasureView.open();
        this.hud.showBanner('You opened the treasure!', true);
      }
    }
    this.treasureView.update(dt, t, this.camera);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  // Pause while another screen (like Dragon Designs) is open on top; everything is kept.
  suspend() {
    this.suspended = true;
    this.hud.el.hidden = true;
  }

  resume() {
    this.suspended = false;
    this.hud.el.hidden = false;
    this.input.onBlur(); // forget keys that were held while away
    this.input.clearTaps();
  }

  dispose() {
    this.input.dispose();
    this.removeDrag();
    this.dragons.dispose();
    this.story?.dispose();
    this.treasureView?.dispose();
    this.dayCycle.dispose();
    this.hud.dispose();
    this.worldView.dispose();
    this.envView.dispose();
    this.player.character.dispose();
  }
}
