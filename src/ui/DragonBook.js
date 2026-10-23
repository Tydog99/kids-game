// The Dragon Book: a page for each dragon, with its picture, how it's doing and what it needs.
import * as THREE from 'three';
import { Dragon } from '../creatures/Dragon.js';
import { DRAGONS } from '../creatures/dragonModels.js';
import { DRAGON_NEEDS } from '../adventure/adventure.js';
import { addLights } from '../scene.js';
import { speak, stopSpeaking } from './speak.js';

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
    const size = { ember: 1, glimmer: 0.62, frost: 1.1 }[kind];
    const cam = new THREE.PerspectiveCamera(35, 320 / 220, 0.1, 50);
    cam.position.set(1.8 * size + 0.3, 1.5 * size + 0.5, 4.6 * size + 0.6);
    cam.lookAt(0.2 * size, 0.75 * size, 0.1);
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
              : `<p class="book-need ${done ? 'done' : ''}"><span class="need-icon">${need.icon}</span> “${need.want}”${done ? '<br /><b>✓ Done! Now stay close so it can trust you.</b>' : ''}</p>`
        }
        <button class="read-aloud" type="button">🔊 Read to me</button>
      </div>`;
    page.querySelector('.read-aloud').onclick = () => speak(page.querySelector('.book-words').innerText.replace('🔊 Read to me', ''));
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
