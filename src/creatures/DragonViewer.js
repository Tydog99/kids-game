// Side-by-side viewer for the three dragon designs. Works as a mode inside the game (opened from
// Options, with a Back button) or on its own page (dragons.html).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import '../ui/dragonViewer.css';
import { Dragon } from './Dragon.js';
import { DRAGONS } from './dragonModels.js';
import { addLights, SKY } from '../scene.js';

const AUTO = ['walk', 'rear', 'sit', 'walk', 'fly'];
// dragons in a row; three-quarter views so each breath shoots out in front of its neighbor
const LAYOUT = {
  ember: { x: -6.4, z: 0.6, turn: -0.3, size: 1 },
  glimmer: { x: 0, z: 1.2, turn: -0.7, size: 0.6 },
  frost: { x: 6.4, z: -1.4, turn: -0.75, size: 1.15 },
};
const HOME = { pos: new THREE.Vector3(2.2, 4.8, 16), target: new THREE.Vector3(0, 1.6, 0) };

export class DragonViewer {
  // canvas: the renderer's canvas (for drag-to-orbit). onBack: shows a Back button when given.
  constructor({ canvas, onBack = null }) {
    this.canvas = canvas;
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(SKY);
    scene.fog = new THREE.Fog(SKY, 60, 120);
    const { sun } = addLights(scene);
    sun.position.set(6, 14, 10);
    Object.assign(sun.shadow.camera, { left: -12, bottom: -12, right: 12, top: 12 });
    sun.shadow.camera.updateProjectionMatrix();

    // grassy island to stand on
    const island = new THREE.Mesh(new THREE.CylinderGeometry(13, 12, 0.6, 10), new THREE.MeshLambertMaterial({ color: '#5cb85c' }));
    island.position.y = -0.3;
    island.receiveShadow = true;
    const dirt = new THREE.Mesh(new THREE.CylinderGeometry(12, 8, 2.4, 10), new THREE.MeshLambertMaterial({ color: '#b88f55' }));
    dirt.position.y = -1.8;
    scene.add(island, dirt);

    this.camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 100);
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, enablePan: false, minDistance: 3, maxDistance: 60, maxPolarAngle: Math.PI * 0.49 });

    this.dragons = Object.keys(DRAGONS).map((id) => {
      const d = new Dragon(id);
      d.id = id;
      d.root.position.set(LAYOUT[id].x, 0, LAYOUT[id].z);
      d.root.rotation.y = LAYOUT[id].turn;
      scene.add(d.root);
      d.enableBreath(scene, 0);
      return d;
    });

    this.focused = null;
    this.tween = null;
    this.camera.position.copy(HOME.pos);
    this.controls.target.copy(HOME.target);
    this.buildUi(onBack);
    this.setMode('auto');
    this.resize();

    this.onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const m = { Digit1: 'walk', Digit2: 'rear', Digit3: 'fly', Digit4: 'sit', Digit0: 'auto' }[e.code];
      if (m) this.setMode(m);
      if (e.code === 'Space') {
        e.preventDefault();
        this.breatheAll();
      }
      if (e.code === 'Escape' && onBack) onBack();
    };
    addEventListener('keydown', this.onKey);
    window.__dragons = this; // handy for testing
  }

  buildUi(onBack) {
    this.el = document.createElement('div');
    this.el.className = 'dragon-viewer';
    this.el.innerHTML = `
      <header class="dv-top">
        ${onBack ? '<button class="dv-back" type="button">← Back</button>' : ''}
        <h1>Dragon <span>Designs</span></h1>
        <p>Three dragons for Voxel Explorer. Each one walks on all fours, rears up on its back legs, flies, and breathes fire, ice or diamonds. Drag to look around.</p>
      </header>
      <section class="dv-dock">
        <div class="dv-poses" role="radiogroup" aria-label="Pose">
          <button data-mode="auto" role="radio">Auto</button>
          <button data-mode="walk" role="radio">Walk</button>
          <button data-mode="rear" role="radio">Rear up</button>
          <button data-mode="sit" role="radio">Sit</button>
          <button data-mode="fly" role="radio">Fly</button>
          <button class="dv-breathe" type="button" title="Space bar">Breathe!</button>
        </div>
        <div class="dv-cards"></div>
      </section>`;
    document.body.appendChild(this.el);
    if (onBack) this.el.querySelector('.dv-back').onclick = onBack;
    const cards = this.el.querySelector('.dv-cards');
    for (const d of this.dragons) {
      const s = DRAGONS[d.id];
      const b = document.createElement('button');
      b.className = 'dv-card';
      b.dataset.id = d.id;
      b.style.setProperty('--swatch', s.colors.body);
      b.style.setProperty('--swatch2', s.colors.wing);
      b.innerHTML = `<span class="dv-swatch" aria-hidden="true"></span><span class="dv-name">${s.name}</span><span class="dv-tag">${s.tagline}</span><span class="dv-blurb">${s.blurb}</span>`;
      b.onclick = () => this.focus(this.focused === d ? null : d);
      cards.appendChild(b);
    }
    this.el.querySelectorAll('.dv-poses button[data-mode]').forEach((b) => (b.onclick = () => this.setMode(b.dataset.mode)));
    this.el.querySelector('.dv-breathe').onclick = () => this.breatheAll();
  }

  focus(d) {
    this.focused = d;
    this.el.querySelectorAll('.dv-card').forEach((c) => c.classList.toggle('selected', !!d && c.dataset.id === d.id));
    if (!d) return this.frame(this.homePos(), HOME.target.clone());
    const p = d.root.position, size = LAYOUT[d.id].size;
    this.frame(new THREE.Vector3(p.x + 3.5 * size, 2.6 + 1.6 * size, p.z + 7.5 * size), new THREE.Vector3(p.x, 1.2 + 0.6 * size, p.z));
  }

  frame(pos, target) {
    this.tween = { fromPos: this.camera.position.clone(), fromTarget: this.controls.target.clone(), pos, target, t: 0 };
  }

  // on tall, narrow screens step back so all three dragons fit side by side
  homePos() {
    const k = Math.max(1, 1.45 / this.camera.aspect);
    return HOME.target.clone().add(HOME.pos.clone().sub(HOME.target).multiplyScalar(k));
  }

  setMode(m) {
    this.mode = m;
    this.el.querySelectorAll('.dv-poses button[data-mode]').forEach((b) => {
      const on = b.dataset.mode === m;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-checked', String(on));
    });
    this.autoIndex = 0;
    this.autoTimer = 0;
    this.dragons.forEach((d) => d.setMode(m === 'auto' ? AUTO[0] : m));
  }

  breatheAll() {
    (this.focused ? [this.focused] : this.dragons).forEach((d) => d.breathe(2.2));
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    if (!this.focused && !this.tween) this.camera.position.copy(this.homePos());
  }

  update(dt) {
    if (this.mode === 'auto') {
      const before = this.autoTimer;
      this.autoTimer += dt;
      // breathe a moment into the rear-up and flying poses
      if ((AUTO[this.autoIndex] === 'rear' || AUTO[this.autoIndex] === 'fly') && before < 1 && this.autoTimer >= 1) this.dragons.forEach((d) => d.breathe(1.8));
      if (this.autoTimer > 3.6) {
        this.autoTimer = 0;
        this.autoIndex = (this.autoIndex + 1) % AUTO.length;
        this.dragons.forEach((d) => d.setMode(AUTO[this.autoIndex]));
      }
    }
    for (const d of this.dragons) d.update(dt);
    const tw = this.tween;
    if (tw) {
      tw.t = Math.min(1, tw.t + dt / 0.8);
      const e = 1 - Math.pow(1 - tw.t, 3);
      this.camera.position.lerpVectors(tw.fromPos, tw.pos, e);
      this.controls.target.lerpVectors(tw.fromTarget, tw.target, e);
      if (tw.t >= 1) this.tween = null;
    }
    if (!this.freezeCamera) this.controls.update();
  }

  dispose() {
    removeEventListener('keydown', this.onKey);
    this.controls.dispose();
    this.el.remove();
    for (const d of this.dragons) d.dispose();
    this.scene.traverse((o) => o.geometry?.dispose());
    if (window.__dragons === this) delete window.__dragons;
  }
}
