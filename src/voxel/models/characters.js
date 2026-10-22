// Characters are made of separate body parts so they can swing when walking.
// Voxel = 1/16 unit. Front faces +z. Each part's origin is its pivot point.
import { VoxelGrid } from '../VoxelGrid.js';

const SKIN = '#f1c27d';

export const CHARACTERS = {
  boy: {
    label: 'Boy',
    hair: '#6b4423', hairDark: '#563619', hairStyle: 'short',
    shirt: '#3b6fd6', shirtDark: '#2f5bb3', pants: '#2b3f73', shoes: '#f4f4f4', cap: '#d64535',
  },
  girl: {
    label: 'Girl',
    hair: '#4a3b35', hairDark: '#3a2d28', hairStyle: 'long',
    shirt: '#f07fb0', shirtDark: '#d9649a', pants: '#b59a72', shoes: '#7a4a2a', bow: '#ffffff',
  },
};

// Pivots in voxel coords (body is x 0..7, z 0..3, feet at y=0)
export const PIVOTS = {
  legL: [1.5, 6, 2], legR: [5.5, 6, 2],
  armL: [-1, 11, 2], armR: [9, 11, 2],
  torso: [4, 6, 2], head: [4, 12, 2],
};

export function buildCharacterParts(id) {
  const c = CHARACTERS[id];
  const parts = {};

  const legL = new VoxelGrid(), legR = new VoxelGrid();
  for (const [g, x0] of [[legL, 0], [legR, 4]]) {
    g.box(x0, 0, 0, x0 + 3, 1, 3, c.shoes);
    g.box(x0, 2, 0, x0 + 3, 5, 3, c.pants);
    if (id === 'girl') g.box(x0, 2, 0, x0 + 3, 3, 3, c.shoes); // tall boots
  }
  parts.legL = legL;
  parts.legR = legR;

  const torso = new VoxelGrid();
  torso.box(0, 6, 0, 7, 11, 3, (x, y) => (y === 6 ? c.pants : c.shirt));
  if (id === 'boy') torso.box(3, 8, 4, 4, 10, 4, c.shirtDark); // zipper stripe
  if (id === 'girl') {
    torso.box(0, 6, 0, 7, 6, 3, '#7a4a2a'); // belt
    torso.set(4, 6, 4, '#e8c547');
    torso.box(0, 7, 0, 7, 7, 3, SKIN); // a bit of midriff
  }
  parts.torso = torso;

  const armL = new VoxelGrid(), armR = new VoxelGrid();
  for (const [g, x0] of [[armL, -2], [armR, 8]]) {
    g.box(x0, 7, 1, x0 + 1, 7, 2, SKIN);
    g.box(x0, 8, 1, x0 + 1, 11, 2, (x, y) => (y >= 10 ? c.shirt : id === 'girl' ? SKIN : c.shirtDark));
  }
  parts.armL = armL;
  parts.armR = armR;

  const head = new VoxelGrid();
  head.box(0, 12, -1, 7, 18, 4, SKIN);
  // eyes
  for (const x of [1, 5]) {
    head.box(x, 14, 5, x + 1, 15, 5, '#2a2a2a');
    head.set(x, 15, 5, '#ffffff');
  }
  head.box(3, 13, 5, 4, 13, 5, '#d98a6a'); // smile
  head.set(0, 13, 5, '#f5a3a3').set(7, 13, 5, '#f5a3a3'); // rosy cheeks
  // hair: top, back and sides
  head.box(-1, 18, -2, 8, 19, 5, (x, y, z) => ((x + z) % 3 ? c.hair : c.hairDark));
  head.box(-1, 14, -2, 8, 17, -2, c.hair);
  head.box(-1, 15, -1, -1, 17, 4, c.hair);
  head.box(8, 15, -1, 8, 17, 4, c.hair);
  head.box(0, 17, 5, 7, 17, 5, (x) => (x % 3 === 0 ? null : c.hair)); // fringe
  if (c.hairStyle === 'short') {
    // red cap with a brim, like a young trainer
    head.box(-1, 19, -2, 8, 20, 5, c.cap);
    head.box(0, 18, 6, 7, 18, 8, c.cap);
    head.box(2, 19, 5, 5, 20, 5, '#ffffff');
  } else {
    // long flowing hair down the back and sides, plus a bow
    // stops at the shoulders so the arms stay visible from behind
    head.box(0, 9, -3, 7, 17, -3, (x, y) => (y === 9 && (x === 0 || x === 7) ? null : (x + y) % 4 ? c.hair : c.hairDark));
    head.box(-1, 12, -2, -1, 16, 1, c.hair);
    head.box(8, 12, -2, 8, 16, 1, c.hair);
    head.box(6, 19, 2, 9, 20, 3, c.bow);
    head.set(7, 21, 2, c.bow).set(8, 21, 2, c.bow);
  }
  parts.head = head;
  return parts;
}
