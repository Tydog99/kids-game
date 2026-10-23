// Character select + seed entry, with both characters shown live in 3D.
import * as THREE from 'three';
import { Character } from '../player/Character.js';
import { randomLook, parseLook } from '../voxel/models/looks.js';
import { CHARACTERS } from '../voxel/models/characters.js';
import { addLights, SKY } from '../scene.js';
import { randomSeed } from '../rng.js';
import { load, save } from './storage.js';

// A seed can come from ?seed=name or #name (the hash form works inside embeds).
function seedFromUrl() {
  const q = new URLSearchParams(location.search).get('seed');
  const h = decodeURIComponent(location.hash.slice(1));
  return q || h || '';
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

    this.chars = {};
    ['boy', 'girl'].forEach((id) => this.makeChar(id, parseLook(load(`look:${id}`, ''))));

    this.selected = load('character', 'boy');
    // (older saves called these 'treasure' and 'explore')
    this.gameMode = ['adventure', 'treasure'].includes(load('mode', 'adventure')) ? 'adventure' : 'free';
    const seed = seedFromUrl() || load('seed', '') || randomSeed();

    this.el = document.createElement('div');
    this.el.className = 'overlay title';
    this.el.innerHTML = `
      <button class="options-btn" type="button">⚙️ Options</button>
      <h1>Voxel <span>Explorer</span></h1>
      <div class="spacer"></div>
      <div class="cards">
        ${Object.entries(CHARACTERS).map(([id, c]) => `<button class="card" data-id="${id}">${c.label}</button>`).join('')}
      </div>
      <div class="looks">
        <button class="new-look" type="button">🎲 New look</button>
        <button class="old-look" type="button">↺ Original</button>
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
    this.el.querySelectorAll('.card').forEach((b) => (b.onclick = () => this.select(b.dataset.id)));
    const play = () => {
      const s = input.value.trim() || randomSeed();
      save('seed', s);
      save('character', this.selected);
      save('mode', this.gameMode);
      onPlay(s, this.selected, this.gameMode);
    };
    this.el.querySelector('.play').onclick = play;
    this.el.querySelector('.new-look').onclick = () => this.setLooks((id) => randomLook(id));
    this.el.querySelector('.old-look').onclick = () => this.setLooks(() => null);
    this.el.querySelector('.options-btn').onclick = onOptions;
    this.onKey = (e) => {
      if (this.suspended || document.querySelector('.options-menu')) return;
      if (e.code === 'Enter') play();
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'ArrowLeft') this.select('boy');
      if (e.code === 'ArrowRight') this.select('girl');
    };
    addEventListener('keydown', this.onKey);
    this.el.querySelectorAll('.mode').forEach((b) => (b.onclick = () => this.setMode(b.dataset.mode)));
    this.setMode(this.gameMode);
    this.select(this.selected);
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

  select(id) {
    this.selected = id;
    this.hopT = 0;
    this.el.querySelectorAll('.card').forEach((b) => b.classList.toggle('selected', b.dataset.id === id));
  }

  resize() {
    const a = innerWidth / innerHeight;
    this.camera.aspect = a;
    // pull back on narrow (portrait) screens so both characters fit
    const d = a < 1 ? 5.2 / a : 5.2;
    this.camera.position.set(0, 1.6, d);
    this.camera.lookAt(0, 0.2, 0);
    this.camera.updateProjectionMatrix();
  }

  makeChar(id, look) {
    const c = new Character(id, look);
    c.root.position.x = id === 'boy' ? -0.75 : 0.75;
    c.root.scale.setScalar(1.15);
    this.scene.add(c.root);
    this.chars[id] = c;
    return c;
  }

  // New looks for both characters (look(id) → colors, or null for the original), with a little hop.
  setLooks(look) {
    for (const id of ['boy', 'girl']) {
      const old = this.chars[id];
      const l = look(id);
      save(`look:${id}`, l ? JSON.stringify(l) : '');
      const c = this.makeChar(id, l);
      c.root.rotation.y = old.root.rotation.y;
      this.scene.remove(old.root);
      old.dispose();
    }
    this.hopT = 0;
    this.hopAll = true;
  }

  update(dt, t) {
    this.hopT += dt;
    if (this.hopT > 0.5) this.hopAll = false;
    for (const [id, c] of Object.entries(this.chars)) {
      const sel = id === this.selected;
      const target = sel ? 0 : Math.sin(t * 0.6 + (id === 'boy' ? 0 : 2)) * 0.6;
      c.root.rotation.y += (target - c.root.rotation.y) * Math.min(1, dt * 6);
      const hop = (sel || this.hopAll) && this.hopT < 0.5;
      c.root.position.y = hop ? Math.sin((this.hopT / 0.5) * Math.PI) * 0.3 : 0;
      c.animate(t * 6, hop, t);
    }
  }

  dispose() {
    removeEventListener('keydown', this.onKey);
    this.el.remove();
    Object.values(this.chars).forEach((c) => c.dispose());
  }
}
