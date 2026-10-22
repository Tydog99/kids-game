// Standalone Dragon Designs page (dragons.html). The same viewer also opens inside the game.
import * as THREE from 'three';
import { DragonViewer } from './creatures/DragonViewer.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('stage').appendChild(renderer.domElement);

const viewer = new DragonViewer({ canvas: renderer.domElement });
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  viewer.resize();
});
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  viewer.update(Math.min(clock.getDelta(), 0.1));
  renderer.render(viewer.scene, viewer.camera);
});
