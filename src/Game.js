// One play session: a generated world, the player and the follow camera.
import * as THREE from 'three';
import { generateWorld, isWalkable, tileAt } from './worldgen.js';
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
import { load, save } from './ui/storage.js';

const TOWN_PREFIX = ['Maple', 'Pebble', 'Ember', 'Mossy', 'Sunny', 'Acorn', 'Willow', 'Cobble', 'Breezy', 'Fern', 'Cinder', 'Berry'];
const TOWN_SUFFIX = ['Town', 'Village', 'Hollow', 'Meadow', 'City'];

export class Game {
  constructor(seed, characterId, onExit) {
    this.world = generateWorld(seed);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 18, 40);
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 42);
    this.lights = addLights(this.scene);

    this.worldView = new WorldRenderer(this.world);
    this.scene.add(this.worldView.group);

    this.player = new Player(this.world, characterId, (x, z) => isWalkable(this.world, x, z));
    this.scene.add(this.player.object);
    this.follow = new FollowCamera(this.camera, (x, z) => tileAt(this.world, x, z) === T.BUILDING);
    this.input = new Input();
    const saved = Number(load('daySpeed', DEFAULT_DAY_INDEX));
    const dayIndex = Number.isInteger(saved) && saved >= 0 && saved < DAY_LENGTHS.length ? saved : DEFAULT_DAY_INDEX;
    this.dayCycle = new DayCycle(this.scene, this.lights, { dayLength: DAY_LENGTHS[dayIndex] });
    this.hud = new Hud({
      seed,
      onExit,
      input: this.input,
      dayIndex,
      onDaySpeed: (i) => {
        this.dayCycle.dayLength = DAY_LENGTHS[i];
        save('daySpeed', String(i));
      },
    });

    const nameRng = createRng(`${seed}:names`);
    const prefixes = [...TOWN_PREFIX];
    this.towns = this.world.towns.map((t) => ({
      ...t,
      name: `${prefixes.splice(nameRng.int(0, prefixes.length - 1), 1)[0]} ${nameRng.pick(TOWN_SUFFIX)}`,
    }));
    this.currentTown = undefined;
  }

  townAt(x, z) {
    return this.towns.find((t) => Math.abs(x - t.cx + 0.5) < 8 && Math.abs(z - t.cz + 0.5) < 8);
  }

  update(dt, t) {
    this.player.update(dt, this.input, t);
    const p = this.player.position;
    this.follow.update(dt, p, this.player.motor.yaw);
    this.dayCycle.update(dt, p, this.camera);
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
    this.dayCycle.dispose();
    this.hud.dispose();
    this.worldView.dispose();
    this.player.character.dispose();
  }
}
