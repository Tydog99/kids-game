import { DAY_LENGTHS, formatDayLength } from '../world/skyState.js';
import { METEOR_RATES } from '../world/shootingStars.js';
import { MAX_DRAGONS } from '../creatures/dragonSpawns.js';

// In-game overlay: seed/share, new world, controls hint, town banner, touch d-pad.
export class Hud {
  constructor({ seed, onExit, onOptions, input, dayIndex, onDaySpeed, meteorIndex, onMeteorRate, dragonCount, onDragonCount }) {
    this.onDebugChange = null;
    this.el = document.createElement('div');
    this.el.className = 'overlay hud';
    this.el.innerHTML = `
      <button class="pill seed" title="Copy this world's seed to share it">🌍 <span></span></button>
      <div class="top-right">
        <button class="pill options" type="button">⚙️ Options</button>
        <button class="pill exit">New World</button>
      </div>
      <div class="banner"></div>
      <div class="keys" hidden></div>
      <div class="daypanel">
        <div class="setting">
          <div class="setting-head"><label for="dayspeed">☀️ Sun speed</label><output for="dayspeed"></output></div>
          <input id="dayspeed" type="range" min="0" max="${DAY_LENGTHS.length - 1}" step="1" />
        </div>
        <div class="setting">
          <div class="setting-head"><label for="meteors">🌠 Shooting stars</label><output for="meteors"></output></div>
          <input id="meteors" type="range" min="0" max="${METEOR_RATES.length - 1}" step="1" />
        </div>
        <div class="setting">
          <div class="setting-head"><label for="dragons">🐉 Dragons</label><output for="dragons"></output></div>
          <input id="dragons" type="range" min="0" max="${MAX_DRAGONS}" step="1" />
        </div>
        <label class="debug" hidden><input id="debug-open" type="checkbox" /> 🛠️ Debug: open without keys</label>
      </div>
      <div class="hint">⬆ walk &nbsp; ⬇ back up &nbsp; ⬅ ➡ turn &nbsp; 🖱 drag to look around</div>
      <div class="dpad">
        <button data-a="forward">▲</button><button data-a="left">◀</button>
        <button data-a="right">▶</button><button data-a="back">▼</button>
      </div>
    `;
    document.body.appendChild(this.el);
    const seedBtn = this.el.querySelector('.seed');
    seedBtn.querySelector('span').textContent = seed;
    seedBtn.onclick = () => {
      navigator.clipboard
        .writeText(seed)
        .then(() => this.flash(seedBtn, 'Seed copied!'))
        .catch(() => this.flash(seedBtn, seed));
    };
    this.el.querySelector('.exit').onclick = onExit;
    this.el.querySelector('.options').onclick = onOptions;
    this.slider('#dayspeed', dayIndex, (i) => formatDayLength(DAY_LENGTHS[i]), onDaySpeed);
    this.slider('#meteors', meteorIndex, (i) => METEOR_RATES[i].label, onMeteorRate);
    this.slider('#dragons', dragonCount, (n) => (n === 0 ? 'None' : String(n)), onDragonCount);

    this.hint = this.el.querySelector('.hint');
    this.banner = this.el.querySelector('.banner');
    this.keys = this.el.querySelector('.keys');
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

  slider(selector, value, label, onChange) {
    const input = this.el.querySelector(selector);
    const readout = this.el.querySelector(`output[for="${input.id}"]`);
    input.value = value;
    readout.textContent = label(value);
    input.addEventListener('input', () => {
      const i = Number(input.value);
      readout.textContent = label(i);
      onChange(i);
    });
    // hand the arrow keys back to walking once the slider is let go
    const release = () => input.blur();
    input.addEventListener('pointerup', release);
    input.addEventListener('change', release);
  }

  flash(btn, text) {
    const span = btn.querySelector('span');
    const old = span.textContent;
    span.textContent = text;
    setTimeout(() => (span.textContent = old), 1400);
  }

  // important banners (treasure hunt news) aren't replaced by town-name banners for a few seconds
  showBanner(text, important = false) {
    const now = performance.now();
    if (!important && now < (this.importantUntil ?? 0)) return;
    if (important) this.importantUntil = now + 3500;
    this.banner.textContent = text;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth; // restart the animation
    this.banner.classList.add('show');
  }

  // Treasure hunt only: checkbox that lets the chest open without keys.
  showDebugToggle(checked, onChange) {
    const row = this.el.querySelector('.debug');
    const box = row.querySelector('input');
    row.hidden = false;
    box.checked = checked;
    box.addEventListener('change', () => {
      onChange(box.checked);
      box.blur(); // hand the arrow keys back to walking
    });
  }

  showKeys(count, total) {
    this.keys.hidden = false;
    this.keys.innerHTML = Array.from({ length: total }, (_, i) => `<span class="${i < count ? 'got' : ''}">🔑</span>`).join('');
    this.keys.setAttribute('aria-label', `${count} of ${total} golden keys`);
  }

  update() {
    if (this.input.used) this.hint.classList.add('fade');
  }

  dispose() {
    this.el.remove();
  }
}
