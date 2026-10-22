import * as THREE from 'three';
import './ui/style.css';
import { TitleScreen } from './ui/TitleScreen.js';
import { Game } from './Game.js';
import { DragonViewer } from './creatures/DragonViewer.js';
import { openOptionsMenu } from './ui/OptionsMenu.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const loading = document.getElementById('loading');
let mode;

// Keep the current world in the URL hash so a reload returns to it.
function setUrlSeed(seed) {
  try {
    history.replaceState(null, '', `${location.pathname}#${encodeURIComponent(seed)}`);
  } catch {
    /* some embeds disallow URL changes */
  }
}

function showTitle() {
  mode?.dispose();
  mode = new TitleScreen(startGame, openOptions);
}

function startGame(seed, characterId, gameMode) {
  mode.dispose();
  mode = null;
  setUrlSeed(seed);
  loading.classList.add('show');
  // let the loading message paint before the (synchronous) world build
  requestAnimationFrame(() =>
    setTimeout(() => {
      mode = new Game(seed, characterId, showTitle, renderer.domElement, gameMode, openOptions);
      loading.classList.remove('show');
    }, 30),
  );
}

function openOptions() {
  openOptionsMenu({ onDragons: openDragons });
}

// Dragon Designs opens on top of whatever is running; Back returns to it exactly as it was.
function openDragons() {
  const previous = mode;
  previous.suspend();
  mode = new DragonViewer({
    canvas: renderer.domElement,
    onBack: () => {
      mode.dispose();
      mode = previous;
      previous.resume();
      previous.resize();
    },
  });
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
  if (mode.skyScene) {
    // sky layer first, then the world on top with a fresh depth buffer
    renderer.autoClear = false;
    renderer.clear();
    renderer.render(mode.skyScene, mode.camera);
    renderer.clearDepth();
    renderer.render(mode.scene, mode.camera);
    renderer.autoClear = true;
  } else {
    renderer.render(mode.scene, mode.camera);
  }
});

window.__voxel = { get mode() { return mode; }, renderer };

showTitle();
