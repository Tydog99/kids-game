// How a wild dragon comes to trust the player: stay close and calm while it's on the ground.
// Pure, so it can be tested.

export const TRUST = {
  near: 3.5, // tiles from the dragon's body
  far: 8, // beyond this, trust slowly fades
  fill: 15, // seconds of standing still nearby to fill completely
  movingRate: 0.5, // trust builds at half speed while walking around near it
  fade: 40, // seconds to fade from full to nothing when far away
};

// Returns the new trust level (0..1).
export function updateTrust(trust, dt, { distance, grounded, playerSpeed }) {
  if (distance <= TRUST.near && grounded) {
    const rate = playerSpeed > 0.3 ? TRUST.movingRate : 1;
    return Math.min(1, trust + (dt / TRUST.fill) * rate);
  }
  if (distance > TRUST.far) return Math.max(0, trust - dt / TRUST.fade);
  return trust;
}

// Hearts to show for a trust level, out of 5.
export const heartsFor = (trust) => Math.min(5, Math.floor(trust * 5 + 1e-9));

const NAMES = {
  ember: ['Sparky', 'Blaze', 'Cinder', 'Flicker', 'Scorch', 'Ruby'],
  glimmer: ['Twinkle', 'Bubbles', 'Gem', 'Sprinkles', 'Pebble', 'Mint'],
  frost: ['Snowflake', 'Icicle', 'Blizzard', 'Crystal', 'Frosty', 'Sky'],
};

export function suggestName(kind, random = Math.random) {
  const list = NAMES[kind] ?? NAMES.ember;
  return list[Math.floor(random() * list.length)];
}

// Keeps names short and tidy; falls back to a suggestion when empty.
export function cleanName(name, kind) {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 16).trim();
  return n || suggestName(kind, () => 0);
}
