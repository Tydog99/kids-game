import { describe, it, expect } from 'vitest';
import { Music } from '../src/audio/Music.js';
import { THEMES } from '../src/audio/score.js';

// plays the music on a pretend clock, without making any sound
function playFor(m, seconds) {
  m.ctx = { state: 'running', currentTime: 0 };
  m.play = () => {};
  m.barTime = 0;
  for (let t = 0; t <= seconds; t += 0.5) {
    m.ctx.currentTime = t;
    m.schedule();
  }
}

describe('music rotation', () => {
  it('moves on to the next song after a minute, and round the list', () => {
    const m = new Music();
    m.setTheme(THEMES[0].id);
    playFor(m, 50);
    expect(m.theme).toBe(THEMES[0]);
    playFor(m, 20);
    expect(m.theme).toBe(THEMES[1]);
    m.setTheme(THEMES[THEMES.length - 1].id);
    m.nextTheme();
    expect(m.theme).toBe(THEMES[0]);
  });

  it('stays on one song while the music picker is open', () => {
    const m = new Music();
    m.setTheme(THEMES[0].id);
    m.previewNight = false;
    playFor(m, 130);
    expect(m.theme).toBe(THEMES[0]);
  });
});
