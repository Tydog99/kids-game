// Random looks for the player characters: new skin, hair, eye and outfit colors on the same shapes.
// A look is a small set of color overrides for CHARACTERS[id] (characters.js).
import { createRng } from '../../rng.js';

const SKIN = ['#f9d7b5', '#f3c6a0', '#f0c08a', '#e0ac7e', '#c98e5e', '#a86f45', '#8a5634', '#6b4026'];
const HAIR = ['#2b2220', '#4a3d39', '#6b4224', '#8a5a33', '#b5783a', '#d9a35a', '#f2d16b', '#c2462e', '#e9e9e9', '#5a7bd6', '#e05a9a', '#7a4ac8'];
const EYES = ['#4a3424', '#7a4326', '#3a6ea8', '#3f8a5a', '#6a6a6a', '#8a5aa8'];
const CLOTH = ['#3b6fd6', '#d64535', '#4ac86b', '#f5d33b', '#f07fae', '#a85fc8', '#2fb8c4', '#ff8a3a', '#efe6d4', '#2b3f73', '#ffffff', '#3a3a3a'];
const PANTS = ['#7fa6d6', '#2b3f73', '#b7a98a', '#5a4a3a', '#3a3a3a', '#a85fc8', '#4a8a5a', '#c2462e'];
const SHOES = ['#fafafa', '#3a3a3a', '#d64535', '#3b6fd6', '#8a5236', '#f5d33b', '#4ac86b'];

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const shade = (h, k) => {
  const c = parseInt(h.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return hex((f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255));
};

export function randomLook(id, seed = Math.random() * 1e9) {
  const r = createRng(Math.floor(seed));
  const hair = r.pick(HAIR);
  const look = { skin: r.pick(SKIN), hair, hairDark: shade(hair, 0.78), hairLight: shade(hair, 1.22), eyes: r.pick(EYES) };
  if (id === 'boy') {
    const jacket = r.pick(CLOTH);
    let tee = r.pick(CLOTH);
    if (tee === jacket) tee = '#ffffff';
    const pants = r.pick(PANTS), shoes = r.pick(SHOES);
    Object.assign(look, { jacket, jacketDark: shade(jacket, 0.86), lining: shade(jacket, 0.6), tee, pants, pantsDark: shade(pants, 0.86), shoes, soles: shade(shoes, 0.8), laces: shade(shoes, 0.7) });
  } else {
    const top = r.pick(CLOTH), shorts = r.pick(PANTS), boots = r.pick(SHOES);
    Object.assign(look, {
      top, topDark: shade(top, 0.86), heart: top === '#ffffff' ? '#f07fae' : '#ffffff',
      shorts, shortsDark: shade(shorts, 0.86), boots, bootsDark: shade(boots, 0.78), bootCuff: shade(boots, 1.18), band: boots,
      clip: r.pick(['#ffd34d', '#ffffff', '#f07fae', '#7af0c8']),
    });
  }
  return look;
}

// Saved looks are JSON; anything that isn't a plain map of colors is ignored.
export function parseLook(json) {
  try {
    const l = JSON.parse(json);
    if (!l || typeof l !== 'object') return null;
    return Object.fromEntries(Object.entries(l).filter(([, v]) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)));
  } catch {
    return null;
  }
}
