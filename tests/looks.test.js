import { describe, it, expect } from 'vitest';
import { randomLook, parseLook } from '../src/voxel/models/looks.js';
import { CHARACTERS, buildCharacterParts } from '../src/voxel/models/characters.js';

describe('character looks', () => {
  for (const id of ['boy', 'girl']) {
    it(`a random ${id} look only changes colors the ${id} uses`, () => {
      for (let s = 0; s < 20; s++) {
        const look = randomLook(id, s);
        for (const [k, v] of Object.entries(look)) {
          expect(CHARACTERS[id]).toHaveProperty(k);
          expect(v).toMatch(/^#[0-9a-f]{6}$/);
        }
        const parts = buildCharacterParts(id, look);
        expect(parts.head.size).toBeGreaterThan(100);
      }
      expect(randomLook(id, 1)).toEqual(randomLook(id, 1));
      expect(randomLook(id, 1)).not.toEqual(randomLook(id, 2));
    });
  }

  it('reads saved looks safely', () => {
    expect(parseLook('{"skin":"#aabbcc","bad":"red","x":3}')).toEqual({ skin: '#aabbcc' });
    expect(parseLook('')).toBeNull();
    expect(parseLook('nope')).toBeNull();
  });
});
