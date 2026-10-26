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

// ---- styles ----
// Each character can wear any of these (looks.js picks them at random); the defaults are how the
// boy and the girl first look.
export const STYLES = {
  hair: ['quiff', 'long', 'spiky', 'curly', 'ponytail', 'pigtails', 'bob', 'buzz', 'bun'],
  top: ['jacket', 'heartTee', 'stripes', 'hoodie', 'starTee'],
  bottom: ['jeans', 'shorts', 'skirt'],
  shoes: ['sneakers', 'boots', 'rainboots', 'sandals'],
  extra: ['none', 'clip', 'glasses', 'cap', 'beanie', 'bow', 'headband'],
};
export const STYLE_KEYS = { hair: 'hairStyle', top: 'topStyle', bottom: 'bottomStyle', shoes: 'shoeStyle', extra: 'extra' };
const DEFAULT_STYLE = {
  boy: { hair: 'quiff', top: 'jacket', bottom: 'jeans', shoes: 'sneakers', extra: 'none' },
  girl: { hair: 'long', top: 'heartTee', bottom: 'shorts', shoes: 'boots', extra: 'clip' },
};
// colors only some styles use (a cap's color…)
const EXTRA_COLORS = { hat: '#d64535', frame: '#3a3a3a' };

function styleOf(id, look) {
  const st = { ...(DEFAULT_STYLE[id] ?? DEFAULT_STYLE.boy) };
  for (const [part, key] of Object.entries(STYLE_KEYS)) if (STYLES[part].includes(look?.[key])) st[part] = look[key];
  return st;
}

// ---- body parts ----

// A shoe on one foot; returns the height the leg starts above it.
function shoe(g, c, style, cx) {
  if (style === 'sneakers') {
    // rounded, toe pushed forward, grey sole, laces on top
    roundedBox(g, [cx - 3, 0, -3, cx + 2, 4, 5], 1.6, (x, y, z) => (y === 0 ? c.soles : fabric(c.shoes, 0.03)(x, y, z)));
    for (let z = 1; z <= 4; z += 2) g.set(cx - 1, 5 - (z > 3 ? 1 : 0), z, c.laces).set(cx, 5 - (z > 3 ? 1 : 0), z, c.laces);
    return 5;
  }
  if (style === 'sandals') {
    // a flat sole, bare toes and two straps
    roundedBox(g, [cx - 3, 0, -3, cx + 2, 0, 5], 1, c.soles);
    roundedBox(g, [cx - 3, 1, -3, cx + 2, 2, 4], 1.4, graded(c.skin, 1, 2, 0.05));
    for (const z of [-1, 3]) for (let x = cx - 3; x <= cx + 2; x++) g.set(x, 2, z, c.shoes).set(x, 3, z, c.shoes);
    return 3;
  }
  // boots: a rounded toe, darker sole and a folded cuff; rain boots are taller and shiny
  const rain = style === 'rainboots';
  roundedBox(g, [cx - 3, 0, -3, cx + 2, 3, 5], 1.6, (x, y, z) => (y === 0 ? c.bootsDark : fabric(c.boots, rain ? 0.01 : 0.04)(x, y, z)));
  column(g, cx - 0.5, 0.5, 4, rain ? 10 : 8, 3.1, rain ? (x, y, z) => (x === cx - 2 && z === 3 ? shade(c.boots, 1.35) : c.boots) : fabric(c.boots, 0.04));
  column(g, cx - 0.5, 0.5, rain ? 11 : 8, rain ? 11 : 9, 3.4, c.bootCuff);
  return rain ? 12 : 10;
}

function legs(c, st) {
  const out = {};
  for (const [name, cx] of [['legL', -4], ['legR', 4]]) {
    const g = new VoxelGrid();
    const y0 = shoe(g, c, st.shoes, cx);
    if (st.bottom === 'jeans') {
      // jeans with a turned-up cuff
      column(g, cx - 0.5, 0.5, y0, 16, (y) => [y < y0 + 2 ? 3.4 : 3.0, y < y0 + 2 ? 3.4 : 3.0], (x, y, z) =>
        y < y0 + 2 ? c.pantsDark : (x + y) % 7 === 0 ? c.pantsDark : fabric(c.pants, 0.06)(x, y, z));
    } else if (st.bottom === 'shorts') {
      if (y0 <= 12) column(g, cx - 0.5, 0.5, y0, 12, 2.7, graded(c.skin, y0, 12, 0.06));
      // shorts, a little wider than the legs
      column(g, cx - 0.5, 0.5, 13, 16, 3.5, (x, y, z) => (y === 13 ? c.shortsDark : fabric(c.shorts, 0.05)(x, y, z)));
    } else {
      // under a skirt (the skirt itself is part of the torso)
      column(g, cx - 0.5, 0.5, y0, 16, 2.7, graded(c.skin, y0, 16, 0.06));
    }
    out[name] = g;
  }
  return out;
}

