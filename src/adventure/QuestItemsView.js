// How the quest items look: Ember's egg (with a curl of smoke rising from it), Glimmer's gems
// (spinning and sparkling) and Frost's moon flower (a closed bud by day, glowing at night),
// plus the item the player is carrying.
import * as THREE from 'three';
import { VoxelGrid } from '../voxel/VoxelGrid.js';
import { buildGeometry } from '../voxel/builder.js';
import { ellipsoid, capsule, hash } from '../voxel/shapes.js';

const GROUND = 0.25;
const V = 1 / 24;

function eggGrid() {
  const g = new VoxelGrid();
  ellipsoid(g, [0, 6, 0], [4.2, 6, 4.2], (x, y, z) => (hash(x, y, z) < 0.12 ? '#e8742a' : hash(x + 9, y, z) < 0.08 ? '#f2b04a' : y > 9 ? '#fff4dc' : '#f5e6c8'));
  return g;
}

function flowerGrids() {
  const stem = new VoxelGrid();
  capsule(stem, [0, 0, 0], [0, 9, 0], 0.7, 0.6, '#3f9a4a');
  for (const [x, z] of [[2, 0], [-2, 1]]) capsule(stem, [0, 3, 0], [x, 5, z], 0.7, 0.5, '#4ac86b');
  const bud = new VoxelGrid();
  ellipsoid(bud, [0, 11, 0], [1.6, 2.4, 1.6], (x, y) => (y > 11 ? '#c9b8ff' : '#4ac86b'));
  const bloom = new VoxelGrid();
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2;
    capsule(bloom, [0, 11, 0], [Math.cos(ang) * 4.5, 12.5, Math.sin(ang) * 4.5], 1.3, 0.9, '#e9e2ff');
  }
  ellipsoid(bloom, [0, 11.5, 0], [1.4, 1.2, 1.4], '#ffe27a');
  return { stem, bud, bloom };
}

export class QuestItemsView {
  constructor(scene, items) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.items = items;

    this.eggGeo = buildGeometry(eggGrid(), { size: V, jitter: 0.02 });
    this.eggMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.egg = this.placed(new THREE.Mesh(this.eggGeo, this.eggMat), items.egg);

    // smoke curling up from the egg's hiding spot, so it can be found
    this.smoke = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: '#7d7672', transparent: true, opacity: 0.6 }), 24);
    this.smoke.frustumCulled = false;
    this.group.add(this.smoke);

    this.gemMat = new THREE.MeshPhongMaterial({ vertexColors: false, color: '#ffffff', emissive: '#3a6a5a', emissiveIntensity: 0.5, specular: '#ffffff', shininess: 200, flatShading: true });
    const gemGeo = new THREE.OctahedronGeometry(0.26, 0).scale(1, 1.4, 1);
    const tints = ['#7af0c8', '#ff9fd0', '#8ff0ff', '#c9a6ff', '#ffe27a'];
    this.gems = items.gems.map((p, i) => {
      const m = new THREE.Mesh(gemGeo, this.gemMat.clone());
      m.material.color.set(tints[i % tints.length]);
      m.castShadow = true;
      return this.placed(m, p, 0.45);
    });

    const f = flowerGrids();
    const flowerMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.bloomMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#8f9cff', emissiveIntensity: 0 });
    this.flower = new THREE.Group();
    this.flower.add(new THREE.Mesh(buildGeometry(f.stem, { size: V }), flowerMat));
    this.bud = new THREE.Mesh(buildGeometry(f.bud, { size: V }), flowerMat);
    this.bloom = new THREE.Mesh(buildGeometry(f.bloom, { size: V }), this.bloomMat);
    this.flower.add(this.bud, this.bloom);
    this.flower.scale.setScalar(2.4);
    this.placed(this.flower, items.flower);
    this.flowerLight = new THREE.PointLight('#a8b4ff', 0, 4, 1.5);
    this.flowerLight.position.set(items.flower.x + 0.5, 1, items.flower.z + 0.5);
    this.group.add(this.flowerLight);

    this.carried = null;
  }

  placed(obj, p, lift = 0) {
    obj.position.set(p.x + 0.5, GROUND + lift, p.z + 0.5);
    this.group.add(obj);
    return obj;
  }

  // state: { egg, flower, gems, carrying, showEgg, showGems, showFlower }; night: 0..1
  update(dt, t, state, night, player) {
    const eggOut = state.showEgg && !state.egg;
    this.egg.visible = eggOut;
    // smoke: a slow column of puffs above the egg
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    this.smoke.count = eggOut ? 24 : 0;
    for (let i = 0; eggOut && i < 24; i++) {
      const k = ((t * 0.25 + i / 24) % 1);
      const x = this.items.egg.x + 0.5 + Math.sin(k * 9 + i) * 0.25 * k;
      const z = this.items.egg.z + 0.5 + Math.cos(k * 7 + i) * 0.25 * k;
      const s = 0.12 + k * 0.35;
      q.setFromEuler(new THREE.Euler(i, k * 3, 0));
      this.smoke.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0.6 + k * 4, z), q, new THREE.Vector3(s, s, s)));
    }
    this.smoke.instanceMatrix.needsUpdate = true;

    this.gems.forEach((g, i) => {
      g.visible = state.showGems && !state.gems.includes(i);
      g.rotation.y = t * 2 + i;
      g.position.y = GROUND + 0.45 + Math.sin(t * 3 + i) * 0.08;
      g.material.emissiveIntensity = 0.4 + Math.max(0, Math.sin(t * 6 + i * 2)) * 0.6; // twinkle
    });

    // the flower opens at night
    const open = state.showFlower ? night : 0;
    this.flower.visible = state.showFlower && !state.flower;
    this.bud.visible = open < 0.5;
    this.bloom.visible = open >= 0.5;
    this.bloomMat.emissiveIntensity = 0.6 + Math.sin(t * 2) * 0.2;
    this.flowerLight.intensity = this.flower.visible && open >= 0.5 ? 3 : 0;

    this.updateCarried(state.carrying, player, t);
  }

  // The egg or flower, held up high over the player's head so it can be seen from behind.
  updateCarried(item, player, t) {
    if (this.carried?.userData.item !== item) {
      if (this.carried) this.carried.removeFromParent();
      this.carried = null;
      if (item === 'egg') this.carried = new THREE.Mesh(this.eggGeo, this.eggMat);
      if (item === 'flower') {
        this.carried = this.flower.clone();
        this.carried.children[1].visible = false; // shown open
        this.carried.children[2].visible = true;
        this.carried.scale.setScalar(1.3);
      }
      if (this.carried) {
        this.carried.userData.item = item;
        this.carried.position.set(0, item === 'egg' ? 1.32 : 1.22, 0.05);
        player.add(this.carried);
      }
    }
    if (this.carried) {
      this.carried.rotation.y = Math.sin(t * 2) * 0.15;
      this.carried.position.y = (this.carried.userData.item === 'egg' ? 1.32 : 1.22) + Math.abs(Math.sin(t * 4)) * 0.03;
    }
  }

  dispose() {
    this.carried?.removeFromParent();
    this.scene.remove(this.group);
    this.group.traverse((o) => o.geometry?.dispose());
  }
}
