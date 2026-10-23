// The Sky Pitch race, from Grandpa Ollie's magic ring to the finish and home again.
//
// Fly a dragon through the magic ring → a flash of light, and you're at the Sky Pitch → a
// countdown → fly through the golden rings around the pitch, then down the middle and through the
// tall goal hoop → fireworks and your time → a flash, and you're back by the magic ring.
import * as THREE from 'three';
import { raceCourse, START, passes, pitchTile, formatTime } from './course.js';
import { SkyPitch } from './SkyPitch.js';
import { MagicRing, MAGIC_RADIUS } from './MagicRing.js';
import { speakLine } from '../ui/speak.js';
import { music } from '../audio/Music.js';

const ARRIVE_WAIT = 2.6; // seconds after arriving before the countdown starts
const COUNT = 3; // the countdown
const PARTY = 6; // seconds of fireworks at the finish before going home
const LAP_RINGS = 12; // rings around the pitch; then the run down the middle
const VIEW = { near: 45, far: 110 }; // how far you can see at the pitch
const FIREWORK_COLOURS = ['#ff5a5a', '#ffd23f', '#6fe0ff', '#9dff7a', '#ff8af0'];

// Holds the player still (the game treats it like a cutscene, without moving the camera).
class Hold {
  constructor(seconds) {
    this.left = seconds;
    this.done = false;
  }
  get locked() {
    return !this.done;
  }
  update(dt) {
    this.left -= dt;
    if (this.left <= 0) this.done = true;
  }
  cancel() {
    this.done = true;
  }
}

export class Race {
  // ringAt: { x, z, heading } where the magic ring stands in the world (it floats above that)
  // onFinish(seconds): the course was flown; onHome(): back from the pitch
  constructor(game, ringAt, { onFinish = () => {}, onHome = () => {}, bestTime = null, nag = () => {} } = {}) {
    this.g = game;
    this.onFinish = onFinish;
    this.onHome = onHome;
    this.bestTime = bestTime;
    this.nag = nag;
    this.state = 'idle'; // idle | going | arriving | countdown | racing | finished | leaving
    this.rings = raceCourse();
    this.offset = { x: game.world.width + 140, z: Math.floor(game.world.height / 2) };
    this.pitch = new SkyPitch(game.scene, this.offset);
    this.pitch.setCourse(this.rings);
    this.ringAt = ringAt;
    this.portal = new MagicRing(game.scene, { x: ringAt.x, y: 4.6, z: ringAt.z }, ringAt.heading);
    this.cooldown = 0;
    this.prev = null;

    this.flash = document.createElement('div');
    this.flash.className = 'magic-flash';
    this.hud = document.createElement('div');
    this.hud.className = 'race-hud';
    this.hud.hidden = true;
    this.big = document.createElement('div');
    this.big.className = 'race-count';
    this.arrow = document.createElement('div');
    this.arrow.className = 'race-arrow';
    this.arrow.textContent = '⬆';
    this.arrow.hidden = true;
    document.body.append(this.flash, this.hud, this.big, this.arrow);
  }

  get inArena() {
    return this.state !== 'idle' && this.state !== 'going';
  }

  // For a ridden dragon at the pitch: world tile → what's there.
  tile(tx, tz) {
    return pitchTile(tx - this.offset.x, tz - this.offset.z);
  }

  local(d) {
    return { x: d.x - this.offset.x, y: d.y, z: d.z - this.offset.z };
  }

