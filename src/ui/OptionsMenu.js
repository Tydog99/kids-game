// The game's Options menu: a small panel of extra things to open.
export function openOptionsMenu({ onDragons, onMusic }) {
  const el = document.createElement('div');
  el.className = 'options-menu';
  el.innerHTML = `
    <div class="options-panel" role="dialog" aria-modal="true" aria-labelledby="options-title">
      <div class="options-head">
        <h2 id="options-title">Options</h2>
        <button class="options-close" type="button" aria-label="Close">✕</button>
      </div>
      <button class="options-item" type="button" data-item="dragons">
        <span class="options-icon" aria-hidden="true">🐉</span>
        <span><strong>Dragon Designs</strong><br /><small>See Ember, Glimmer and Frost walk, fly and breathe fire, diamonds and ice.</small></span>
      </button>
      <button class="options-item" type="button" data-item="music">
        <span class="options-icon" aria-hidden="true">🎵</span>
        <span><strong>Music</strong><br /><small>Listen to the five themes and pick the one you like.</small></span>
      </button>
      <p class="options-credits">Voices made with Piper text-to-speech, using the Northern English Male (CC BY-SA 4.0), Alba (CC BY 4.0), Joe (CC0), Kristin and Norman (public domain) voices.</p>
    </div>`;
  document.body.appendChild(el);
  const close = () => {
    removeEventListener('keydown', onKey, true);
    el.remove();
  };
  const onKey = (e) => {
    if (e.code === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  addEventListener('keydown', onKey, true);
  el.addEventListener('click', (e) => e.target === el && close()); // click outside the panel
  el.querySelector('.options-close').onclick = close;
  el.querySelector('[data-item=dragons]').onclick = () => {
    close();
    onDragons();
  };
  el.querySelector('[data-item=music]').onclick = () => {
    close();
    onMusic();
  };
  el.querySelector('[data-item=dragons]').focus();
  return close;
}
