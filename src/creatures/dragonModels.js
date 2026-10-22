// Three dragon designs, sculpted from rounded voxel shapes. One builder, three specs.
// Voxel = 1/16 unit. Every part is built in its own local space around its pivot, facing +z,
// so the rig (Dragon.js) can bend it. Right-side limbs only; the left side is a mirror.
import { VoxelGrid } from '../voxel/VoxelGrid.js';
import { ellipsoid, capsule, hash, shade, topAt, sideAt, frontAt } from '../voxel/shapes.js';

export const DRAGON_VOXEL = 1 / 16;

export const DRAGONS = {
  ember: {
    name: 'Ember',
    tagline: 'The classic fire dragon',
    blurb: 'Sturdy and brave. Big bat wings, curled horns, a spiky back and a spade-tipped tail.',
    colors: {
      body: '#d8432f', dark: '#a52e22', belly: '#f5cf86', wing: '#f0853a', wingDark: '#c95f22',
      horn: '#f7ecd2', eye: '#ffcc2e', spike: '#7a1f17', accent: '#ffb347',
    },
    backLeg: { len: 13, thigh: [4.2, 5, 5], shin: 2.7 },
    frontLeg: { thigh: [3.6, 4.5, 4], shin: 2.4 },
    hipX: 6,
    torso: { center: [0, 3, 9], radii: [8, 7, 13] },
    shoulder: [6.5, 0, 17],
    neck: { base: [0, 6, 19], segments: 2, len: 5, r0: 4.6, r1: 3.4 },
    head: { skull: [4.6, 4.2, 5], snoutLen: 8, snoutW: 3.2, eye: 'fierce', horns: 'curved', teeth: true },
    tail: { base: [0, 3, -3], segments: 5, len: 6, r0: 5, r1: 1.2, tip: 'spade' },
    wing: { pivot: [5, 8, 14], spanA: 17, spanB: 25, depth: 19, style: 'bat' },
    spikes: 'ridge',
  },
  glimmer: {
    name: 'Glimmer',
    tagline: 'The cute baby dragon',
    blurb: 'Small and round with a big head, huge sparkly eyes, rosy cheeks and a heart on its tail.',
    colors: {
      body: '#5fd3b0', dark: '#3fae8d', belly: '#ffd9e4', wing: '#b59cff', wingDark: '#8f72f0',
      horn: '#ffe9a8', eye: '#3a7bd5', spike: '#ffb3c7', accent: '#ff8fb1',
    },
    backLeg: { len: 7, thigh: [3.3, 3.5, 3.6], shin: 2.3 },
    frontLeg: { thigh: [2.8, 3, 3], shin: 2 },
    hipX: 4,
    torso: { center: [0, 3, 5], radii: [6.5, 6, 8] },
    shoulder: [4.6, 0, 9],
    neck: { base: [0, 5, 11], segments: 1, len: 3, r0: 3.8, r1: 3.4 },
    head: { skull: [6.2, 5.6, 6], snoutLen: 4, snoutW: 3.6, eye: 'cute', horns: 'nubs', blush: true },
    tail: { base: [0, 3, -2], segments: 3, len: 5, r0: 3.6, r1: 1.3, tip: 'heart' },
    wing: { pivot: [4, 7, 8], spanA: 7, spanB: 9, depth: 9, style: 'round' },
    spikes: 'bumps',
  },
  frost: {
    name: 'Frost',
    tagline: 'The sleek ice dragon',
    blurb: 'Long and graceful. Crystal horns and back shards, wide fin wings and a whip tail with an icy tip.',
    colors: {
      body: '#7cc6ee', dark: '#4a8fc2', belly: '#eef8ff', wing: '#c3e9ff', wingDark: '#6fb3e0',
      horn: '#d9fbff', eye: '#7af0ff', spike: '#b8f4ff', accent: '#ffffff',
    },
    backLeg: { len: 16, thigh: [3.4, 5, 4.4], shin: 2.1 },
    frontLeg: { thigh: [3, 4.4, 3.6], shin: 1.9 },
    hipX: 5,
    torso: { center: [0, 3, 11], radii: [6, 5.5, 15] },
    shoulder: [5.5, -1, 21],
    neck: { base: [0, 5, 24], segments: 4, len: 5, r0: 3.6, r1: 2.4 },
    head: { skull: [3.6, 3.2, 4.6], snoutLen: 9, snoutW: 2.4, eye: 'sharp', horns: 'crystal', frills: true },
    tail: { base: [0, 3, -3], segments: 7, len: 6, r0: 4, r1: 0.8, tip: 'crystal' },
    wing: { pivot: [4.5, 7, 19], spanA: 20, spanB: 29, depth: 21, style: 'fin' },
    spikes: 'crystal',
  },
};

