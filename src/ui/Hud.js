import { DAY_LENGTHS, formatDayLength } from '../world/skyState.js';
import { METEOR_RATES } from '../world/shootingStars.js';
import { MAX_DRAGONS } from '../creatures/dragonSpawns.js';

// In-game overlay: quest tracker, new world, controls hint, town banner, touch d-pad.
export class Hud {
  constructor({ onExit, onOptions, input, dayIndex, onDaySpeed, meteorIndex, onMeteorRate, dragonCount, onDragonCount, musicVolume, onMusicVolume }) {
    this.onDebugChange = null;
    this.el = document.createElement('div');
    this.el.className = 'overlay hud';
    this.el.innerHTML = `
      <div class="top-right">
        <button class="pill book-btn" type="button" hidden>📖 Dragon Book</button>
        <button class="pill options" type="button">⚙️ Options</button>
        <button class="pill exit">New World</button>
      </div>
      <div class="banner"></div>
      <div class="keys" hidden></div>
      <div class="goal" hidden aria-live="polite"><h2 class="goal-head">Quests</h2><span class="goal-icon"></span><span class="goal-text"></span><span class="compass" hidden aria-hidden="true"><span class="needle">➤</span><small></small></span></div>
      <div class="speech" hidden aria-live="polite"><b class="speech-who"></b><span class="speech-text"></span><button type="button" class="speech-read" aria-label="Read out loud">🔊</button></div>
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
        <div class="grown-up" hidden>
          <span>Grown-ups:</span>
          <button type="button" class="skip">⏭ Skip ahead</button>
          <button type="button" class="reset">↺ Start over</button>
        </div>
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
    this.el.querySelector('.exit').onclick = onExit;
    this.el.querySelector('.options').onclick = onOptions;
    this.slider('#dayspeed', dayIndex, (i) => formatDayLength(DAY_LENGTHS[i]), onDaySpeed);
    this.slider('#meteors', meteorIndex, (i) => METEOR_RATES[i].label, onMeteorRate);
    this.slider('#dragons', dragonCount, (n) => (n === 0 ? 'None' : String(n)), onDragonCount);
    this.slider('#music', musicVolume, (n) => (n === 0 ? 'Off' : String(n)), onMusicVolume);
    // the music picker can switch the music back on
    this.onMusicVolume = (e) => {
      const input = this.el.querySelector('#music');
      input.value = e.detail;
      this.el.querySelector('output[for="music"]').textContent = String(e.detail);
    };
    addEventListener('music-volume', this.onMusicVolume);

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

  // Adventure: grown-up shortcuts to skip a chapter or start the story again.
  // onJump(chapter) starts a chapter from its beginning.
  showGrownUp({ onSkip, onReset, onJump }) {
    const row = this.el.querySelector('.grown-up');
    row.hidden = false;
    // Skip ahead opens a little menu: the next step, or jump straight to a chapter
    const menu = document.createElement('div');
    menu.className = 'skip-menu';
    menu.hidden = true;
    menu.innerHTML = `
      <button type="button" data-go="next">⏭ Next step</button>
      <span>Jump to:</span>
      <button type="button" data-go="treasure">🔑 Keys</button>
      <button type="button" data-go="dragons">🐉 Dragons</button>
      <button type="button" data-go="race">🏁 Race</button>
      <button type="button" data-go="village">🏘️ Villagers</button>`;
    row.append(menu);
    row.querySelector('.skip').onclick = () => (menu.hidden = !menu.hidden);
    menu.onclick = (e) => {
      const go = e.target.closest('button')?.dataset.go;
      if (!go) return;
      menu.hidden = true;
      if (go === 'next') onSkip();
      else onJump(go);
    };
    const reset = row.querySelector('.reset');
    reset.onclick = () => {
      // ask once by changing the label, so it isn't pressed by accident
      if (reset.dataset.armed) return onReset();
      reset.dataset.armed = '1';
      reset.textContent = 'Sure? Press again';
      setTimeout(() => {
        delete reset.dataset.armed;
        reset.textContent = '↺ Start over';
      }, 3000);
    };
  }

  // Adventure has exactly three dragons, so there's no slider for them.
  hideDragonSlider() {
    this.el.querySelector('#dragons').closest('.setting').hidden = true;
  }

  // The quest tracker: what to do next.
  showGoal(goal) {
    const g = this.el.querySelector('.goal');
    g.hidden = !goal;
    if (!goal) return;
    g.querySelector('.goal-icon').textContent = goal.icon;
    g.querySelector('.goal-text').textContent = goal.text;
  }

  // The quest compass: angle (radians, 0 = straight ahead, clockwise) to the quest's target and a
  // word for how far it is; null hides it.
  showCompass(c) {
    const el = this.el.querySelector('.compass');
    el.hidden = !c;
    if (!c) return;
    const needle = el.querySelector('.needle');
    const here = c.word === 'here!';
    needle.textContent = here ? '✨' : '➤';
    needle.style.transform = here ? 'none' : `rotate(${c.angle - Math.PI / 2}rad)`;
    el.querySelector('small').textContent = c.word;
  }

  // A villager's speech box with a read-aloud button; null hides it.
  showSpeech(speech) {
    const b = this.el.querySelector('.speech');
    b.hidden = !speech;
    if (!speech) return;
    b.querySelector('.speech-who').textContent = speech.who;
    b.querySelector('.speech-text').textContent = speech.text;
    b.querySelector('.speech-read').onclick = speech.onRead;
  }

  showBookButton(onClick) {
    const b = this.el.querySelector('.book-btn');
    b.hidden = false;
    b.onclick = onClick;
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
    removeEventListener('music-volume', this.onMusicVolume);
    this.el.remove();
  }
}
