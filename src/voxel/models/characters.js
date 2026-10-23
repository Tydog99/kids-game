// High-detail voxel characters, built from rounded shapes so limbs and heads
// read as solid 3D forms. Voxel = 1/40 unit, so a character is ~1.2 units tall.
// x is centered on 0 (a voxel at x spans x..x+1), y=0 is the soles, front faces +z.
// Body parts are separate grids so they can swing when walking.
import { VoxelGrid, parseColor } from '../VoxelGrid.js';

export const VOXEL_SIZE = 1 / 40;

export const CHARACTERS = {
  boy: {
    label: 'Boy',
    skin: '#f0c08a',
    hair: '#8a5a33', hairDark: '#6b4224', hairLight: '#a8713f',
    eyes: '#4a3424',
    jacket: '#efe6d4', jacketDark: '#d8ccb4', lining: '#9b6b45',
    tee: '#ffffff',
    pants: '#7fa6d6', pantsDark: '#6890c2',
    shoes: '#fafafa', soles: '#c9c9c9', laces: '#9fb7d6',
  },
  girl: {
    label: 'Girl',
    skin: '#f3c6a0',
    hair: '#4a3d39', hairDark: '#382d2a', hairLight: '#5e4e49',
    eyes: '#7a4326',
    top: '#f07fae', topDark: '#d9689a', heart: '#ffffff',
    shorts: '#b7a98a', shortsDark: '#a09276',
    belt: '#7a4f33', buckle: '#d9b44a',
    boots: '#8a5236', bootsDark: '#6f3f28', bootCuff: '#a8694a',
    band: '#8a5236', clip: '#ffd34d',
  },
};

// Pivot points (voxel coords) each part rotates around.
export const PIVOTS = {
  legL: [-4, 16, 0], legR: [4, 16, 0],
  torso: [0, 16, 0],
  armL: [-10, 27, 0], armR: [10, 27, 0],
  head: [0, 29, 0],
};

// ---- small color + shape helpers ----

function hash(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function shade(hex, k) {
  const c = parseColor(hex);
  const r = Math.min(255, ((c >> 16) & 255) * k), g = Math.min(255, ((c >> 8) & 255) * k), b = Math.min(255, (c & 255) * k);
  return (r << 16) | (g << 8) | b;
}

// Rounded box over voxel ranges [x0..x1] etc (inclusive), corner radius r.
function inRoundedBox(x, y, z, [x0, y0, z0, x1, y1, z1], r) {
  const cx = x + 0.5, cy = y + 0.5, cz = z + 0.5;
  const dx = Math.max(x0 + r - cx, 0, cx - (x1 + 1 - r));
  const dy = Math.max(y0 + r - cy, 0, cy - (y1 + 1 - r));
  const dz = Math.max(z0 + r - cz, 0, cz - (z1 + 1 - r));
  return dx * dx + dy * dy + dz * dz <= r * r;
}

function roundedBox(g, box, r, color) {
  const [x0, y0, z0, x1, y1, z1] = box;
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++)
        if (inRoundedBox(x, y, z, box, r)) {
          const c = typeof color === 'function' ? color(x, y, z) : color;
          if (c != null) g.set(x, y, z, c);
        }
}

// Vertical elliptical column centered on (cx, cz), radius may vary with y.
function column(g, cx, cz, y0, y1, radius, color) {
  for (let y = y0; y <= y1; y++) {
    const [rx, rz] = typeof radius === 'function' ? radius(y) : [radius, radius];
    for (let z = Math.floor(cz - rz - 1); z <= Math.ceil(cz + rz); z++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dz = (z + 0.5 - cz) / rz;
        if (dx * dx + dz * dz <= 1) {
          const c = typeof color === 'function' ? color(x, y, z) : color;
          if (c != null) g.set(x, y, z, c);
        }
      }
  }
}

// Subtle cloth/skin variation so big surfaces aren't flat.
const fabric = (hex, amt = 0.05) => (x, y, z) => shade(hex, 1 - amt + hash(x, y, z) * amt * 2);
// Darken toward the bottom of a part, like soft ambient occlusion.
const graded = (hex, y0, y1, amt = 0.12) => (x, y, z) =>
  shade(hex, 1 - amt * (1 - (y - y0) / Math.max(1, y1 - y0)) + (hash(x, y, z) - 0.5) * 0.05);