function torso(c, st) {
  const g = new VoxelGrid();
  const box = [-8, 16, -4, 7, 28, 3];
  const tee = st.top !== 'jacket' && st.top !== 'hoodie';
  if (st.top === 'jacket') {
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
  } else if (st.top === 'hoodie') {
    roundedBox(g, box, 2.5, (x, y, z) => (y <= 17 ? c.topDark : graded(c.top, 16, 28, 0.1)(x, y, z)));
    // the front pocket, the strings, and the hood down at the back of the neck
    roundedBox(g, [-5, 18, 4, 4, 22, 4], 0.5, c.topDark);
    for (const x of [-2, 1]) for (let y = 24; y <= 27; y++) g.set(x, y, 4, c.tee);
    roundedBox(g, [-7, 26, -7, 6, 31, -3], 2.5, (x, y, z) => (z >= -4 ? c.topDark : fabric(c.top, 0.04)(x, y, z)));
  } else {
    // a tee: plain, striped, or with a heart or a star on it
    const stripes = st.top === 'stripes';
    roundedBox(g, box, 2.5, (x, y, z) => {
      if (y <= 17) return st.top === 'heartTee' ? null : c.topDark;
      if (stripes && y % 3 === 0) return c.tee;
      return graded(c.top, 18, 28, 0.1)(x, y, z);
    });
    const art = st.top === 'heartTee' ? ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'] : st.top === 'starTee' ? ['..x..', '.xxx.', 'xxxxx', '.xxx.', 'x...x'] : null;
    art?.forEach((row, i) => [...row].forEach((ch, j) => ch === 'x' && g.set(j - 3, 25 - i, 4, c.heart)));
    // neckline
    for (let x = -3; x <= 2; x++) g.set(x, 28, 3, c.skin);
  }
  if (tee && st.top === 'heartTee') {
    // belt with a gold buckle
    roundedBox(g, [-8, 16, -4, 7, 17, 3], 2.5, c.belt);
    roundedBox(g, [-1, 16, 4, 0, 17, 4], 0.1, c.buckle);
  }
  if (st.bottom === 'skirt') {
    // a skirt that flares out, with pleats
    for (let y = 10; y <= 16; y++) {
      const flare = (16 - y) * 0.35;
      column(g, -0.5, -0.5, y, y, () => [8.2 + flare, 4.8 + flare], (x, yy, z) => (y === 10 || (x + 20) % 3 === 0 ? c.shortsDark : fabric(c.shorts, 0.05)(x, yy, z)));
    }
  }
  return g;
}

function arms(c, st) {
  const out = {};
  const long = st.top === 'jacket' || st.top === 'hoodie';
  const sleeve = st.top === 'jacket' ? c.jacket : c.top, sleeveDark = st.top === 'jacket' ? c.jacketDark : c.topDark;
  for (const [name, cx] of [['armL', -10.5], ['armR', 10.5]]) {
    const g = new VoxelGrid();
    // hand: rounded mitten shape
    roundedBox(g, [Math.round(cx - 2), 13, -2, Math.round(cx + 1), 17, 1], 1.5, graded(c.skin, 13, 17, 0.08));
    if (long) {
      column(g, cx, 0, 18, 19, 2.6, sleeveDark); // cuff
      column(g, cx, 0, 20, 27, 2.3, graded(sleeve, 20, 27));
    } else {
      column(g, cx, 0, 18, 19, st.top === 'heartTee' ? 2.4 : 2.0, st.top === 'heartTee' ? c.band : graded(c.skin, 18, 19, 0.06)); // wristband
      column(g, cx, 0, 20, 24, 2.0, graded(c.skin, 20, 24, 0.06));
      column(g, cx, 0, 25, 27, 2.5, (x, y, z) => (st.top === 'stripes' && y === 26 ? c.tee : fabric(c.top, 0.04)(x, y, z))); // short sleeve
    }
    roundedBox(g, [Math.round(cx - 2), 26, -2, Math.round(cx + 1), 28, 1], 1.5, sleeve); // shoulder cap
    out[name] = g;
  }
  return out;
}

const HEAD = [-8, 30, -7, 7, 45, 7];

function head(c, id, st) {
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
  hair(g, c, st.hair);
  extra(g, c, st.extra);
  return g;
}

