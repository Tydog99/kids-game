// Moves the sun and moon around the world and updates light, shadows and sky to match.
import * as THREE from 'three';
import { skyState } from './skyState.js';
import { VoxelGrid } from '../voxel/VoxelGrid.js';
import { buildGeometry } from '../voxel/builder.js';

const SKY_DISTANCE = 34; // how far away the sun/moon/stars are drawn (inside the camera's far plane)
const LIGHT_DISTANCE = 20;

function celestial(build, size) {
  const g = new VoxelGrid();
  build(g);
  const geo = buildGeometry(g, { size, origin: [3.5, 3.5, 3.5], jitter: 0.04 });
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
}

const inDisc = (x, y, r) => (x - 3.5) ** 2 + (y - 3.5) ** 2 <= r * r;

export class DayCycle {
  constructor(scene, lights, { phase = 0.08, dayLength = 30 } = {}) {
    this.scene = scene;
    this.lights = lights;
    this.phase = phase;
    this.dayLength = dayLength;

    this.sun = celestial((g) => {
      g.box(0, 0, 0, 7, 7, 1, (x, y) => (inDisc(x, y, 4.2) ? (inDisc(x, y, 2.6) ? '#fff6b0' : '#ffd23f') : null));
    }, 0.42);
    this.moon = celestial((g) => {
      g.box(0, 0, 0, 7, 7, 1, (x, y) => (inDisc(x, y, 4.2) ? '#eef2ff' : null));
      for (const [x, y] of [[2, 4], [5, 2], [4, 5], [2, 2]]) g.set(x, y, 2, '#c5cce0').set(x, y, 1, '#c5cce0');
    }, 0.32);
    // glow halo behind the sun
    this.halo = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 24),
      new THREE.MeshBasicMaterial({ color: '#fff1a8', transparent: true, opacity: 0.35, fog: false, depthWrite: false }),
    );
    this.sun.add(this.halo);
    this.halo.position.z = -0.4;

    const starPos = [];
    for (let i = 0; i < 400; i++) {
      const u = Math.random() * 2 * Math.PI, v = Math.acos(Math.random() * 0.95);
      starPos.push(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u));
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos.map((p) => p * SKY_DISTANCE * 1.05), 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));

    scene.add(this.sun, this.moon, this.stars);
    this.center = new THREE.Vector3();
  }

  update(dt, center, camera) {
    if (Number.isFinite(this.dayLength)) this.phase = (this.phase + dt / this.dayLength) % 1;
    const s = skyState(this.phase);
    this.state = s;
    const { sun, hemi } = this.lights;

    // shadow-casting light sits along the sun (or moon) direction, aimed at the player
    sun.position.set(center.x + s.light.dir[0] * LIGHT_DISTANCE, center.y + s.light.dir[1] * LIGHT_DISTANCE, center.z + s.light.dir[2] * LIGHT_DISTANCE);
    sun.target.position.copy(center);
    sun.color.setRGB(...s.light.color, THREE.SRGBColorSpace);
    sun.intensity = s.light.intensity;
    sun.castShadow = s.light.intensity > 0.02;

    hemi.color.setRGB(...s.hemi.sky, THREE.SRGBColorSpace);
    hemi.groundColor.setRGB(...s.hemi.ground, THREE.SRGBColorSpace);
    hemi.intensity = s.hemi.intensity;

    this.scene.background.setRGB(...s.sky, THREE.SRGBColorSpace);
    this.scene.fog?.color.setRGB(...s.sky, THREE.SRGBColorSpace);

    // sky objects follow the camera so they feel infinitely far away
    const c = camera.position;
    for (const [mesh, dir] of [[this.sun, s.sunDir], [this.moon, s.moonDir]]) {
      mesh.position.set(c.x + dir[0] * SKY_DISTANCE, c.y + dir[1] * SKY_DISTANCE, c.z + dir[2] * SKY_DISTANCE);
      mesh.lookAt(c);
      mesh.visible = dir[1] > -0.15;
    }
    this.stars.position.copy(c);
    this.stars.material.opacity = s.stars;
    this.stars.visible = s.stars > 0.01;
  }

  dispose() {
    for (const o of [this.sun, this.moon, this.stars, this.halo]) {
      o.geometry.dispose();
      o.material.dispose();
      this.scene.remove(o);
    }
  }
}
