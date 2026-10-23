// Plays a theme (score.js) with a tiny 8-bit style synth: a square or pulse-wave lead, a thin pulse-wave
// arpeggio, a triangle bass and noise drums. Notes are scheduled a little ahead of time so the
// rhythm stays steady. Browsers only allow sound after a click or key press, so call unlock()
// from one; the music starts then.
import { buildEvents, freq, theme as findTheme, eighthSeconds, loopLength } from './score.js';

const LOOKAHEAD = 0.25; // seconds of music scheduled ahead

// A pulse wave with the given duty cycle (0.5 = square), as Fourier terms.
function pulseWave(ctx, duty) {
  const n = 32, real = new Float32Array(n), imag = new Float32Array(n);
  for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

export class Music {
  constructor() {
    this.volume = 6; // 0..10
    this.night = false;
    this.ctx = null;
    this.cache = new Map();
    this.previewNight = null; // the music picker can preview day or night
    this.setTheme('hero');
  }

  // Events grouped by bar, for a theme's day or night arrangement.
  barsFor(th, night) {
    const key = `${th.id}:${night}`;
    if (!this.cache.has(key)) {
      const byBar = Array.from({ length: th.progression.length }, () => []);
      for (const e of buildEvents(th, { night })) byBar[Math.floor(e.t / th.bar)].push(e);
      this.cache.set(key, byBar);
    }
    return this.cache.get(key);
  }

  // Switch to another theme; it starts from its first bar at the next barline.
  setTheme(id) {
    const th = findTheme(id);
    if (th === this.theme) return;
    this.theme = th;
    this.bar = 0;
  }

  // Call from a click or key press.
  unlock() {
    if (this.volume === 0) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.setup();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setup() {
    const ctx = this.ctx;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.ratio.value = 4;
    this.master = ctx.createGain();
    this.master.gain.value = this.level();
    this.master.connect(this.comp).connect(ctx.destination);
    this.waves = { arp: pulseWave(ctx, 0.25), pulse: pulseWave(ctx, 0.25) };
    // a second of white noise for the drums
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.bar = 0;
    this.barTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 40);
  }

  level() {
    return Math.pow(this.volume / 10, 2) * 0.7;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.05);
    if (v > 0 && this.ctx?.state === 'suspended') this.ctx.resume();
  }

  // Night switches to the softer arrangement from the next bar.
  setNight(night) {
    this.night = night;
  }

  schedule() {
    const ctx = this.ctx;
    if (ctx.state !== 'running' || this.volume === 0) {
      this.barTime = Math.max(this.barTime, ctx.currentTime + 0.05);
      return;
    }
    // after the tab was in the background, start again from now rather than catching up
    if (this.barTime < ctx.currentTime - 0.5) this.barTime = ctx.currentTime + 0.05;
    while (this.barTime < ctx.currentTime + LOOKAHEAD) {
      const th = this.theme, night = this.previewNight ?? this.night;
      const bars = this.barsFor(th, night), eighth = eighthSeconds(th);
      this.bar %= bars.length;
      for (const e of bars[this.bar]) this.play(e, this.barTime + (e.t - this.bar * th.bar) * eighth, night, eighth);
      this.bar = (this.bar + 1) % bars.length;
      this.barTime += th.bar * eighth;
    }
  }

  play(e, time, night, eighth) {
    const dur = e.dur * eighth;
    switch (e.voice) {
      case 'lead':
        return this.tone(time, dur * e.gate, freq(e.note), this.waves[e.wave] ?? e.wave, e.gain * e.vel, true);
      case 'arp':
        return this.tone(time, dur * 0.8, freq(e.note), this.waves.arp, (night ? 0.035 : 0.03) * e.vel, false);
      case 'bass':
        return this.tone(time, dur * (night ? 0.95 : 0.7), freq(e.note), 'triangle', 0.32 * e.vel, false);
      case 'kick':
        return this.kick(time, e.vel);
      case 'snare':
        return this.drum(time, 0.14, 1200, 0.22 * e.vel);
      case 'hat':
        return this.drum(time, 0.035, 7000, 0.05 * e.vel);
    }
  }

  tone(time, dur, hz, wave, gain, vibrato) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    if (typeof wave === 'string') osc.type = wave;
    else osc.setPeriodicWave(wave);
    osc.frequency.value = hz;
    const g = ctx.createGain();
    // quick attack, settle a little, short release
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.01);
    g.gain.linearRampToValueAtTime(gain * 0.75, time + Math.min(0.12, dur * 0.5));
    g.gain.setValueAtTime(gain * 0.75, time + Math.max(0.02, dur - 0.04));
    g.gain.linearRampToValueAtTime(0, time + dur);
    if (vibrato && dur > 0.3) {
      // a gentle wobble on long notes
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.setValueAtTime(0, time);
      depth.gain.linearRampToValueAtTime(hz * 0.006, time + 0.25);
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(time);
      lfo.stop(time + dur);
    }
    osc.connect(g).connect(this.master);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  kick(time, vel) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.frequency.setValueAtTime(130, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);
    g.gain.setValueAtTime(0.45 * vel, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    osc.connect(g).connect(this.master);
    osc.start(time);
    osc.stop(time + 0.17);
  }

  drum(time, length, cutoff, gain) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + length);
    src.connect(filter).connect(g).connect(this.master);
    src.start(time, Math.random() * 0.5);
    src.stop(time + length + 0.01);
  }
}

// One music player for the whole page (title screen and game).
export const music = new Music();
