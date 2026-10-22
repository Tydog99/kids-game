import { DAY_LENGTHS, formatDayLength } from '../world/skyState.js';
import { METEOR_RATES } from '../world/shootingStars.js';

// In-game overlay: seed/share, new world, controls hint, town banner, touch d-pad.
export class Hud {
  constructor({ seed, onExit, input, dayIndex, onDaySpeed, meteorIndex, onMeteorRate }) {
    this.el = document.createElement('div');
    this.el.className = 'overlay hud';
    this.el.innerHTML = `
      <button class="pill seed" title="Copy this world's seed to share it">🌍 <span></span></button>
      <button class="pill exit">New World</button>
      <div class="banner"></div>
      <div class="daypanel">
        <div class="setting">
          <div class="setting-head"><label for="dayspeed">☀️ Sun speed</label><output for="dayspeed"></output></div>
          <input id="dayspeed" type="range" min="0" max="${DAY_LENGTHS.length - 1}" step="1" />
        </div>
        <div class="setting">
          <div class="setting-head"><label for="meteors">🌠 Shooting stars</label><output for="meteors"></output></div>
          <input id="meteors" type="range" min="0" max="${METEOR_RATES.length - 1}" step="1" />
        </div>
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
    this.slider('#dayspeed', dayIndex, (i) => formatDayLength(DAY_LENGTHS[i]), onDaySpeed);
    this.slider('#meteors', meteorIndex, (i) => METEOR_RATES[i].label, onMeteorRate);

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
