// Side-by-side viewer for the three dragon designs.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './ui/dragonViewer.css';
import { Dragon } from './creatures/Dragon.js';
import { DRAGONS } from './creatures/dragonModels.js';
import { addLights, SKY } from './scene.js';

const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 60, 120);
const { sun } = addLights(scene);
sun.position.set(6, 14, 10);
sun.shadow.camera.left = sun.shadow.camera.bottom = -12;
sun.shadow.camera.right = sun.shadow.camera.top = 12;

// grassy island to stand on
const island = new THREE.Mesh(new THREE.CylinderGeometry(13, 12, 0.6, 10), new THREE.MeshLambertMaterial({ color: '#5cb85c' }));
island.position.y = -0.3;
island.receiveShadow = true;
const dirt = new THREE.Mesh(new THREE.CylinderGeometry(12, 8, 2.4, 10), new THREE.MeshLambertMaterial({ color: '#b88f55' }));
dirt.position.y = -1.8;
scene.add(island, dirt);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 3;
controls.maxDistance = 60;
controls.maxPolarAngle = Math.PI * 0.49;

// dragons in a row, turned three-quarters so you see their side profile
const layout = { ember: [-5.6, 0.4], glimmer: [0, 1.6], frost: [5.4, -0.6] };
const dragons = Object.keys(DRAGONS).map((id) => {
  const d = new Dragon(id);
  d.id = id;
  d.root.position.set(layout[id][0], 0, layout[id][1]);
  d.root.rotation.y = -0.95;
  scene.add(d.root);
  return d;
});

// --- camera framing ---
const HOME = { pos: new THREE.Vector3(2.2, 4.6, 14.5), target: new THREE.Vector3(0, 1.6, 0) };
let tween = null;
function frame(pos, target) {
  tween = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), pos, target, t: 0 };
}
function frameDragon(d) {
  const p = d.root.position;
  const size = { ember: 1, glimmer: 0.6, frost: 1.15 }[d.id];
  frame(new THREE.Vector3(p.x + 3.5 * size, 2.6 + 1.6 * size, p.z + 7.5 * size), new THREE.Vector3(p.x, 1.2 + 0.6 * size, p.z));
}
// on tall, narrow screens step back so all three dragons fit side by side
function homePos() {
  const aspect = stage.clientWidth / stage.clientHeight;
  const k = Math.max(1, 1.45 / aspect);
  return HOME.target.clone().add(HOME.pos.clone().sub(HOME.target).multiplyScalar(k));
}
camera.position.copy(HOME.pos);
controls.target.copy(HOME.target);

// --- UI ---
const cards = document.querySelector('.cards');
let focused = null;
for (const d of dragons) {
  const s = DRAGONS[d.id];
  const b = document.createElement('button');
  b.className = 'card';
  b.dataset.id = d.id;
  b.style.setProperty('--swatch', s.colors.body);
  b.style.setProperty('--swatch2', s.colors.wing);
  b.innerHTML = `<span class="swatch" aria-hidden="true"></span><span class="name">${s.name}</span><span class="tag">${s.tagline}</span><span class="blurb">${s.blurb}</span>`;
  b.onclick = () => {
    focused = focused === d ? null : d;
    document.querySelectorAll('.card').forEach((c) => c.classList.toggle('selected', focused && c.dataset.id === focused.id));
    focused ? frameDragon(d) : frame(homePos(), HOME.target.clone());
  };
  cards.appendChild(b);
}

const AUTO = ['walk', 'rear', 'walk', 'fly'];
let mode = 'auto', autoIndex = 0, autoTimer = 0;
function setMode(m) {
  mode = m;
  document.querySelectorAll('.poses button').forEach((b) => {
    const on = b.dataset.mode === m;
    b.classList.toggle('selected', on);
    b.setAttribute('aria-checked', String(on));
  });
  if (m !== 'auto') dragons.forEach((d) => d.setMode(m));
  else {
    autoIndex = 0;
    autoTimer = 0;
    dragons.forEach((d) => d.setMode(AUTO[0]));
  }
}
document.querySelectorAll('.poses button').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
addEventListener('keydown', (e) => {
  const m = { Digit1: 'walk', Digit2: 'rear', Digit3: 'fly', Digit0: 'auto' }[e.code];
  if (m) setMode(m);
});
setMode('auto');

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!focused && !tween) camera.position.copy(homePos());
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (mode === 'auto') {
    autoTimer += dt;
    if (autoTimer > 3.6) {
      autoTimer = 0;
      autoIndex = (autoIndex + 1) % AUTO.length;
      dragons.forEach((d) => d.setMode(AUTO[autoIndex]));
    }
    document.querySelector('.poses').dataset.now = AUTO[autoIndex];
  }
  for (const d of dragons) d.update(dt);
  if (tween) {
    tween.t = Math.min(1, tween.t + dt / 0.8);
    const e = 1 - Math.pow(1 - tween.t, 3);
    camera.position.lerpVectors(tween.fromPos, tween.pos, e);
    controls.target.lerpVectors(tween.fromTarget, tween.target, e);
    if (tween.t >= 1) tween = null;
  }
  if (!window.__freezeCam) controls.update();
  renderer.render(scene, camera);
});

window.__dragons = { dragons, setMode, camera, renderer };