const SHORT_FRINGE = new Set(['quiff', 'spiky', 'buzz', 'curly']);

function hair(g, c, style) {
  // strand color: vertical streaks of light/mid/dark
  const strand = (x, y, z) => {
    const n = hash(x, 0, z);
    return n < 0.25 ? c.hairDark : n > 0.8 ? c.hairLight : c.hair;
  };
  const inHead = (x, y, z) => inRoundedBox(x, y, z, HEAD, 3);
  const put = (x, y, z) => !inHead(x, y, z) && !g.has(x, y, z) && g.set(x, y, z, strand(x, y, z));

  if (style === 'buzz') {
    // a close crop: a thin layer on the crown and the back, no fringe
    roundedBox(g, [-9, 33, -8, 8, 46, 8], 4, (x, y, z) => (inHead(x, y, z) ? null : y >= 43 || (z <= -1 && y >= 35) || ((x <= -9 || x >= 8) && y >= 40 && z <= 2) ? (hash(x, y, z) < 0.5 ? c.hairDark : c.hair) : null));
    return;
  }
  if (style === 'curly') {
    // a big round cloud of curls
    const cloud = [-12, 32, -11, 11, 51, 9];
    roundedBox(g, cloud, 7, (x, y, z) => {
      if (inHead(x, y, z)) return null;
      if (z >= 6 && y < 43) return null; // keep the face clear
      if ((x <= -9 || x >= 8) && z >= 2 && y < 40) return null;
      if (y < 36 && z > -2) return null;
      if (!inRoundedBox(x, y, z, [cloud[0] + 1, cloud[1] + 1, cloud[2] + 1, cloud[3] - 1, cloud[4] - 1, cloud[5] - 1], 6) && hash(x, y, z) < 0.35) return null; // bumpy edge
      return strand(x, y, z);
    });
    return;
  }

  const shell = [-9, 30, -8, 8, 47, 8];
  const fringeBottom = (x) => (SHORT_FRINGE.has(style) ? 41 + Math.floor(hash(x, 1, 1) * 2) : 40 + Math.floor((x + 9) / 6) + Math.floor(hash(x, 2, 2) * 2));
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

  if (style === 'quiff') {
    // swept-up quiff at the front
    for (let i = 0; i < 6; i++) roundedBox(g, [-6 + i, 45 + (i >> 1), 2 + i, 2 + i, 48 + (i >> 1), 6 + i], 1.5, strand);
    roundedBox(g, [-7, 46, -6, 6, 48, 4], 2, strand);
    // a few spikes on the crown and back
    for (const [x, z] of [[-5, -3], [0, -5], [4, -2], [-2, 0]]) roundedBox(g, [x, 47, z, x + 2, 49, z + 2], 1, strand);
  } else if (style === 'spiky') {
    for (const [x, z, h] of [[-6, 2, 4], [-2, 4, 5], [2, 3, 5], [5, 1, 4], [-4, -2, 5], [0, -1, 6], [4, -4, 4], [-1, -5, 4]])
      for (let k = 0; k < h; k++) roundedBox(g, [x - (k < 2 ? 1 : 0), 46 + k, z - (k < 2 ? 1 : 0), x + 1, 46 + k, z + 1], 0.6, strand);
  } else if (style === 'long') {
    // long hair falling down the back, with a jagged edge
    for (let x = -9; x <= 8; x++) {
      const bottom = 20 + Math.floor(hash(x, 3, 3) * 3) + Math.abs(x + 0.5) * 0.3;
      for (let y = Math.floor(bottom); y <= 42; y++)
        for (let z = -9; z <= -6; z++) if (inRoundedBox(x, y, z, [-10, 18, -10, 9, 46, -5], 3)) put(x, y, z);
    }
    // side locks falling in front of the shoulders
    for (const sx of [-10, 9]) roundedBox(g, [sx, 26, -4, sx, 41, 3], 1, strand);
    for (const sx of [-11, 10]) roundedBox(g, [sx, 28, -3, sx, 38, 1], 1, strand);
  } else if (style === 'bob') {
    // straight to the chin all round
    roundedBox(g, [-10, 31, -9, 9, 44, 4], 2, (x, y, z) => (inHead(x, y, z) || g.has(x, y, z) ? null : z >= 3 && x > -9 && x < 8 ? null : strand(x, y, z)));
  } else if (style === 'ponytail') {
    // tied at the back with a scrunchie, the tail swinging down
    roundedBox(g, [-2, 39, -10, 1, 42, -8], 1, c.clip);
    for (let y = 26; y <= 40; y++) {
      const r = y > 36 ? 2.6 : 2 + (y - 26) * 0.05;
      column(g, -0.5, -10.5 - (40 - y) * 0.08, y, y, r, (x, yy, z) => (g.has(x, yy, z) ? null : strand(x, yy, z)));
    }
  } else if (style === 'pigtails') {
    for (const sx of [-12, 11]) {
      roundedBox(g, [sx - 1, 38, -3, sx + 1, 40, -1], 1, c.clip); // hair ties
      roundedBox(g, [sx - 2, 27, -4, sx + 2, 37, 0], 2, strand);
    }
  } else if (style === 'bun') {
    roundedBox(g, [-4, 46, -6, 3, 52, 1], 3, strand);
    roundedBox(g, [-4, 46, -6, 3, 46, 1], 1, c.clip);
  }
}

