// In-game overlay: seed/share, new world, controls hint, town banner, touch d-pad.
export class Hud {
  constructor({ seed, onExit, input }) {
    this.el = document.createElement('div');
    this.el.className = 'overlay hud';
    this.el.innerHTML = `
      <button class="pill seed" title="Copy a link to this world">🌍 <span></span></button>
      <button class="pill exit">New World</button>
      <div class="banner"></div>
      <div class="hint">⬆ walk &nbsp; ⬇ back up &nbsp; ⬅ ➡ turn</div>
      <div class="dpad">
        <button data-a="forward">▲</button><button data-a="left">◀</button>
        <button data-a="right">▶</button><button data-a="back">▼</button>
      </div>
    `;
    document.body.appendChild(this.el);
    const seedBtn = this.el.querySelector('.seed');
    seedBtn.querySelector('span').textContent = seed;
    seedBtn.onclick = async () => {
      const url = `${location.origin}${location.pathname}?seed=${encodeURIComponent(seed)}`;
      try {
        await navigator.clipboard.writeText(url);
        this.flash(seedBtn, 'Link copied!');
      } catch {
        this.flash(seedBtn, seed);
      }
    };
    this.el.querySelector('.exit').onclick = onExit;
    this.hint = this.el.querySelector('.hint');
    this.banner = this.el.querySelector('.banner');
    this.input = input;
    for (const b of this.el.querySelectorAll('.dpad button')) {
      const a = b.dataset.a;
      const down = (e) => { e.preventDefault(); input.press(a, true); };
      const up = (e) => { e.preventDefault(); input.press(a, false); };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('pointercancel', up);
    }
  }

  flash(btn, text) {
    const span = btn.querySelector('span');
    const old = span.textContent;
    span.textContent = text;
    setTimeout(() => (span.textContent = old), 1400);
  }

  showBanner(text) {
    this.banner.textContent = text;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth; // restart the animation
    this.banner.classList.add('show');
  }

  update() {
    if (this.input.used) this.hint.classList.add('fade');
  }

  dispose() {
    this.el.remove();
  }
}
