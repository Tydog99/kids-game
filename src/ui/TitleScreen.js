// Character look + seed entry, with the character shown live in 3D. One character, and arrows to
// step round a loop of looks (the original boy and girl, then random mixes of styles and colours).
import * as THREE from 'three';
import { Character } from '../player/Character.js';
import { randomLook } from '../voxel/models/looks.js';
import { addLights, SKY } from '../scene.js';
import { randomSeed } from '../rng.js';
import { load, save } from './storage.js';

// A seed can come from ?seed=name or #name (the hash form works inside embeds).
function seedFromUrl() {
  const q = new URLSearchParams(location.search).get('seed');
  const h = decodeURIComponent(location.hash.slice(1));
  return q || h || '';
}

// The loop of looks: the original boy and girl first, then random mixes (each the same every time).
const LOOKS = 30;
export function lookAt(n) {
  if (n === 0) return { id: 'boy', look: null };
  if (n === 1) return { id: 'girl', look: null };
  const id = n % 2 ? 'girl' : 'boy';
  return { id, look: randomLook(id, n * 7919 + 13) };
}

export class TitleScreen {
  constructor(onPlay, onOptions = () => {}) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 50);
    addLights(this.scene);

    // little grass island for them to stand on
    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(1.9, 1.7, 0.4, 8),
      new THREE.MeshLambertMaterial({ color: '#5cb85c' }),
    );
    island.position.y = -0.2;
    island.receiveShadow = true;
    this.scene.add(island);
    const dirt = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.2, 0.6, 8), new THREE.MeshLambertMaterial({ color: '#b88f55' }));
    dirt.position.y = -0.7;
    this.scene.add(dirt);

    this.char = null;
    const saved = Number(load('lookIndex', '0'));
    this.lookIndex = Number.isInteger(saved) && saved >= 0 && saved < LOOKS ? saved : 0;
    // (older saves called these 'treasure' and 'explore')
    this.gameMode = ['adventure', 'treasure'].includes(load('mode', 'adventure')) ? 'adventure' : 'free';
    const seed = seedFromUrl() || load('seed', '') || randomSeed();

    this.el = document.createElement('div');
    this.el.className = 'overlay title';
    this.el.innerHTML = `
      <button class="options-btn" type="button">⚙️ Options</button>
      <h1>Dragon <span>Riders!</span></h1>
      <div class="spacer"></div>
      <div class="looks">
        <button class="prev-look" type="button" aria-label="Previous look">◀</button>
        <span class="look-num"></span>
        <button class="next-look" type="button" aria-label="Next look">▶</button>
        <button class="new-look" type="button" aria-label="Surprise me">🎲</button>
      </div>
      <div class="modes" role="radiogroup" aria-label="Game mode">
        <button class="mode" data-mode="adventure" role="radio">🐉 Adventure</button>
        <button class="mode" data-mode="free" role="radio">🌍 Free Play</button>
      </div>
      <div class="seed-row">
        <label for="seed">World</label>
        <input id="seed" type="text" maxlength="40" spellcheck="false" autocomplete="off" />
        <button class="dice" title="Random world" aria-label="Random world">🎲</button>
      </div>
      <button class="play">Play!</button>
    `;
    document.body.appendChild(this.el);
    const input = this.el.querySelector('#seed');
    input.value = seed;
    this.el.querySelector('.dice').onclick = () => (input.value = randomSeed());
    const play = () => {
      const s = input.value.trim() || randomSeed();
      save('seed', s);
      // the game builds the character from these
      const { id, look } = lookAt(this.lookIndex);
      save('character', id);
      save(`look:${id}`, look ? JSON.stringify(look) : '');
      save('mode', this.gameMode);
      onPlay(s, id, this.gameMode);
    };
    this.el.querySelector('.play').onclick = play;
    this.el.querySelector('.prev-look').onclick = () => this.step(-1);
    this.el.querySelector('.next-look').onclick = () => this.step(1);
    this.el.querySelector('.new-look').onclick = () => this.step(1 + Math.floor(Math.random() * (LOOKS - 1)));
    this.el.querySelector('.options-btn').onclick = onOptions;
    this.onKey = (e) => {
      if (this.suspended || document.querySelector('.options-menu')) return;
      if (e.code === 'Enter') play();
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'ArrowLeft') this.step(-1);
      if (e.code === 'ArrowRight') this.step(1);
    };
    addEventListener('keydown', this.onKey);
    this.el.querySelectorAll('.mode').forEach((b) => (b.onclick = () => this.setMode(b.dataset.mode)));
    this.setMode(this.gameMode);
    this.showLook();
    this.resize();
  }

  setMode(m) {
    this.gameMode = m;
    this.el.querySelectorAll('.mode').forEach((b) => {
      b.classList.toggle('selected', b.dataset.mode === m);
      b.setAttribute('aria-checked', String(b.dataset.mode === m));
    });
  }

  // Hide while another screen (like Dragon Designs) is open on top.
  suspend() {
    this.suspended = true;
    this.el.hidden = true;
  }

  resume() {
    this.suspended = false;
    this.el.hidden = false;
  }

  // Move round the loop of looks (d = +1 next, -1 previous).
  step(d) {
    this.lookIndex = (((this.lookIndex + d) % LOOKS) + LOOKS) % LOOKS;
    save('lookIndex', String(this.lookIndex));
    this.showLook();
  }

  showLook() {
    const { id, look } = lookAt(this.lookIndex);
    const old = this.char;
    this.char = new Character(id, look);
    this.char.root.scale.setScalar(1.25);
    if (old) {
      this.char.root.rotation.y = old.root.rotation.y;
      this.scene.remove(old.root);
      old.dispose();
    }
    this.scene.add(this.char.root);
    this.el.querySelector('.look-num').textContent = `${this.lookIndex + 1} / ${LOOKS}`;
    this.hopT = 0;
  }

  resize() {
    const a = innerWidth / innerHeight;
    this.camera.aspect = a;
    // pull back on narrow (portrait) screens so the character fits
    const d = a < 1 ? 5.4 / a : 5.4;
    this.camera.position.set(0, 1.6, d);
    this.camera.lookAt(0, 0.35, 0);
    this.camera.updateProjectionMatrix();
  }

  update(dt, t) {
    this.hopT += dt;
    // turn gently from side to side to show the outfit off, with a hop for each new look
    const c = this.char;
    const target = Math.sin(t * 0.6) * 0.5;
    c.root.rotation.y += (target - c.root.rotation.y) * Math.min(1, dt * 4);
    const hop = this.hopT < 0.5;
    c.root.position.y = hop ? Math.sin((this.hopT / 0.5) * Math.PI) * 0.3 : 0;
    c.animate(t * 6, hop, t);
  }

  dispose() {
    removeEventListener('keydown', this.onKey);
    this.el.remove();
    this.char.dispose();
  }
}
