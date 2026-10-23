import { DAY_LENGTHS, formatDayLength } from '../world/skyState.js';
import { METEOR_RATES } from '../world/shootingStars.js';
import { MAX_DRAGONS } from '../creatures/dragonSpawns.js';

// In-game overlay: seed/share, new world, controls hint, town banner, touch d-pad.
export class Hud {
  constructor({ seed, onExit, onOptions, input, dayIndex, onDaySpeed, meteorIndex, onMeteorRate, dragonCount, onDragonCount, musicVolume, onMusicVolume }) {
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
        <div class="setting">
          <div class="setting-head"><label for="music">🎵 Music</label><output for="music"></output></div>
          <input id="music" type="range" min="0" max="10" step="1" />
        </div>
        <label class="debug" hidden><input id="debug-open" type="checkbox" /> 🛠️ Debug: open without keys</label>
      </div>
      <div class="hint">⬆ walk &nbsp; ⬇ back up &nbsp; ⬅ ➡ turn &nbsp; 🖱 drag to look around</div>
      <div class="dpad">
        <button data-a="forward">▲</button><button data-a="left">◀</button>
        <button data-a="right">▶</button><button data-a="back">▼</button>
      </div>
      <div class="flypad" hidden>
        <button data-a="up" aria-label="Fly up">⬆</button>
        <button data-a="breathe" aria-label="Breathe">🔥</button>
        <button data-a="down" aria-label="Fly down">⬇</button>
      </div>
      <section class="my-dragons" hidden aria-label="My Dragons">
        <h2>My Dragons</h2>
        <div class="my-dragons-list"></div>
      </section>
      <div class="trust-bubble" hidden aria-live="polite"><div class="hearts"></div><div class="trust-text"></div></div>
      <button class="ride-prompt" type="button" hidden></button>
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
    this.slider('#music', musicVolume, (n) => (n === 0 ? 'Off' : String(n)), onMusicVolume);

    this.hint = this.el.querySelector('.hint');
    this.banner = this.el.querySelector('.banner');
    this.keys = this.el.querySelector('.keys');
    this.input = input;
    this.trustBubble = this.el.querySelector('.trust-bubble');
    this.ridePrompt = this.el.querySelector('.ride-prompt');
    this.ridePrompt.onclick = () => {
      input.tapped.interact = true;
      this.ridePrompt.blur();
    };
    this.myDragons = this.el.querySelector('.my-dragons');
    // buttons give focus back to the game so Space/arrows don't press them again
    this.el.addEventListener('click', (e) => e.target.closest?.('button')?.blur());
    for (const b of this.el.querySelectorAll('.dpad button, .flypad button')) {
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

  setHint(html) {
    if (this.hint.innerHTML === html) return;
    this.hint.innerHTML = html;
    this.hint.classList.remove('fade');
    this.input.used = false; // fades again once they press something
  }

  // Trust hearts for the nearest wild dragon, shown at the bottom of the screen; null hides it.
  showTrust(info) {
    const b = this.trustBubble;
    if (!info) {
      b.hidden = true;
      return;
    }
    b.hidden = false;
    b.style.setProperty('--swatch', info.color);
    const hearts = Array.from({ length: 5 }, (_, i) => (i < info.hearts ? '💛' : '🤍')).join('');
    if (b.dataset.hearts !== hearts) {
      b.querySelector('.hearts').textContent = hearts;
      b.dataset.hearts = hearts;
    }
    b.querySelector('.trust-text').textContent = info.text;
  }

  // The "Press E to ride" style prompt; null hides it.
  showPrompt(text) {
    this.ridePrompt.hidden = !text;
    if (text && this.ridePrompt.textContent !== text) this.ridePrompt.textContent = text;
  }

  setRiding(on) {
    this.el.classList.toggle('riding', on);
    this.el.querySelector('.flypad').hidden = !on;
  }

  // dragons: [{ index, name, kind, color, status }]
  showMyDragons(dragons, onCall) {
    this.myDragons.hidden = dragons.length === 0;
    const list = this.myDragons.querySelector('.my-dragons-list');
    const key = JSON.stringify(dragons);
    if (list.dataset.key === key) return;
    list.dataset.key = key;
    list.innerHTML = '';
    for (const d of dragons) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'my-dragon';
      b.style.setProperty('--swatch', d.color);
      b.title = d.status ? `${d.name}: ${d.status}` : `Call ${d.name}`;
      b.innerHTML = `<span class="swatch" aria-hidden="true"></span><span class="who"></span><small></small>`;
      b.querySelector('.who').textContent = d.name;
      b.querySelector('small').textContent = d.status || 'Tap to call';
      b.onclick = () => onCall(d.index);
      list.appendChild(b);
    }
  }

  // Ask for a new dragon's name. Calls onDone(name) once.
  askName({ title, suggestion, color }, onDone) {
    const wrap = document.createElement('div');
    wrap.className = 'name-dialog';
    wrap.innerHTML = `
      <form class="name-panel" role="dialog" aria-modal="true" aria-labelledby="name-title">
        <div class="name-burst" aria-hidden="true">🐉💛</div>
        <h2 id="name-title"></h2>
        <label for="dragon-name">Give your dragon a name</label>
        <input id="dragon-name" type="text" maxlength="16" autocomplete="off" spellcheck="false" />
        <button type="submit">That's the name!</button>
      </form>`;
    wrap.querySelector('h2').textContent = title;
    wrap.querySelector('.name-panel').style.setProperty('--swatch', color);
    const input = wrap.querySelector('input');
    input.value = suggestion;
    document.body.appendChild(wrap);
    input.focus();
    input.select();
    const done = (e) => {
      e?.preventDefault();
      wrap.remove();
      onDone(input.value);
    };
    wrap.querySelector('form').addEventListener('submit', done);
    input.addEventListener('keydown', (e) => e.code === 'Escape' && done(e));
  }

  dispose() {
    this.el.remove();
  }
}
