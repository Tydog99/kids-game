// The Sky Pitch: a flying-game pitch (an oval of grass with tall goal hoops at each end and
// towers of stands around it) and the race course over it. Pure numbers, so it can be tested.
//
// The pitch is built off the edge of the world map, so the ride there and back is by magic ring.
// Pitch coordinates are relative to its centre; the long side runs along x.

export const PITCH = {
  a: 34, // half length of the grass oval
  b: 20, // half width
  wall: 58, // nothing can fly further than this from the centre
  towers: 14, // towers of stands around the oval
  towerR: 41, // how far out they stand
  towerTop: 13, // how high they reach (with their roofs)
};

// Three goal hoops at each end: the middle one is the tallest.
export const HOOPS = [-1, 1].flatMap((end) =>
  [-5, 0, 5].map((z) => ({ x: end * (PITCH.a - 4), z, height: z === 0 ? 9 : 6.5, radius: z === 0 ? 2.4 : 1.8 })),
);

export const LAP_RINGS = 8; // rings around the pitch; then a few down the middle
export const RING_RADIUS = 2.6; // the race rings (big, for small hands)
export const PASS_RADIUS = 3.1; // flying this close to a ring's centre counts as through it

// The race: once around the pitch through golden rings, then back down the middle of the pitch
// and through the tall middle goal hoop at the far end.
export function raceCourse() {
  const rings = [];
  const ax = PITCH.a + 4, bz = PITCH.b;
  // around the oval (outside the goal hoops at the ends), starting near the west end, well apart
  // (evenly spaced along the oval, not by angle, so no two are bunched up at the ends)
  const at = (th) => ({ x: Math.cos(th) * ax, z: -Math.sin(th) * bz });
  const from = Math.PI + 0.8, span = Math.PI * 2 * 0.8, steps = 400;
  const path = [{ ...at(from), len: 0 }];
  for (let k = 1; k <= steps; k++) {
    const p = at(from + (k / steps) * span), q = path[k - 1];
    path.push({ ...p, len: q.len + Math.hypot(p.x - q.x, p.z - q.z) });
  }
  const total = path[steps].len;
  for (let i = 0; i < LAP_RINGS; i++) {
    const want = (i / (LAP_RINGS - 1)) * total;
    const p = path.find((q) => q.len >= want - 1e-9) ?? path[steps];
    rings.push({ x: p.x, z: p.z, y: 5 + Math.sin(i * 1.7) * 1.2 });
  }
  // then through the middle, low and fast, to the big hoop at the east end
  [-14, 8].forEach((x, i) => rings.push({ x, z: 0, y: 5 + i * 1.5 }));
  const goal = HOOPS.find((h) => h.x > 0 && h.z === 0);
  rings.push({ x: goal.x, z: goal.z, y: goal.height, goal: true });
  // each ring faces along the course
  rings.forEach((r, i) => {
    const prev = rings[i - 1] ?? START, next = rings[i + 1] ?? { x: r.x + 1, z: r.z };
    r.heading = Math.atan2(next.x - prev.x, next.z - prev.z);
  });
  return rings;
}

// Where you appear on arriving: just outside the west goal hoops, facing up the south side.
export const START = { x: -PITCH.a - 7, z: 3, y: 5 };
START.heading = (() => {
  const first = raceCourse()[0];
  return Math.atan2(first.x - START.x, first.z - START.z);
})();

// Did a flyer moving from a to b pass through the ring? (close enough to its centre at any point
// along the way, so a fast dragon can't skip past it between frames)
export function passes(ring, a, b, radius = PASS_RADIUS) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len2 = dx * dx + dy * dy + dz * dz;
  let t = len2 ? ((ring.x - a.x) * dx + (ring.y - a.y) * dy + (ring.z - a.z) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(a.x + dx * t - ring.x, a.y + dy * t - ring.y, a.z + dz * t - ring.z) < radius;
}

// What a ridden dragon finds at pitch tile (tx, tz) (pitch coordinates): the grass is open and
// can be landed on; the towers are solid; past the wall nothing can fly.
export function pitchTile(tx, tz) {
  const x = tx + 0.5, z = tz + 0.5;
  const r = Math.hypot(x, z);
  if (r > PITCH.wall) return { top: 99, land: false };
  for (const t of towers()) if (Math.hypot(x - t.x, z - t.z) < t.half + 0.8) return { top: PITCH.towerTop, land: false };
  return { top: 0.25, land: true };
}

let towerCache = null;
export function towers() {
  if (towerCache) return towerCache;
  towerCache = [];
  for (let i = 0; i < PITCH.towers; i++) {
    const th = (i / PITCH.towers) * Math.PI * 2 + 0.2;
    // leave gaps behind the goal hoops so the way in and out is clear
    if (Math.abs(Math.cos(th)) > 0.93) continue;
    towerCache.push({ x: Math.cos(th) * PITCH.towerR * 1.15, z: Math.sin(th) * PITCH.towerR * 0.8, half: 2.2, colour: i % 4 });
  }
  return towerCache;
}

export const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