// ---- body parts ----

function legs(c, id) {
  const out = {};
  for (const [name, cx] of [['legL', -4], ['legR', 4]]) {
    const g = new VoxelGrid();
    if (id === 'boy') {
      // sneakers: rounded, toe pushed forward, grey sole, laces on top
      roundedBox(g, [cx - 3, 0, -3, cx + 2, 4, 5], 1.6, (x, y, z) => (y === 0 ? c.soles : fabric(c.shoes, 0.03)(x, y, z)));
      for (let z = 1; z <= 4; z += 2) g.set(cx - 1, 5 - (z > 3 ? 1 : 0), z, c.laces).set(cx, 5 - (z > 3 ? 1 : 0), z, c.laces);
      // jeans with a turned-up cuff
      column(g, cx - 0.5, 0.5, 5, 16, (y) => [y < 7 ? 3.4 : 3.0, y < 7 ? 3.4 : 3.0], (x, y, z) =>
        y < 7 ? c.pantsDark : (x + y) % 7 === 0 ? c.pantsDark : fabric(c.pants, 0.06)(x, y, z));
    } else {
      // boots with a rounded toe, darker sole and a folded cuff
      roundedBox(g, [cx - 3, 0, -3, cx + 2, 3, 5], 1.6, (x, y, z) => (y === 0 ? c.bootsDark : fabric(c.boots, 0.04)(x, y, z)));
      column(g, cx - 0.5, 0.5, 4, 8, 3.1, fabric(c.boots, 0.04));
      column(g, cx - 0.5, 0.5, 8, 9, 3.4, c.bootCuff);
      column(g, cx - 0.5, 0.5, 10, 12, 2.7, graded(c.skin, 10, 12, 0.06));
      // shorts, a little wider than the legs
      column(g, cx - 0.5, 0.5, 13, 16, 3.5, (x, y, z) => (y === 13 ? c.shortsDark : fabric(c.shorts, 0.05)(x, y, z)));
    }
    out[name] = g;
  }
  return out;
}

function torso(c, id) {
  const g = new VoxelGrid();
  const box = [-8, 16, -4, 7, 28, 3];
  if (id === 'boy') {
    // open jacket over a white tee
    roundedBox(g, box, 2.5, (x, y, z) => {
      const front = z >= 2;
      if (front && x >= -2 && x <= 1 && y >= 17) return fabric(c.tee, 0.02)(x, y, z);
      if (front && (x === -3 || x === 2) && y >= 17) return c.jacketDark; // lapel edge
      if (y <= 17) return c.jacketDark; // hem
      return graded(c.jacket, 16, 28, 0.1)(x, y, z);
    });
    // pockets
    for (const px of [-7, 4]) roundedBox(g, [px, 18, 4, px + 2, 20, 4], 0.5, c.jacketDark);
    // big soft collar around the neck
    roundedBox(g, [-7, 27, -5, 6, 29, 4], 2, (x, y, z) => (z >= 3 && x >= -2 && x <= 1 ? null : y === 29 ? c.jacket : c.jacketDark));
    roundedBox(g, [-2, 27, 2, 1, 28, 3], 0.5, c.lining);
  } else {
    roundedBox(g, box, 2.5, (x, y, z) => (y <= 17 ? null : graded(c.top, 18, 28, 0.1)(x, y, z)));
    // belt with a gold buckle
    roundedBox(g, [-8, 16, -4, 7, 17, 3], 2.5, c.belt);
    roundedBox(g, [-1, 16, 4, 0, 17, 4], 0.1, c.buckle);
    // heart on the shirt
    const heart = ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'];
    heart.forEach((row, i) => [...row].forEach((ch, j) => ch === 'x' && g.set(j - 3, 25 - i, 4, c.heart)));
    // neckline
    for (let x = -3; x <= 2; x++) g.set(x, 28, 3, c.skin);
  }
  return g;
}

