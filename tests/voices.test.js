import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import LINES from '../src/audio/voiceLines.json';
import { ollieSays, newProgress, apply } from '../src/adventure/adventure.js';

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const recorded = new Set(Object.values(LINES).map((l) => norm(l.text)));

describe('voice lines', () => {
  it('every line has a recording and every recording has a line', () => {
    const files = readdirSync(new URL('../src/audio/voices', import.meta.url)).map((f) => f.replace('.mp3', ''));
    expect(files.sort()).toEqual(Object.keys(LINES).sort());
  });

  it("all of Grandpa Ollie's lines are recorded", () => {
    let p = newProgress();
    const said = [ollieSays(p)];
    for (const index of [0, 1, 2]) said.push(ollieSays((p = apply(p, { type: 'key', index }))));
    said.push(ollieSays((p = apply(p, { type: 'chestOpened' }))));
    said.push(ollieSays((p = apply(p, { type: 'landed' }))));
    said.push(ollieSays((p = apply(p, { type: 'accept', kind: 'ember' }))));
    for (const kind of ['ember', 'glimmer', 'frost']) p = apply(p, { type: 'befriended', kind, name: 'X' });
    said.push(ollieSays(p));
    for (const s of said) expect(recorded.has(norm(s)), s).toBe(true);
  });
});
