import { describe, it, expect } from 'vitest';
import { randomLook, parseLook } from '../src/voxel/models/looks.js';
import { CHARACTERS, STYLES, STYLE_KEYS, buildCharacterParts } from '../src/voxel/models/characters.js';

const STYLE_FOR = Object.fromEntries(Object.entries(STYLE_KEYS).map(([part, key]) => [key, STYLES[part]]));
const COLOR_KEYS = new Set([...Object.keys(CHARACTERS.boy), ...Object.keys(CHARACTERS.girl), 'hat']);

describe('character looks', () => {
  for (const id of ['boy', 'girl']) {
    it(`random ${id} looks: known colours and styles, and every one builds`, () => {
      for (let s = 0; s < 30; s++) {
        const look = randomLook(id, s);
        for (const [k, v] of Object.entries(look)) {
          if (STYLE_FOR[k]) expect(STYLE_FOR[k]).toContain(v);
          else {
            expect(COLOR_KEYS.has(k)).toBe(true);
            expect(v).toMatch(/^#[0-9a-f]{6}$/);
          }
        }
        const parts = buildCharacterParts(id, look);
        for (const p of ['head', 'torso', 'legL', 'legR', 'armL', 'armR']) expect(parts[p].size).toBeGreaterThan(50);
      }
      expect(randomLook(id, 1)).toEqual(randomLook(id, 1));
      expect(randomLook(id, 1)).not.toEqual(randomLook(id, 2));
    });
  }

  it('every style of every part builds on both characters, and looks different from the others', () => {
    for (const id of ['boy', 'girl'])
      for (const [part, key] of Object.entries(STYLE_KEYS)) {
        const sizes = STYLES[part].map((style) => {
          const parts = buildCharacterParts(id, { [key]: style });
          const target = { hair: 'head', top: 'torso', bottom: 'legL', shoes: 'legL', extra: 'head' }[part];
          return parts[target].size + (part === 'bottom' ? parts.torso.size : 0);
        });
        expect(new Set(sizes).size).toBeGreaterThan(STYLES[part].length - 2); // (nearly) all different
      }
  });

  it('the original looks are unchanged', () => {
    expect(buildCharacterParts('boy', null).head.size).toBe(buildCharacterParts('boy', { hairStyle: 'quiff', extra: 'none' }).head.size);
    expect(buildCharacterParts('girl', null).head.size).toBe(buildCharacterParts('girl', { hairStyle: 'long', extra: 'clip' }).head.size);
  });

  it('reads saved looks safely', () => {
    expect(parseLook('{"skin":"#aabbcc","bad":"red","x":3}')).toEqual({ skin: '#aabbcc' });
    expect(parseLook('{"hairStyle":"bun","topStyle":"cape","extra":"glasses"}')).toEqual({ hairStyle: 'bun', extra: 'glasses' });
    expect(parseLook('')).toBeNull();
    expect(parseLook('nope')).toBeNull();
  });
});
