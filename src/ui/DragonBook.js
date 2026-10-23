// The Dragon Book: a page for each dragon, with its picture, how it's doing and what it needs.
import * as THREE from 'three';
import { Dragon } from '../creatures/Dragon.js';
import { DRAGONS } from '../creatures/dragonModels.js';
import { DRAGON_NEEDS } from '../adventure/adventure.js';
import { addLights } from '../scene.js';
import { speak, speakLine, stopSpeaking } from './speak.js';

const pictures = {};

// A little portrait of each dragon, drawn once.
function picture(kind) {
  if (pictures[kind]) return pictures[kind];
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(320, 220, false);
    const scene = new THREE.Scene();
    addLights(scene);
    const d = new Dragon(kind);
    d.setMode('walk');
    d.stride = 0;
    for (let i = 0; i < 120; i++) d.update(1 / 60);
    d.root.rotation.y = -1.05;
    scene.add(d.root);
    // frame the whole dragon, head to tail
    d.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    d.root.traverse((o) => {
      if (o.isMesh && o.visible && o.geometry) box.expandByObject(o, true);
    });
    const ball = box.getBoundingSphere(new THREE.Sphere());
    const cam = new THREE.PerspectiveCamera(35, 320 / 220, 0.1, 100);
    const dir = new THREE.Vector3(0.35, 0.3, 1).normalize();
    const corners = [];
    for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
    // start well back, then move in until the dragon fills the picture with a little margin
    let dist = ball.radius / Math.sin(THREE.MathUtils.degToRad(35 / 2));
    for (let i = 0; i < 4; i++) {
      cam.position.copy(ball.center).addScaledVector(dir, dist);
      cam.lookAt(ball.center);
      cam.updateMatrixWorld();
      let reach = 0;
      for (const c of corners) {
        const v = c.clone().project(cam);
        reach = Math.max(reach, Math.abs(v.x), Math.abs(v.y));
      }
      dist *= reach / 0.9;
    }
    cam.position.copy(ball.center).addScaledVector(dir, dist);
    cam.lookAt(ball.center);
    renderer.render(scene, cam);
    pictures[kind] = renderer.domElement.toDataURL('image/png');
    renderer.dispose();
    renderer.forceContextLoss();
    scene.traverse((o) => o.geometry?.dispose());
  } catch {
    pictures[kind] = '';
  }
  return pictures[kind];
}

const LIGHT = { ember: 'orange', glimmer: 'green', frost: 'blue' };

// Where the player is up to on a dragon's quest.
function hint(kind, p) {
  if (kind === 'ember' && p.carrying === 'egg') return '🥚 You have the egg! Walk up to Ember to give it back.';
  if (kind === 'frost' && p.carrying === 'flower') return '🌸 You have the flower! Walk up to Frost to give it.';
  if (kind === 'glimmer' && p.gems.length >= 5) return '💎 You have all 5 gems! Walk up to Glimmer.';
  if (kind === 'glimmer') return `💎 Gems found: ${p.gems.length} of 5. Follow the ${LIGHT[kind]} lights.`;
  if (kind === 'frost') return `Follow the ${LIGHT[kind]} light. The flower only opens at night 🌙`;
  return `Follow the ${LIGHT[kind]} light.`;
}

// The recorded line for hint() (see audio/voiceLines.json).
function hintLine(kind, p) {
  if (kind === 'ember') return p.carrying === 'egg' ? 'n_has_egg' : 'n_hint_ember';
  if (kind === 'frost') return p.carrying === 'flower' ? 'n_has_flower' : 'n_hint_frost';
  return p.gems.length >= 5 ? 'n_has_gems' : null; // the gem count is shown, not read out
}

// dragons: [{ kind, name, status }]; progress: adventure progress. start: kind to open at.
export function openDragonBook({ dragons, progress, start, onClose = () => {} }) {
  const el = document.createElement('div');
  el.className = 'options-menu dragon-book';
  el.innerHTML = `
    <div class="options-panel book" role="dialog" aria-modal="true" aria-labelledby="book-title">
      <div class="options-head">
        <h2 id="book-title">📖 Dragon Book</h2>
        <button class="options-close" type="button" aria-label="Close">✕</button>
      </div>
      <div class="book-tabs" role="tablist"></div>
      <div class="book-page"></div>
    </div>`;
  document.body.appendChild(el);
  const tabs = el.querySelector('.book-tabs');
  const page = el.querySelector('.book-page');
  let current = start ?? dragons[0].kind;

  const show = (kind) => {
    current = kind;
    const d = dragons.find((x) => x.kind === kind);
    const spec = DRAGONS[kind];
    const need = DRAGON_NEEDS[kind];
    const friend = progress.friends[kind];
    const done = !!progress.quests[kind];
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.kind === kind)));
    page.style.setProperty('--swatch', spec.colors.body);
    page.innerHTML = `
      <img class="book-picture" alt="${spec.name} the dragon" src="${picture(kind)}" />
      <div class="book-words">
        <h3>${friend ? `${friend} <small>(${spec.name})</small>` : spec.name}</h3>
        <p class="book-status">${d.status}</p>
        ${
          progress.chapter === 'treasure'
            ? `<p class="book-need">Help Grandpa Ollie find his keys first. Then the dragons will come down.</p>`
            : friend
              ? `<p class="book-need done">💛 ${friend} is your friend! Press E next to ${friend} to ride.</p>`
              : `<p class="book-need ${done ? 'done' : ''}"><span class="need-icon">${need.icon}</span> “${need.want}”${done ? '<br /><b>✓ Done! Now stay close so it can trust you.</b>' : progress.accepted[kind] ? `<br /><span class="book-hint">${hint(kind, progress)}</span>` : ''}</p>`
        }
        <button class="read-aloud" type="button">🔊 Read to me</button>
      </div>`;
    // the dragon says what it needs in its own voice, then the narrator says where you're up to
    page.querySelector('.read-aloud').onclick = () => {
      if (progress.chapter === 'treasure') return speakLine('n_wait');
      if (friend) return speak(page.querySelector('.book-words').innerText.replace('🔊 Read to me', ''));
      speakLine([`${kind}_want`, ...(progress.accepted[kind] || done ? [done ? 'n_quest_done' : hintLine(kind, progress)].filter(Boolean) : [])]);
    };
  };
  for (const d of dragons) {
    const b = document.createElement('button');
    b.type = 'button';
    b.role = 'tab';
    b.dataset.kind = d.kind;
    b.style.setProperty('--swatch', DRAGONS[d.kind].colors.body);
    b.innerHTML = `<span class="swatch" aria-hidden="true"></span>${progress.friends[d.kind] ?? DRAGONS[d.kind].name}`;
    b.onclick = () => show(d.kind);
    tabs.appendChild(b);
  }
  const close = () => {
    stopSpeaking();
    removeEventListener('keydown', onKey, true);
    el.remove();
    onClose();
  };
  const onKey = (e) => {
    if (e.code === 'Escape' || e.code === 'KeyE') {
      e.stopPropagation();
      e.preventDefault();
      close();
    }
  };
  addEventListener('keydown', onKey, true);
  el.addEventListener('click', (e) => e.target === el && close());
  el.querySelector('.options-close').onclick = close;
  show(current);
  return close;
}
