// One play session: a generated world, the player and the follow camera.
import * as THREE from 'three';
import { generateWorld, isWalkable, tileAt, TREE_KIND, TOWN_HALF } from './worldgen.js';
import { T } from './tiles.js';
import { WorldRenderer } from './world/WorldRenderer.js';
import { Player } from './player/Player.js';
import { Input } from './player/input.js';
import { FollowCamera } from './camera/FollowCamera.js';
import { Hud } from './ui/Hud.js';
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
  constructor(seed, characterId, onExit, canvas) {
    this.world = generateWorld(seed);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 18, 40);
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 42);
    this.lights = addLights(this.scene);

    this.worldView = new WorldRenderer(this.world);
    this.scene.add(this.worldView.group);

    this.player = new Player(this.world, characterId, (x, z) => this.walkable(x, z));
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
    this.dayCycle = new DayCycle(this.scene, this.lights, { dayLength: DAY_LENGTHS[dayIndex] });
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

  // Oak tiles are open except for the trunk, so you can walk under the canopy.
  // Trees in the border wall stay solid so nobody walks off the map.
  walkable(x, z) {
    const w = this.world;
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
    const town = this.townAt(m.x, m.z);
    if (town !== this.currentTown) {
      if (town) this.hud.showBanner(town.name);
      else if (this.currentTown) this.hud.showBanner('Route');
      this.currentTown = town;
    }
    this.hud.update();
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.input.dispose();
    this.removeDrag();
    this.dayCycle.dispose();
    this.hud.dispose();
    this.worldView.dispose();
    this.player.character.dispose();
  }
}