// ---------- texture helpers ----------

// Body skin with a scattering of darker scales, a lighter belly and plates underneath.
const skin = (c) => (x, y, z, n) => {
  if (n[1] < -0.45) return z % 3 === 0 ? shade(c.belly, 0.9) : c.belly;
  if (hash(x, y, z) < 0.16) return c.dark;
  return n[1] > 0.55 ? shade(c.body, 0.94) : c.body;
};

// Tube skin: belly color on the underside.
const tubeSkin = (c, belly = true) => (x, y, z) =>
  belly && y < -1.5 ? c.belly : hash(x, y, z) < 0.15 ? c.dark : c.body;

function spikeRow(g, spec, zFrom, zTo, step, heightAt) {
  const c = spec.colors;
  for (let z = Math.round(zFrom); z <= zTo; z += step) {
    const top = topAt(g, 0, z);
    if (top == null) continue;
    const h = Math.max(1, Math.round(heightAt(z)));
    if (spec.spikes === 'ridge') {
      // a fin-like spike leaning back
      for (let k = 0; k < h; k++) for (let dz = 0; dz < h - k; dz++) g.set(0, top + 1 + k, z - dz, k === h - 1 ? shade(c.spike, 1.3) : c.spike);
    } else if (spec.spikes === 'crystal') {
      for (let k = 0; k < h + 1; k++) g.set(0, top + 1 + k, z - (k >> 1), k >= h - 1 ? c.accent : c.spike);
      if (h > 2) g.set(1, top + 1, z, c.spike).set(-1, top + 1, z, c.spike);
    } else if (spec.spikes === 'bumps') {
      g.set(0, top + 1, z, c.spike);
    }
  }
}

// ---------- parts ----------

function torso(spec) {
  const g = new VoxelGrid();
  const { center, radii } = spec.torso;
  ellipsoid(g, center, radii, skin(spec.colors));
  const [, , cz] = center, rz = radii[2];
  spikeRow(g, spec, cz - rz * 0.75, cz + rz * 0.8, spec.spikes === 'bumps' ? 3 : 3, (z) => {
    const t = 1 - Math.abs((z - cz) / rz);
    return spec.spikes === 'bumps' ? 1 : 1.5 + t * 2.5;
  });
  return g;
}

function neckSegment(spec, i) {
  const { segments, len, r0, r1 } = spec.neck;
  const a = r0 + ((r1 - r0) * i) / segments, b = r0 + ((r1 - r0) * (i + 1)) / segments;
  const g = new VoxelGrid();
  capsule(g, [0, 0, 0], [0, 0, len], a, b, tubeSkin(spec.colors));
  spikeRow(g, spec, 0, len, 3, () => (spec.spikes === 'bumps' ? 1 : 2));
  return g;
}

function tailSegment(spec, i) {
  const { segments, len, r0, r1, tip } = spec.tail;
  const a = r0 + ((r1 - r0) * i) / segments, b = r0 + ((r1 - r0) * (i + 1)) / segments;
  const c = spec.colors;
  const g = new VoxelGrid();
  capsule(g, [0, 0, 0], [0, 0, -len], a, b, tubeSkin(c, a > 2));
  spikeRow(g, spec, -len, 0, 3, () => Math.max(1, a * 0.45));
  if (i === segments - 1) {
    const z0 = -len - 1;
    if (tip === 'spade') {
      // flat arrowhead
      for (let dz = 0; dz <= 7; dz++) {
        const w = dz < 4 ? dz : 7 - dz;
        for (let x = -w; x <= w; x++) g.set(x, 0, z0 - dz, Math.abs(x) === w ? c.spike : c.dark);
      }
    } else if (tip === 'heart') {
      const heart = ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'];
      heart.forEach((row, r) => [...row].forEach((ch, x) => ch === 'x' && g.set(x - 3, 0, z0 - 5 + r, c.accent)));
      heart.forEach((row, r) => [...row].forEach((ch, x) => ch === 'x' && g.set(x - 3, 1, z0 - 5 + r, r < 2 && (x === 1 || x === 5) ? '#ffffff' : c.accent)));
    } else if (tip === 'crystal') {
      for (const [dx, dy, l] of [[0, 0, 6], [1, 1, 4], [-1, 1, 4], [0, -1, 3]]) capsule(g, [dx, dy, z0], [dx * 2, dy * 2, z0 - l], 1.1, 0.4, c.horn);
      g.set(0, 0, z0 - 6, c.accent);
    }
  }
  return g;
}

