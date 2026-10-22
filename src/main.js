import * as THREE from 'three';
import './ui/style.css';
import { TitleScreen } from './ui/TitleScreen.js';
import { Game } from './Game.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const loading = document.getElementById('loading');
let mode;

function showTitle() {
  mode?.dispose();
  history.replaceState(null, '', location.pathname + location.search);
  mode = new TitleScreen(startGame);
}

function startGame(seed, characterId) {
  mode.dispose();
  mode = null;
  history.replaceState(null, '', `?seed=${encodeURIComponent(seed)}`);
  loading.classList.add('show');
  // let the loading message paint before the (synchronous) world build
  requestAnimationFrame(() =>
    setTimeout(() => {
      mode = new Game(seed, characterId, showTitle);
      loading.classList.remove('show');
    }, 30),
  );
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  mode?.resize();
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  if (!mode) return;
  mode.update(dt, t);
  renderer.render(mode.scene, mode.camera);
});

window.__voxel = { get mode() { return mode; }, renderer };

showTitle();
