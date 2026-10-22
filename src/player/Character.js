// The voxel character's 3D body with simple walk / idle animation.
import * as THREE from 'three';
import { buildGeometry, voxelMaterial } from '../voxel/builder.js';
import { buildCharacterParts, PIVOTS } from '../voxel/models/characters.js';

const VS = 1 / 18; // voxel size

export class Character {
  constructor(id) {
    this.id = id;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.body.position.set(-4 * VS, 0, -2 * VS); // center the 8x4 body on the tile
    this.root.add(this.body);
    this.parts = {};
    for (const [name, grid] of Object.entries(buildCharacterParts(id))) {
      const pivot = PIVOTS[name];
      const mesh = new THREE.Mesh(buildGeometry(grid, { size: VS, origin: pivot, jitter: 0.03 }), voxelMaterial);
      mesh.castShadow = true;
      const holder = new THREE.Group();
      holder.position.set(pivot[0] * VS, pivot[1] * VS, pivot[2] * VS);
      holder.add(mesh);
      this.body.add(holder);
      this.parts[name] = holder;
    }
    // soft blob shadow so the character always reads as grounded
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    this.root.add(shadow);
  }

  // phase: walk cycle angle (0 when idle). time: seconds, for idle breathing.
  animate(phase, walking, time) {
    const p = this.parts;
    const swing = walking ? Math.sin(phase) * 0.7 : 0;
    p.legL.rotation.x = swing;
    p.legR.rotation.x = -swing;
    p.armL.rotation.x = -swing * 0.8;
    p.armR.rotation.x = swing * 0.8;
    p.armL.rotation.z = -0.06;
    p.armR.rotation.z = 0.06;
    const bob = walking ? Math.abs(Math.sin(phase)) * 0.045 : Math.sin(time * 2.2) * 0.008;
    this.body.position.y = bob;
    p.head.rotation.z = walking ? Math.sin(phase) * 0.05 : Math.sin(time * 1.1) * 0.03;
  }

  dispose() {
    this.root.traverse((o) => o.geometry?.dispose());
  }
}