// Leg hangs straight down from its pivot (0,0,0) to the ground at y = -len.
function leg(spec, front) {
  const c = spec.colors;
  const L = front ? spec.backLeg.len + spec.shoulder[1] : spec.backLeg.len;
  const { thigh, shin } = front ? spec.frontLeg : spec.backLeg;
  const g = new VoxelGrid();
  ellipsoid(g, [0, -thigh[1] * 0.55, 0], thigh, (x, y, z) => (hash(x, y, z) < 0.15 ? c.dark : c.body));
  capsule(g, [0, -L * 0.45, front ? 0 : -1], [0, -L + 2.2, 0.5], shin, shin * 0.85, (x, y, z) => (hash(x, y, z) < 0.15 ? c.dark : c.body));
  ellipsoid(g, [0, -L + 0.9, 1.6], [shin + 0.6, 1.5, shin + 1.7], shade(c.body, 0.85));
  // claws
  const zf = frontAt(g, 0, -L + 1) ?? 3;
  for (const x of [-2, 0, 2]) g.set(x, -L + 1, zf + 1, c.horn).set(x, -L, zf + 1, c.horn);
  // trim anything below the ground line
  for (const v of g.voxels()) if (v.y < -L) g.remove(v.x, v.y, v.z);
  return g;
}

// Wings extend along +x (right side). The arm bone runs along x at y=0, z=0 and the membrane
// trails behind it (toward -z). The wing is two pieces, so it can fold at the "elbow".
function wingPiece(spec, outer) {
  const c = spec.colors;
  const { spanA, spanB, depth, style } = spec.wing;
  const span = outer ? spanB : spanA;
  const g = new VoxelGrid();
  const fingers = outer ? [0.25, 0.55, 0.85] : [0.7];
  const depthAt = (x) => {
    const u = x / span;
    // base depth: full at the body, tapering to a point at the outer tip
    let d = outer ? depth * 0.8 * (1 - u) ** 0.8 : depth * (1 - u * 0.2);
    if (style === 'round') d = outer ? depth * Math.sqrt(Math.max(0, 1 - u * u)) : depth;
    // scallops between the finger bones
    if (style !== 'round') {
      const f = [0, ...fingers, 1];
      for (let i = 0; i < f.length - 1; i++) {
        if (u >= f[i] && u <= f[i + 1]) d -= (style === 'fin' ? 1.2 : 2.6) * Math.sin(((u - f[i]) / (f[i + 1] - f[i])) * Math.PI);
      }
    }
    return Math.max(0, d);
  };
  for (let x = 0; x <= span; x++) {
    const d = Math.round(depthAt(x));
    for (let z = -d; z <= 0; z++) {
      const stripe = style === 'fin' && x % 3 === 0;
      const edge = z === -d;
      g.set(x, 0, z, edge ? c.wingDark : stripe ? shade(c.wing, 0.9) : z < -d * 0.6 ? shade(c.wing, 1.06) : c.wing);
    }
  }
  // finger bones running back across the membrane
  for (const f of fingers) {
    const x0 = Math.round(f * span * (outer ? 0.6 : 1));
    const x1 = Math.round(f * span);
    capsule(g, [x0, 0, 0], [x1, 0, -Math.round(depthAt(x1)) + 1], 0.7, 0.5, c.wingDark);
  }
  // arm bone along the leading edge
  capsule(g, [0, 0, 0], [span, 0, 0], outer ? 1.1 : 1.5, outer ? 0.7 : 1.1, c.dark);
  if (outer) {
    g.set(span + 1, 0, 0, c.horn).set(span + 2, 0, 1, c.horn); // thumb claw at the wing tip
  }
  return g;
}

