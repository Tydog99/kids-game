// The game's Options menu: a small panel of extra things to open.
export function openOptionsMenu({ onDragons }) {
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
  el.querySelector('[data-item=dragons]').focus();
  return close;
}
