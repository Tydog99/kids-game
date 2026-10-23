import { describe, it, expect } from 'vitest';
import { midi, freq, MELODY, PROGRESSION, BAR, LOOP, buildEvents } from '../src/audio/score.js';

describe('music score', () => {
  it('reads note names', () => {
    expect(midi('A4')).toBe(69);
    expect(midi('C4')).toBe(60);
    expect(midi('Bb4')).toBe(70);
    expect(freq(69)).toBeCloseTo(440);
    expect(() => midi('H2')).toThrow();
  });

  it('every melody bar adds up to a full bar, and the melody fills the loop', () => {
    let t = 0, barFill = 0;
    for (const [, d] of MELODY) {
      t += d;
      barFill += d;
      expect(barFill).toBeLessThanOrEqual(BAR); // no note spills across a barline
      if (barFill === BAR) barFill = 0;
    }
    expect(t).toBe(LOOP);
    expect(PROGRESSION).toHaveLength(16);
  });

  for (const night of [false, true]) {
    it(`${night ? 'night' : 'day'} arrangement stays inside the loop with sensible notes`, () => {
      const ev = buildEvents({ night });
      for (const e of ev) {
        expect(e.t).toBeGreaterThanOrEqual(0);
        expect(e.t + e.dur).toBeLessThanOrEqual(LOOP + 1e-9);
        if (e.note !== undefined) {
          expect(e.note).toBeGreaterThanOrEqual(midi('C2'));
          expect(e.note).toBeLessThanOrEqual(midi('D6'));
        }
      }
      const voices = new Set(ev.map((e) => e.voice));
      expect([...voices].sort()).toEqual(night ? ['arp', 'bass', 'lead'] : ['arp', 'bass', 'hat', 'kick', 'lead', 'snare']);
    });
  }
});
