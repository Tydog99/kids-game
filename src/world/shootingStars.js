// Pure shooting-star maths: how often they appear and the path each one takes.
// Directions are unit vectors from the viewer; the renderer scales them onto the sky dome.

// Slider steps for the "Shooting stars" control: average number per second at full night.
export const METEOR_RATES = [
  { label: 'Off', perSecond: 0 },
  { label: 'Rare', perSecond: 1 / 20 },
  { label: 'Some', perSecond: 1 / 7 },
  { label: 'Lots', perSecond: 1 / 2.5 },
  { label: 'Meteor shower', perSecond: 1.5 },
];
export const DEFAULT_METEOR_INDEX = 2;

const norm = (v) => {
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// The third-person camera only shows sky up to ~18–20° above the horizon, so meteors start low.
export const START_ELEVATION = [6, 18]; // degrees

// random() → [0, 1). viewAzimuth (optional): the compass angle the camera faces, atan2(z, x).
// Most meteors appear in that part of the sky so they're actually seen.
// Returns { start, dir, length, duration } where start is a point on the unit sky dome,
// dir a unit tangent to travel along, length in radians of sky crossed.
export function makeMeteor(random, viewAzimuth) {
  const inView = viewAzimuth !== undefined && random() < 0.85;
  const az = inView ? viewAzimuth + (random() * 2 - 1) * (45 * Math.PI) / 180 : random() * Math.PI * 2;
  const [lo, hi] = START_ELEVATION;
  const el = (lo + random() * (hi - lo)) * (Math.PI / 180);
  const start = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
  // tangent basis at the start point: "east" along the horizon and "down" toward it
  const east = norm(cross([0, 1, 0], start));
  const down = norm(cross(start, east)).map((c) => -c);
  // any direction, but mostly falling: angle from straight down within ±100°
  const turn = (random() * 2 - 1) * (100 * Math.PI) / 180;
  const dir = norm(down.map((d, i) => d * Math.cos(turn) + east[i] * Math.sin(turn)));
  const length = (6 + random() * 22) * (Math.PI / 180); // 6°–28° of sky
  const duration = 0.35 + length * 2.2 + random() * 0.3;
  return { start, dir, length, duration };
}

// Position along the streak, `traveled` radians from the start (a great-circle arc).
export function meteorPoint(m, traveled) {
  const c = Math.cos(traveled), s = Math.sin(traveled);
  return m.start.map((p, i) => p * c + m.dir[i] * s);
}

// Chance that at least one meteor starts this frame.
export function spawnChance(perSecond, dt, night) {
  return 1 - Math.exp(-perSecond * night * dt);
}