function arms(c, id) {
  const out = {};
  for (const [name, cx] of [['armL', -10.5], ['armR', 10.5]]) {
    const g = new VoxelGrid();
    // hand: rounded mitten shape
    roundedBox(g, [Math.round(cx - 2), 13, -2, Math.round(cx + 1), 17, 1], 1.5, graded(c.skin, 13, 17, 0.08));
    if (id === 'boy') {
      column(g, cx, 0, 18, 19, 2.6, c.jacketDark); // cuff
      column(g, cx, 0, 20, 27, 2.3, graded(c.jacket, 20, 27));
    } else {
      column(g, cx, 0, 18, 19, 2.4, c.band); // wristband
      column(g, cx, 0, 20, 24, 2.0, graded(c.skin, 20, 24, 0.06));
      column(g, cx, 0, 25, 27, 2.5, fabric(c.top, 0.04)); // short sleeve
    }
    roundedBox(g, [Math.round(cx - 2), 26, -2, Math.round(cx + 1), 28, 1], 1.5, id === 'boy' ? c.jacket : c.top); // shoulder cap
    out[name] = g;
  }
  return out;
}

const HEAD = [-8, 30, -7, 7, 45, 7];

function head(c, id) {
  const g = new VoxelGrid();
  column(g, -0.5, 0, 29, 30, 2.6, shade(c.skin, 0.85)); // neck
  roundedBox(g, HEAD, 3, (x, y, z) => fabric(c.skin, 0.02)(x, y, z));
  const face = (x, y, color) => g.set(x, y, 7, color);

  // eyes: lash line, big iris with a pupil and a white highlight
  const eye = ['LLLL', 'IIhI', 'IPPI', 'wIIw'];
  for (const ex of [-6, 2]) {
    eye.forEach((row, i) =>
      [...row].forEach((ch, j) => {
        const col = { L: '#2b2220', I: c.eyes, P: '#1e1512', h: '#ffffff', w: '#f4f4f4' }[ch];
        face(ex + j, 38 - i, col);
      }),
    );
    // eyebrows
    for (let j = 0; j < 4; j++) face(ex + j, 40, c.hairDark);
    if (id === 'girl') {
      face(ex + (ex < 0 ? -1 : 4), 38, '#2b2220'); // outer lash flick
      face(ex + (ex < 0 ? 0 : 3), 40, shade(c.skin, 1));
    }
  }
  // nose sticks out one voxel
  g.set(-1, 33, 8, shade(c.skin, 0.92)).set(0, 33, 8, shade(c.skin, 0.92));
  // smile
  for (let x = -2; x <= 1; x++) face(x, 31, '#c25b55');
  face(-3, 32, '#c25b55');
  face(2, 32, '#c25b55');
  // rosy cheeks
  for (const x of [-7, -6, 5, 6]) face(x, 33, shade('#f29a8f', 1));
  // ears
  for (const x of [-9, 8]) roundedBox(g, [x, 34, -1, x, 37, 1], 0.6, shade(c.skin, 0.95));
  hair(g, c, id);
  return g;
}

