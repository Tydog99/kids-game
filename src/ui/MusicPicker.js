// Pick the background music: the five themes, with a day/night preview switch.
import { THEMES } from '../audio/score.js';
import { music } from '../audio/Music.js';
import { save } from './storage.js';

export function openMusicPicker() {
  const el = document.createElement('div');
  el.className = 'options-menu music-picker';
  el.innerHTML = `
    <div class="options-panel" role="dialog" aria-modal="true" aria-labelledby="music-title">
      <div class="options-head">
        <h2 id="music-title">🎵 Music</h2>
        <button class="options-close" type="button" aria-label="Close">✕</button>
      </div>
      <div class="music-time" role="radiogroup" aria-label="Preview">
        <button type="button" data-night="false" role="radio">☀️ Day</button>
        <button type="button" data-night="true" role="radio">🌙 Night</button>
      </div>
      <div class="music-list" role="radiogroup" aria-label="Theme">
        ${THEMES.map(
          (t, i) => `
          <button type="button" class="options-item music-theme" data-id="${t.id}" role="radio">
            <span class="options-icon music-num" aria-hidden="true">${i + 1}</span>
            <span><strong>${t.name}</strong><br /><small>${t.blurb}</small></span>
            <span class="now-playing" aria-hidden="true">♪</span>
          </button>`,
        ).join('')}
      </div>
      <p class="music-note" hidden>Music was off, so I turned it on. Change the volume with the 🎵 slider in the game.</p>
    </div>`;
  document.body.appendChild(el);

  const refresh = () => {
    el.querySelectorAll('.music-theme').forEach((b) => {
      const on = b.dataset.id === music.theme.id;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-checked', String(on));
    });
    const night = music.previewNight ?? music.night;
    el.querySelectorAll('.music-time button').forEach((b) => {
      const on = (b.dataset.night === 'true') === night;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-checked', String(on));
    });
  };
  const ensureOn = () => {
    if (music.volume === 0) {
      music.setVolume(6);
      save('music', '6');
      dispatchEvent(new CustomEvent('music-volume', { detail: 6 }));
      el.querySelector('.music-note').hidden = false;
    }
    music.unlock();
  };
  el.querySelectorAll('.music-theme').forEach(
    (b) =>
      (b.onclick = () => {
        ensureOn();
        music.setTheme(b.dataset.id);
        save('musicTheme', b.dataset.id);
        refresh();
      }),
  );
  el.querySelectorAll('.music-time button').forEach(
    (b) =>
      (b.onclick = () => {
        ensureOn();
        music.previewNight = b.dataset.night === 'true';
        refresh();
      }),
  );
  const close = () => {
    music.previewNight = null; // back to following the game's day and night
    removeEventListener('keydown', onKey, true);
    el.remove();
  };
  const onKey = (e) => {
    if (e.code === 'Escape') {
      e.stopPropagation();
      close();
    }
    // number keys 1–5 pick a theme
    const n = Number(e.key);
    if (n >= 1 && n <= THEMES.length) el.querySelectorAll('.music-theme')[n - 1].click();
  };
  addEventListener('keydown', onKey, true);
  el.addEventListener('click', (e) => e.target === el && close());
  el.querySelector('.options-close').onclick = close;
  ensureOn();
  refresh();
  el.querySelector('.music-theme.selected')?.focus();
}
