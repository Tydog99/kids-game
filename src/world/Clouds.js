// Puffy voxel clouds drifting around the sky. They sit closer than the sun, so they pass
// in front of it, pick up sunset colors, and fade away at night.
import * as THREE from 'three';
import { VoxelGrid } from '../voxel/VoxelGrid.js';
import { buildGreedyGeometry } from '../voxel/builder.js';
import { createRng } from '../rng.js';

const VOXEL = 0.5;
const COUNT = 20;

function cloudShape(rng, size) {
  const g = new VoxelGrid();
  const len = { small: 7, medium: 12, large: 18 }[size];
  const puffs = { small: 2, medium: 4, large: 6 }[size];
  // flat base
  for (let x = 0; x < len; x++)
    for (let z = -2; z <= 2; z++) if (Math.abs(z) < 2 || (x > 0 && x < len - 1)) g.set(x, 0, z, 0xffffff);
  // rounded puffs on top
  for (let i = 0; i < puffs; i++) {
    const cx = 1 + rng.int(0, len - 3), r = rng.int(2, size === 'small' ? 2 : 3);
    for (let y = 0; y <= r; y++)
      for (let z = -r; z <= r; z++)
        for (let x = -r; x <= r; x++)
          if (x * x + (y * y) * 1.6 + z * z <= r * r + 1) g.set(cx + x, y, z, 0xffffff);
  }
  const b = g.bounds();
  return buildGreedyGeometry(g, { size: VOXEL, origin: [(b.minX + b.maxX + 1) / 2, 0, 0] });
}

export class Clouds {
  constructor(scene) {
    this.scene = scene;
    const rng = createRng('clouds');
    const sizes = ['small', 'small', 'medium', 'medium', 'large'];
    this.geometries = Array.from({ length: 8 }, (_, i) => cloudShape(rng, sizes[i % sizes.length]));
    this.material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, fog: false });
    this.clouds = Array.from({ length: COUNT }, (_, i) => {
      const geoIndex = i % this.geometries.length;
      const mesh = new THREE.Mesh(this.geometries[geoIndex], this.material);
      mesh.renderOrder = 1;
      const scale = 0.8 + rng.next() * 0.6;
      mesh.scale.setScalar(scale);
      scene.add(mesh);
      const big = this.geometries[geoIndex].boundingSphere.radius * scale;
      return {
        mesh,
        az: (i / COUNT) * Math.PI * 2 + rng.next() * 0.3,
        el: ((4 + rng.next() * 15) * Math.PI) / 180, // the sun's path peaks at 14°, so many cross it
        dist: 22 + rng.next() * 8,
        speed: (0.012 + rng.next() * 0.02) * (6 / (big + 3)), // radians/s; small clouds drift faster
      };
    });
    this.tint = new THREE.Color();
  }

  // day: 0..1 daylight, sunset: 0..1 warm glow
  update(dt, camera, day, sunset) {
    const opacity = Math.min(1, Math.max(0, (day - 0.15) / 0.6));
    this.material.opacity = opacity;
    this.tint.setRGB(1, 1 - sunset * 0.22, 1 - sunset * 0.42).multiplyScalar(0.7 + 0.3 * day);
    this.material.color.copy(this.tint);
    const c = camera.position;
    for (const cl of this.clouds) {
      cl.az += cl.speed * dt;
      cl.mesh.visible = opacity > 0.01;
      cl.mesh.position.set(
        c.x + Math.cos(cl.el) * Math.cos(cl.az) * cl.dist,
        c.y + Math.sin(cl.el) * cl.dist,
        c.z + Math.cos(cl.el) * Math.sin(cl.az) * cl.dist,
      );
      cl.mesh.rotation.y = -cl.az; // long side faces the viewer
    }
  }

  dispose() {
    for (const cl of this.clouds) this.scene.remove(cl.mesh);
    this.geometries.forEach((g) => g.dispose());
    this.material.dispose();
  }
}