  update(dt, t) {
    const g = this.g;
    this.portal.update(t, g.camera.position);
    this.cooldown -= dt;
    const d = g.riding;

    if (this.state === 'idle') {
      if (d && this.cooldown <= 0) {
        const now = { x: d.x, y: d.y + 0.9 * d.scale * 0.5, z: d.z };
        if (this.prev && passes(this.portal.at, this.prev, now, MAGIC_RADIUS + 0.4)) this.goToPitch();
        this.prev = now;
      } else this.prev = null;
      if (!d) {
        const p = g.playerInfo();
        if (Math.hypot(p.x - this.portal.at.x, p.z - this.portal.at.z) < 4) this.nag('Climb on a dragon, then fly through the magic ring!');
      }
      return;
    }

    this.stateT += dt;
    if (this.state === 'arriving' && this.stateT > ARRIVE_WAIT) this.setState('countdown');
    if (this.state === 'countdown') {
      const left = COUNT - this.stateT;
      this.big.textContent = left > 0 ? String(Math.ceil(left)) : 'GO!';
      this.big.classList.toggle('show', true);
      if (left <= 0) {
        this.setState('racing');
        this.time = 0;
        this.next = 0;
        this.prevLocal = d ? this.local(d) : null;
        music.chime?.([784, 1047]);
        setTimeout(() => this.big.classList.remove('show'), 700);
      }
    }
    if (this.state === 'racing' && d) {
      this.time += dt;
      const now = this.local(d);
      const ring = this.rings[this.next];
      if (this.prevLocal && ring && passes(ring, this.prevLocal, now)) this.passRing();
      this.prevLocal = now;
      this.pointToNext();
    }
    if (this.state === 'finished') {
      // fireworks over the pitch
      if (Math.random() < dt * 3.5) this.firework(d);
      if (this.stateT > PARTY) this.goHome();
    }
    if (this.state !== 'racing') this.arrow.hidden = true;
    this.pitch.update(dt, t, this.state === 'racing' || this.state === 'countdown' || this.state === 'arriving' ? this.next ?? 0 : this.rings.length);
    this.showHud();
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  passRing() {
    this.next++;
    music.chime?.(this.next >= this.rings.length ? [784, 988, 1175, 1568] : [988 + this.next * 20]);
    if (this.next === LAP_RINGS) {
      this.g.hud.showBanner('Now down the middle and through the big hoop!', true);
      speakLine('n_race_middle');
    }
    if (this.next >= this.rings.length) this.finish();
  }

  finish() {
    const time = this.time;
    const best = this.bestTime === null || time < this.bestTime;
    const first = this.bestTime === null;
    this.bestTime = best ? time : this.bestTime;
    this.setState('finished');
    this.g.hud.showBanner(`You did it! 🏆 ${formatTime(time)}${best && !first ? ' · New best time!' : ''}`, true);
    speakLine(best && !first ? ['n_race_done', 'n_race_best'] : 'n_race_done');
    for (let i = 0; i < 4; i++) this.firework(this.g.riding);
    this.onFinish(time);
  }

  // A firework bursting up ahead of the dragon, where you can see it.
  firework(d) {
    const c = FIREWORK_COLOURS[Math.floor(Math.random() * FIREWORK_COLOURS.length)];
    const at = d ? this.local(d) : { x: 0, y: 5, z: 0 };
    const h = d ? d.heading : 0, ahead = 14 + Math.random() * 10, side = (Math.random() - 0.5) * 18;
    this.pitch.burst(at.x + Math.sin(h) * ahead + Math.cos(h) * side, 8 + Math.random() * 7, at.z + Math.cos(h) * ahead - Math.sin(h) * side, c);
  }

  // Point an arrow at the next ring when it's off the screen.
  pointToNext() {
    const ring = this.rings[this.next];
    if (!ring) return;
    const v = new THREE.Vector3(ring.x + this.offset.x, ring.y, ring.z + this.offset.z).project(this.g.camera);
    const behind = v.z > 1;
    const onScreen = !behind && Math.abs(v.x) < 0.85 && Math.abs(v.y) < 0.8;
    this.arrow.hidden = onScreen;
    if (onScreen) return;
    let x = v.x, y = v.y;
    if (behind) {
      x = -x;
      y = -y;
    }
    this.arrow.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(x, y)}rad)`;
  }

  showHud() {
    const racing = this.state === 'racing' || this.state === 'finished';
    this.hud.hidden = !racing;
    if (!racing) return;
    const n = Math.min(this.next, this.rings.length);
    this.hud.innerHTML = `<span>💫 ${n} / ${this.rings.length}</span><span>⏱ ${formatTime(this.time)}</span>${this.bestTime !== null ? `<span class="race-best">Best ${formatTime(this.bestTime)}</span>` : ''}`;
  }

  // A flash of light; `then` runs while the screen is white.
  whoosh(then) {
    this.flash.classList.add('on');
    music.chime?.([523, 659, 784, 1047]);
    setTimeout(() => {
      then();
      setTimeout(() => this.flash.classList.remove('on'), 120);
    }, 450);
  }

  goToPitch() {
    const g = this.g;
    const d = g.riding;
    this.setState('going');
    g.cutscene = new Hold(0.6);
    this.whoosh(() => {
      if (g.riding !== d) {
        this.setState('idle');
        return;
      }
      this.place(d, this.offset.x + START.x, START.y, this.offset.z + START.z, START.heading);
      this.pitch.group.visible = true;
      this.portal.visible = false;
      // the camera sits further back and higher, to see over the dragon to the rings ahead
      this.zoom = g.follow.zoomTarget;
      g.follow.zoomTarget = this.zoom * 1.4;
      this.see(true);
      // always a sunny day at the Sky Pitch
      if (g.dayCycle.state?.stars > 0.2) g.dayCycle.phase = 0.28;
      g.inArena = true;
      this.next = 0;
      this.setState('arriving');
      g.cutscene = new Hold(ARRIVE_WAIT + COUNT);
      g.hud.showBanner('Welcome to the Sky Pitch!', true);
      speakLine('n_race_welcome');
    });
  }

  goHome() {
    const g = this.g;
    const d = g.riding;
    this.setState('leaving');
    this.whoosh(() => {
      const { x, z, heading } = this.ringAt;
      // come out of the magic ring, flying away from it
      const fx = Math.sin(heading), fz = Math.cos(heading);
      if (d) this.place(d, x + fx * 4, 4.6, z + fz * 4, heading);
      this.pitch.group.visible = false;
      this.portal.visible = true;
      if (this.zoom) g.follow.zoomTarget = this.zoom;
      this.see(false);
      g.inArena = false;
      this.cooldown = 3;
      this.prev = null;
      this.setState('idle');
      this.hud.hidden = true;
      this.arrow.hidden = true;
      this.onHome();
    });
  }

  place(d, x, y, z, heading) {
    const m = d.motor;
    if (m) {
      m.x = x;
      m.y = y;
      m.z = z;
      m.heading = heading;
      m.speed = 0;
      m.vy = 0;
      m.grounded = false;
    }
    d.x = x;
    d.y = y;
    d.z = z;
    d.heading = heading;
    d.place();
    const pm = this.g.player.motor;
    pm.px = x;
    pm.pz = z;
    this.g.follow.first = true;
  }

  // open up the view at the pitch, or put it back
  see(open) {
    const fog = this.g.scene.fog, cam = this.g.camera;
    this.base ??= { near: fog.near, far: fog.far, cam: cam.far };
    fog.near = open ? VIEW.near : this.base.near;
    fog.far = open ? VIEW.far : this.base.far;
    cam.far = open ? VIEW.far + 5 : this.base.cam;
    cam.updateProjectionMatrix();
  }

  dispose() {
    this.pitch.dispose();
    this.portal.dispose();
    this.flash.remove();
    this.hud.remove();
    this.big.remove();
    this.arrow.remove();
    if (this.g.inArena) this.see(false);
    this.g.inArena = false;
  }
}