// The finishing touch: a hair clip, glasses, a cap or beanie, a bow or a headband.
function extra(g, c, style) {
  if (style === 'clip') roundedBox(g, [4, 44, 5, 7, 45, 7], 0.6, c.clip);
  else if (style === 'glasses') {
    for (const ex of [-6, 2])
      for (let x = ex - 1; x <= ex + 4; x++) for (let y = 34; y <= 39; y++) if (x === ex - 1 || x === ex + 4 || y === 34 || y === 39) g.set(x, y, 8, c.frame);
    for (let x = -2; x <= 1; x++) g.set(x, 37, 8, c.frame);
    for (const x of [-9, 8]) for (let z = 1; z <= 7; z++) g.set(x, 38, z, c.frame);
  } else if (style === 'cap') {
    // a cap over the crown, with a brim out front and a button on top
    for (let y = 42; y <= 49; y++)
      for (let z = -10; z <= 9; z++)
        for (let x = -11; x <= 10; x++) {
          const r = Math.hypot(x + 0.5, (z + 0.5) * 1.05, Math.max(0, y - 42) * 1.25);
          if (r <= 10.2 && r >= 8.4) g.set(x, y, z, y === 42 ? shade(c.hat, 0.8) : fabric(c.hat, 0.04)(x, y, z));
          else if (r < 8.4 && g.has(x, y, z) && y > 42) g.remove(x, y, z);
        }
    for (let z = 8; z <= 13; z++) for (let x = -7; x <= 6; x++) g.set(x, 42, z, shade(c.hat, 0.8));
    g.set(-1, 50, 0, c.hat).set(0, 50, 0, c.hat);
  } else if (style === 'beanie') {
    for (let y = 40; y <= 50; y++)
      for (let z = -10; z <= 9; z++)
        for (let x = -11; x <= 10; x++) {
          const r = Math.hypot(x + 0.5, z + 0.5, Math.max(0, y - 40) * 1.05);
          if (r <= 10.3 && r >= 8.6) g.set(x, y, z, y <= 42 ? ((x + z) % 2 ? shade(c.hat, 0.85) : c.hat) : fabric(c.hat, 0.05)(x, y, z));
          else if (r < 8.6 && g.has(x, y, z) && y > 40 && !inRoundedBox(x, y, z, HEAD, 3)) g.remove(x, y, z);
        }
    roundedBox(g, [-2, 50, -2, 1, 53, 1], 1.8, '#ffffff'); // pompom
  } else if (style === 'bow') {
    for (const [x0, x1] of [[1, 4], [6, 9]]) roundedBox(g, [x0, 44, -1, x1, 48, 2], 1.4, c.clip);
    roundedBox(g, [4, 45, -1, 6, 47, 2], 0.6, shade(c.clip, 0.8));
  } else if (style === 'headband') {
    for (let x = -10; x <= 9; x++)
      for (let y = 38; y <= 50; y++)
        for (let z = 2; z <= 4; z++) {
          const r = Math.hypot(x + 0.5, (y - 38) * 0.95);
          if (r >= 9.3 && r <= 10.6) g.set(x, y, z, c.clip);
        }
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
  const st = DEFAULT_STYLE.boy;
  const parts = { ...legs(GRANDPA, st), torso: torso(GRANDPA, st), ...arms(GRANDPA, st), head: head(GRANDPA, 'boy', st) };
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

// look: optional colors and styles (see looks.js). Every colour either character might need is
// filled in from the defaults, so any outfit works on either.
export function buildCharacterParts(id, look = null) {
  if (id === 'grandpa') return grandpaParts();
  const c = { ...EXTRA_COLORS, ...CHARACTERS.boy, ...CHARACTERS.girl, ...CHARACTERS[id], ...(look ?? {}) };
  const st = styleOf(id, look);
  return { ...legs(c, st), torso: torso(c, st), ...arms(c, st), head: head(c, id, st) };
}