function head(spec) {
  const c = spec.colors;
  const h = spec.head;
  const [hx, hy, hz] = h.skull;
  const g = new VoxelGrid();
  const zc = hz * 0.6;
  ellipsoid(g, [0, 1, zc], [hx, hy, hz], (x, y, z) => (hash(x, y, z) < 0.12 ? c.dark : c.body));
  // snout
  const s0 = zc + hz * 0.4, s1 = zc + hz * 0.4 + h.snoutLen;
  capsule(g, [0, -0.5, s0], [0, -1, s1], h.snoutW, h.snoutW * 0.82, (x, y) => (y < -2 ? c.belly : c.body));
  // mouth line and jaw
  for (let z = Math.round(s0 + 1); z <= s1; z++) {
    for (const side of [1, -1]) {
      const x = sideAt(g, side, -2, z);
      if (x != null) g.set(x, -2, z, shade(c.dark, 0.7));
    }
  }
  // nostrils
  for (const x of [-1, 1]) {
    const z = frontAt(g, x, 0);
    if (z != null) g.set(x, 0, z, shade(c.dark, 0.6));
  }
  if (h.teeth) for (const x of [-2, 2]) g.set(x, -3, Math.round(s1) - 1, '#ffffff');

  // eyes, painted onto each side of the skull
  const eyes = {
    fierce: { rows: ['bbb', 'wiP', 'wii'], y: 3, z: zc + 1 },
    cute: { rows: ['.ww.', 'wPPh', 'wPPw', '.ii.'], y: 2, z: zc + 2.5 },
    sharp: { rows: ['bbbb', 'wiPi', '.ii.'], y: 2, z: zc + 1 },
  }[h.eye];
  const palette = { w: '#ffffff', i: c.eye, P: '#1b1b2a', h: '#ffffff', b: shade(c.dark, 0.75) };
  for (const side of [1, -1]) {
    eyes.rows.forEach((row, r) => {
      [...row].forEach((ch, k) => {
        if (ch === '.') return;
        const y = eyes.y - r + 1, z = Math.round(eyes.z) + (side > 0 ? k : row.length - 1 - k) - (row.length >> 1);
        const x = sideAt(g, side, y, z);
        if (x == null) return;
        g.set(x, y, z, palette[ch]);
        if (h.eye === 'cute' && ch !== 'b') g.set(x + side, y, z, palette[ch]); // big eyes bulge out a little
      });
    });
    if (h.blush) {
      for (const dz of [0, 1]) {
        const y = eyes.y - 3, z = Math.round(eyes.z) + dz + 1;
        const x = sideAt(g, side, y, z);
        if (x != null) g.set(x, y, z, '#ff9db5');
      }
    }
  }

  // horns
  const top = hy + 1;
  if (h.horns === 'curved') {
    for (const side of [1, -1]) {
      const a = [side * hx * 0.5, top - 1, zc - 1], b = [side * hx * 0.75, top + 3, zc - 4], d = [side * hx * 0.8, top + 3, zc - 9];
      capsule(g, a, b, 1.7, 1.2, c.horn);
      capsule(g, b, d, 1.2, 0.6, (x, y, z, t) => (t > 0.6 ? shade(c.horn, 0.85) : c.horn));
    }
    // little ear frills
    for (const side of [1, -1]) capsule(g, [side * hx, 2, zc - 2], [side * (hx + 2), 3, zc - 5], 1, 0.5, c.wing);
  } else if (h.horns === 'nubs') {
    for (const side of [1, -1]) ellipsoid(g, [side * hx * 0.45, top + 0.5, zc - 1], [1.6, 1.8, 1.6], c.horn);
    ellipsoid(g, [0, top + 1, zc + 1], [1.2, 1.3, 1.2], c.spike); // tuft
  } else if (h.horns === 'crystal') {
    capsule(g, [0, top - 1, zc - 1], [0, top + 4, zc - 8], 1.4, 0.4, c.horn);
    for (const side of [1, -1]) {
      capsule(g, [side * hx * 0.6, top - 1, zc - 1], [side * (hx + 1), top + 2, zc - 7], 1.1, 0.3, c.horn);
      capsule(g, [side * hx * 0.9, top - 2, zc], [side * (hx + 2), top - 1, zc - 4], 0.8, 0.3, c.accent);
    }
  }
  if (h.frills) {
    for (const side of [1, -1]) {
      for (let k = 0; k < 5; k++) for (let y = -1; y <= 2 - (k >> 1); y++) g.set(side * (hx + 1), y, Math.round(zc) - 2 - k, k % 2 ? c.wing : c.wingDark);
    }
  }
  return g;
}

export function buildDragonParts(id) {
  const spec = DRAGONS[id];
  return {
    spec,
    torso: torso(spec),
    neck: Array.from({ length: spec.neck.segments }, (_, i) => neckSegment(spec, i)),
    head: head(spec),
    tail: Array.from({ length: spec.tail.segments }, (_, i) => tailSegment(spec, i)),
    backLeg: leg(spec, false),
    frontLeg: leg(spec, true),
    wingInner: wingPiece(spec, false),
    wingOuter: wingPiece(spec, true),
  };
}
