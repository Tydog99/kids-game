import { describe, it, expect } from 'vitest';
import { midi, freq, THEMES, theme, loopLength, buildEvents } from '../src/audio/score.js';

describe('music', () => {
  it('reads note names', () => {
    expect(midi('A4')).toBe(69);
    expect(midi('C4')).toBe(60);
    expect(midi('Bb4')).toBe(70);
    expect(midi('C#6')).toBe(85);
    expect(freq(69)).toBeCloseTo(440);
    expect(() => midi('H2')).toThrow();
  });

  it('has five themes with unique ids; unknown ids fall back to the first', () => {
    expect(THEMES).toHaveLength(5);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(5);
    expect(theme('nope')).toBe(THEMES[0]);
  });

  for (const th of THEMES) {
    describe(th.name, () => {
      it('every melody bar adds up to a full bar and the melody fills the loop', () => {
        let t = 0, fill = 0;
        for (const [n, d] of th.melody) {
          expect(() => n === 'R' || midi(n)).not.toThrow();
          t += d;
          fill += d;
          expect(fill).toBeLessThanOrEqual(th.bar); // no note spills across a barline
          if (fill === th.bar) fill = 0;
        }
        expect(th.progression).toHaveLength(16);
        expect(t).toBe(loopLength(th));
      });

      for (const night of [false, true]) {
        it(`${night ? 'night' : 'day'} arrangement stays inside the loop with sensible notes`, () => {
          const ev = buildEvents(th, { night });
          for (const e of ev) {
            expect(e.t).toBeGreaterThanOrEqual(0);
            expect(e.t + e.dur).toBeLessThanOrEqual(loopLength(th) + 1e-9);
            if (e.note !== undefined) {
              expect(e.note).toBeGreaterThanOrEqual(midi('C2'));
              expect(e.note).toBeLessThanOrEqual(midi('D6'));
            }
          }
          const voices = new Set(ev.map((e) => e.voice));
          for (const v of ['lead', 'bass', 'arp']) expect(voices.has(v)).toBe(true);
          if (night) expect([...voices].sort()).toEqual(['arp', 'bass', 'lead']);
          else expect(voices.size).toBeGreaterThan(3); // some drums by day
        });
      }
    });
  }
});
