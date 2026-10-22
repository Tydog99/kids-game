// The voxel character's 3D body with simple walk / idle animation.
import * as THREE from 'three';
import { buildGeometry, voxelMaterial } from '../voxel/builder.js';
import { buildCharacterParts, PIVOTS, VOXEL_SIZE as VS } from '../voxel/models/characters.js';

export class Character {
  constructor(id) {
    this.id = id;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.parts = {};
    for (const [name, grid] of Object.entries(buildCharacterParts(id))) {
      const pivot = PIVOTS[name];
      const mesh = new THREE.Mesh(buildGeometry(grid, { size: VS, origin: pivot, jitter: 0.015 }), voxelMaterial);
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

  // phase: walk cycle angle. stride: 0 (standing) .. 1 (full walk). time: seconds, for idle breathing.
  animate(phase, stride, time) {
    const p = this.parts;
    const a = Number(stride);
    const swing = Math.sin(phase) * 0.65 * a;
    p.legL.rotation.x = swing;
    p.legR.rotation.x = -swing;
    p.armL.rotation.x = -swing * 0.8;
    p.armR.rotation.x = swing * 0.8;
    p.armL.rotation.z = -0.07 - Math.sin(time * 2.2) * 0.015 * (1 - a);
    p.armR.rotation.z = 0.07 + Math.sin(time * 2.2) * 0.015 * (1 - a);
    p.torso.rotation.y = Math.sin(phase) * 0.06 * a;
    this.body.position.y = Math.abs(Math.sin(phase)) * 0.035 * a + Math.sin(time * 2.2) * 0.006 * (1 - a);
    p.head.rotation.z = Math.sin(phase) * 0.04 * a + Math.sin(time * 1.1) * 0.025 * (1 - a);
  }

  dispose() {
    this.root.traverse((o) => o.geometry?.dispose());
  }
}
