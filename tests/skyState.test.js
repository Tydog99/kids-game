import { describe, it, expect } from 'vitest';
import { skyState, skyPathDir, SKY_ARC_PEAK, formatDayLength, DAY_LENGTHS, DEFAULT_DAY_INDEX } from '../src/world/skyState.js';

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe('skyState', () => {
  it('sun is up at noon and down at midnight; moon opposite', () => {
    expect(skyState(0.25).sunDir[1]).toBeGreaterThan(0.9);
    expect(skyState(0.75).sunDir[1]).toBeLessThan(-0.9);
    expect(skyState(0.75).moonDir[1]).toBeGreaterThan(0.9);
  });

  it('sun rises in the east (+x) and sets in the west (-x)', () => {
    expect(skyState(0.02).sunDir[0]).toBeGreaterThan(0.8);
    expect(skyState(0.48).sunDir[0]).toBeLessThan(-0.8);
  });

  it('shadow light follows the sun by day and the moon by night', () => {
    expect(skyState(0.25).light.dir).toEqual(skyState(0.25).sunDir);
    expect(skyState(0.75).light.dir).toEqual(skyState(0.75).moonDir);
  });

  it('light fades out at the horizon so the sun→moon switch is invisible', () => {
    expect(skyState(0).light.intensity).toBeCloseTo(0);
    expect(skyState(0.5).light.intensity).toBeCloseTo(0);
  });

  it('night is darker than day but never too dark to see', () => {
    for (let p = 0; p < 1; p += 0.01) {
      const s = skyState(p);
      expect(s.hemi.intensity).toBeGreaterThanOrEqual(0.75);
      expect(luminance(s.sky)).toBeGreaterThan(0.15);
    }
    expect(luminance(skyState(0.75).sky)).toBeLessThan(luminance(skyState(0.25).sky));
  });

  it('stars only at night', () => {
    expect(skyState(0.25).stars).toBe(0);
    expect(skyState(0.75).stars).toBe(1);
  });

  it('formats day lengths and defaults to 30s', () => {
    expect(DAY_LENGTHS[DEFAULT_DAY_INDEX]).toBe(30);
    expect(formatDayLength(30)).toBe('30 s day');
    expect(formatDayLength(120)).toBe('2 min day');
    expect(formatDayLength(Infinity)).toBe('Paused');
  });

  it('draws the sun and moon on a low arc across the south', () => {
    const noon = skyPathDir(0.25);
    expect(Math.asin(noon[1])).toBeCloseTo(SKY_ARC_PEAK); // never higher than the peak
    expect(noon[2]).toBeGreaterThan(0.9); // due south (+z)
    expect(skyPathDir(0.01)[0]).toBeGreaterThan(0.9); // rises east
    expect(skyPathDir(0.49)[0]).toBeLessThan(-0.9); // sets west
    // the moon takes the same path half a day later
    skyState(0.75).moonSkyDir.forEach((v, i) => expect(v).toBeCloseTo(skyPathDir(0.25)[i]));
    for (let p = 0; p < 1; p += 0.05) expect(Math.hypot(...skyPathDir(p))).toBeCloseTo(1);
  });

  it('the sun moves the same way round the sky the whole time (no reversing at rise/set)', () => {
    let prev = null;
    for (let p = -0.1; p <= 1.1; p += 0.002) {
      const [x, , z] = skyPathDir(p);
      const az = Math.atan2(z, x);
      if (prev !== null) {
        let d = az - prev;
        if (d < -Math.PI) d += 2 * Math.PI; // wrap-around
        expect(d).toBeGreaterThan(0);
      }
      prev = az;
    }
  });
});
