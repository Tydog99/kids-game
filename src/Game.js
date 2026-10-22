// One play session: a generated world, the player and the follow camera.
import * as THREE from 'three';
import { generateWorld, isWalkable, tileAt, TREE_KIND, TOWN_HALF, DIRS } from './worldgen.js';
import { T } from './tiles.js';
import { WorldRenderer } from './world/WorldRenderer.js';
import { Player } from './player/Player.js';
import { Input } from './player/input.js';
import { FollowCamera } from './camera/FollowCamera.js';
import { Hud } from './ui/Hud.js';
import { placeTreasure, TreasureHunt } from './treasure.js';
import { TreasureView } from './world/TreasureView.js';
import { RADIUS as PLAYER_RADIUS } from './player/PlayerMotor.js';
import { addLights, SKY } from './scene.js';
import { createRng } from './rng.js';
import { DayCycle } from './world/DayCycle.js';
import { DAY_LENGTHS, DEFAULT_DAY_INDEX } from './world/skyState.js';
import { METEOR_RATES, DEFAULT_METEOR_INDEX } from './world/shootingStars.js';
import { load, save } from './ui/storage.js';

const OAK_TRUNK_RADIUS = 0.16;

const TOWN_PREFIX = ['Maple', 'Pebble', 'Ember', 'Mossy', 'Sunny', 'Acorn', 'Willow', 'Cobble', 'Breezy', 'Fern', 'Cinder', 'Berry'];
const TOWN_SUFFIX = ['Town', 'Village', 'Hollow', 'Meadow', 'City'];

export class Game {
  // mode: 'explore' or 'treasure'
  constructor(seed, characterId, onExit, canvas, mode = 'explore') {
    this.world = generateWorld(seed);
    this.mode = mode;
    if (mode === 'treasure') {
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

    this.player = new Player(this.startTile(), characterId, (x, z) => this.walkable(x, z));
    this.scene.add(this.player.object);
    this.playerView = new THREE.Vector3();
    this.follow = new FollowCamera(this.camera, (x, z) => tileAt(this.world, x, z) === T.BUILDING);
    this.input = new Input();
    const savedIndex = (key, fallback, count) => {
      const n = Number(load(key, fallback));
      return Number.isInteger(n) && n >= 0 && n < count ? n : fallback;
    };
    const dayIndex = savedIndex('daySpeed', DEFAULT_DAY_INDEX, DAY_LENGTHS.length);
    const meteorIndex = savedIndex('meteors', DEFAULT_METEOR_INDEX, METEOR_RATES.length);
    this.dayCycle = new DayCycle(this.scene, this.skyScene, this.lights, { dayLength: DAY_LENGTHS[dayIndex] });
    this.dayCycle.shootingStars.perSecond = METEOR_RATES[meteorIndex].perSecond;
    this.hud = new Hud({
      seed,
      onExit,
      input: this.input,
      dayIndex,
      onDaySpeed: (i) => {
        this.dayCycle.dayLength = DAY_LENGTHS[i];
        save('daySpeed', String(i));
      },
      meteorIndex,
      onMeteorRate: (i) => {
        this.dayCycle.shootingStars.perSecond = METEOR_RATES[i].perSecond;
        save('meteors', String(i));
      },
    });

    this.setupDragToOrbit(canvas);

    if (this.hunt) {
      this.treasureView = new TreasureView(this.scene, this.hunt);
      this.hud.showKeys(0, this.hunt.keys.length);
      this.hunt.debugOpenWithoutKeys = load('debugOpen', 'false') === 'true';
      this.hud.showDebugToggle(this.hunt.debugOpenWithoutKeys, (on) => {
        this.hunt.debugOpenWithoutKeys = on;
        save('debugOpen', String(on));
      });
      this.hud.showBanner('Find the 3 golden keys! Follow the beams of light', true);
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
      if (e.button !== 0 && e.button !== 2) return;
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

  update(dt, t) {
    this.player.update(dt, this.input, t);
    const p = this.player.position;
    this.follow.update(dt, p, this.player.motor.yaw, this.player.motor.speed !== 0);
    this.dayCycle.update(dt, p, this.camera);
    this.camera.updateMatrixWorld();
    this.playerView.set(p.x, p.y + 0.7, p.z).applyMatrix4(this.camera.matrixWorldInverse);
    this.worldView.setPlayerView(this.playerView);
    this.worldView.update(t);

    const m = this.player.motor;
    if (this.hunt) this.updateHunt(dt, t, m);
    const town = this.townAt(m.x, m.z);
    if (town !== this.currentTown) {
      if (town) this.hud.showBanner(town.name);
      else if (this.currentTown) this.hud.showBanner('Route');
      this.currentTown = town;
    }
    this.hud.update();
  }

  updateHunt(dt, t, m) {
    for (const e of this.hunt.update(dt, m.px, m.pz, PLAYER_RADIUS)) {
      if (e.type === 'key') {
        this.treasureView.collectKey(e.key);
        this.hud.showKeys(e.count, this.hunt.keys.length);
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

  dispose() {
    this.input.dispose();
    this.removeDrag();
    this.treasureView?.dispose();
    this.dayCycle.dispose();
    this.hud.dispose();
    this.worldView.dispose();
    this.player.character.dispose();
  }
}
