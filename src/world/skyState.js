// Pure sun/moon/sky math for a given point in the day. No three.js, so it can be tested.
// phase: 0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight.

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export const mixRgb = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));

const SKY_DAY = hexToRgb('#9fdcff');
const SKY_NIGHT = hexToRgb('#2f4170');
const SKY_SUNSET = hexToRgb('#ff9a5c');
const SUN_LOW = hexToRgb('#ffad6b');
const SUN_HIGH = hexToRgb('#fff4dc');
const MOON = hexToRgb('#a9c0ff');
const HEMI_SKY_DAY = hexToRgb('#dff3ff');
const HEMI_SKY_NIGHT = hexToRgb('#8da3e0');
const HEMI_GROUND_DAY = hexToRgb('#6a8f4e');
const HEMI_GROUND_NIGHT = hexToRgb('#3f5250');

export function skyState(phase) {
  const a = phase * Math.PI * 2;
  // Lighting path: east (+x) → high in the south → west (-x). Leaning toward the south (+z),
  // the side where the sun and moon are drawn, so shadows point away from them.
  const len = Math.hypot(Math.cos(a), Math.sin(a), 0.45);
  const sunDir = [Math.cos(a) / len, Math.sin(a) / len, 0.45 / len];
  const moonDir = sunDir.map((v) => -v);
  const elev = Math.sin(a);

  const day = smoothstep(-0.15, 0.3, elev); // 0 at night, 1 in daytime
  // warm sky only close to the horizon (a gradual mix of blue and orange just looks grey)
  const sunsetAmt = smoothstep(0.32, 0.04, Math.abs(elev)) * 0.85;

  const sunUp = elev >= 0;
  const light = sunUp
    ? { dir: sunDir, color: mixRgb(SUN_LOW, SUN_HIGH, smoothstep(0, 0.4, elev)), intensity: 2.0 * smoothstep(0, 0.2, elev) }
    : { dir: moonDir, color: MOON, intensity: 0.7 * smoothstep(0, 0.2, -elev) };

  return {
    phase,
    sunDir,
    moonDir,
    sunSkyDir: skyPathDir(phase),
    moonSkyDir: skyPathDir(phase + 0.5),
    day,
    light,
    sky: mixRgb(mixRgb(SKY_NIGHT, SKY_DAY, day), SKY_SUNSET, sunsetAmt),
    hemi: {
      sky: mixRgb(HEMI_SKY_NIGHT, HEMI_SKY_DAY, day),
      ground: mixRgb(HEMI_GROUND_NIGHT, HEMI_GROUND_DAY, day),
      intensity: lerp(0.75, 1.1, day),
    },
    stars: 1 - smoothstep(-0.25, 0.05, elev),
  };
}

// Where the sun/moon is *drawn*: a low arc across the southern sky (east → south → west)
// so it stays in view of the third-person camera instead of passing overhead.
export const SKY_ARC_PEAK = (14 * Math.PI) / 180;

export function skyPathDir(phase) {
  const a = phase * Math.PI * 2;
  const elev = Math.sin(a) * SKY_ARC_PEAK;
  return [Math.cos(a) * Math.cos(elev), Math.sin(elev), Math.abs(Math.sin(a)) * Math.cos(elev)];
}

// Slider steps for the "Sun speed" control: seconds per full day (Infinity = paused).
export const DAY_LENGTHS = [Infinity, 600, 300, 120, 60, 30, 15, 10, 5];
export const DEFAULT_DAY_INDEX = DAY_LENGTHS.indexOf(30);

export function formatDayLength(seconds) {
  if (seconds === Infinity) return 'Paused';
  return seconds >= 60 ? `${seconds / 60} min day` : `${seconds} s day`;
}