function hair(g, c, id) {
  // strand color: vertical streaks of light/mid/dark
  const strand = (x, y, z) => {
    const n = hash(x, 0, z);
    return n < 0.25 ? c.hairDark : n > 0.8 ? c.hairLight : c.hair;
  };
  const shell = [-9, 30, -8, 8, 47, 8];
  const inHead = (x, y, z) => inRoundedBox(x, y, z, HEAD, 3);
  const fringeBottom = (x) => (id === 'boy' ? 41 + Math.floor(hash(x, 1, 1) * 2) : 40 + Math.floor((x + 9) / 6) + Math.floor(hash(x, 2, 2) * 2));

  roundedBox(g, shell, 4, (x, y, z) => {
    if (inHead(x, y, z)) return null;
    const back = z <= -1, side = x <= -9 || x >= 8;
    if (y >= 42) return strand(x, y, z); // crown
    if (z >= 6) return y >= fringeBottom(x) ? strand(x, y, z) : null; // fringe over the forehead
    if (back && y >= 32) return strand(x, y, z);
    if (side && y >= 38) return strand(x, y, z); // above the ears
    if (side && z >= 1 && z <= 3 && y >= 35) return strand(x, y, z); // sideburns
    return null;
  });

  if (id === 'boy') {
    // swept-up quiff at the front
    for (let i = 0; i < 6; i++) {
      roundedBox(g, [-6 + i, 45 + (i >> 1), 2 + i, 2 + i, 48 + (i >> 1), 6 + i], 1.5, strand);
    }
    roundedBox(g, [-7, 46, -6, 6, 48, 4], 2, strand);
    // a few spikes on the crown and back
    for (const [x, z] of [[-5, -3], [0, -5], [4, -2], [-2, 0]]) roundedBox(g, [x, 47, z, x + 2, 49, z + 2], 1, strand);
  } else {
    // long hair falling down the back, with a jagged edge
    for (let x = -9; x <= 8; x++) {
      const bottom = 20 + Math.floor(hash(x, 3, 3) * 3) + Math.abs(x + 0.5) * 0.3;
      for (let y = Math.floor(bottom); y <= 42; y++)
        for (let z = -9; z <= -6; z++) {
          if (inRoundedBox(x, y, z, [-10, 18, -10, 9, 46, -5], 3) && !g.has(x, y, z)) g.set(x, y, z, strand(x, y, z));
        }
    }
    // side locks falling in front of the shoulders
    for (const sx of [-10, 9]) roundedBox(g, [sx, 26, -4, sx, 41, 3], 1, strand);
    for (const sx of [-11, 10]) roundedBox(g, [sx, 28, -3, sx, 38, 1], 1, strand);
    // hair clip
    roundedBox(g, [4, 44, 5, 7, 45, 7], 0.6, c.clip);
  }
}

// Grandpa Ollie, the villager: built like the boy, with his own colors, plus a flat cap,
// round glasses and a big white beard.
const GRANDPA = {
  label: 'Grandpa Ollie',
  skin: '#e8b98a',
  hair: '#e9e9e9', hairDark: '#cfcfcf', hairLight: '#ffffff',
  eyes: '#4a3424',
  jacket: '#5f8f4e', jacketDark: '#4b7a3c', lining: '#8a5a32',
  tee: '#f4e9d4',
  pants: '#7a5a3a', pantsDark: '#664a2e',
  shoes: '#5a3a22', soles: '#3a2a1a', laces: '#6b4a2e',
};

function grandpaParts() {
  const parts = { ...legs(GRANDPA, 'boy'), torso: torso(GRANDPA, 'boy'), ...arms(GRANDPA, 'boy'), head: head(GRANDPA, 'boy') };
  const h = parts.head;
  // flat cap with a brim, over the hair
  for (let y = 44; y <= 48; y++)
    for (let z = -9; z <= 8; z++)
      for (let x = -10; x <= 9; x++) {
        const r = Math.hypot(x + 0.5, z * 1.05);
        if (r <= 9.6 - (y - 44) * 0.9) h.set(x, y, z, y === 44 ? '#6f5530' : '#8a6a3a');
      }
  for (let z = 7; z <= 11; z++) for (let x = -7; x <= 6; x++) h.set(x, 44, z, '#6f5530');
  // beard and moustache
  for (let y = 26; y <= 33; y++)
    for (let x = -7; x <= 6; x++) {
      const w = y <= 28 ? 4 - (28 - y) : 7;
      if (Math.abs(x + 0.5) > w) continue;
      for (let z = y >= 31 ? 7 : 5; z <= 8; z++) h.set(x, y, z, (x + y) % 4 ? GRANDPA.hair : GRANDPA.hairDark);
    }
  for (const x of [-4, -3, 2, 3]) h.set(x, 33, 8, GRANDPA.hairLight);
  // round glasses
  for (const ex of [-6, 2]) {
    for (let x = ex - 1; x <= ex + 4; x++)
      for (let y = 34; y <= 39; y++) {
        const edge = x === ex - 1 || x === ex + 4 || y === 34 || y === 39;
        if (edge) h.set(x, y, 8, '#3a3a3a');
      }
  }
  for (let x = -2; x <= 1; x++) h.set(x, 37, 8, '#3a3a3a');
  return parts;
}

export function buildCharacterParts(id) {
  if (id === 'grandpa') return grandpaParts();
  const c = CHARACTERS[id];
  return { ...legs(c, id), torso: torso(c, id), ...arms(c, id), head: head(c, id) };
}
