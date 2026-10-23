// The game's theme: an original heroic overworld march (16 bars, loops).
// Pure data and helpers so the arrangement can be tested without audio.
// Time is counted in eighth notes; pitches are MIDI note numbers.

export const TEMPO = 132; // quarter notes per minute
export const EIGHTH = 60 / TEMPO / 2; // seconds
export const BAR = 8; // eighths per bar

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

// 'C5' → 72
export function midi(name) {
  const m = /^([A-G][b#]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return (Number(m[2]) + 1) * 12 + NOTE[m[1]];
}

export const freq = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Chord per bar. The ♭VII (Bb) and ♭VI (Ab) chords give it that bold, adventurous lift.
const CHORDS = {
  C: ['C', 'E', 'G'],
  Bb: ['Bb', 'D', 'F'],
  F: ['F', 'A', 'C'],
  Ab: ['Ab', 'C', 'Eb'],
  Am: ['A', 'C', 'E'],
  G: ['G', 'B', 'D'],
};
export const PROGRESSION = ['C', 'Bb', 'F', 'C', 'Ab', 'Bb', 'C', 'C', 'Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G'];

// Lead melody: [note, eighths]; 'R' is a rest. Each bar adds up to 8.
export const MELODY = [
  // A: the call to adventure
  ['G4', 4], ['C5', 2], ['D5', 1], ['E5', 1],
  ['F5', 3], ['E5', 1], ['D5', 2], ['Bb4', 2],
  ['C5', 4], ['A4', 2], ['C5', 2],
  ['G4', 6], ['R', 2],
  ['Ab4', 2], ['C5', 2], ['Eb5', 3], ['D5', 1],
  ['D5', 2], ['F5', 2], ['Bb5', 2], ['A5', 1], ['G5', 1],
  ['G5', 4], ['E5', 2], ['C5', 2],
  ['C5', 6], ['R', 2],
  // B: over the hills and far away
  ['E5', 2], ['A5', 2], ['G5', 1], ['E5', 1], ['C5', 2],
  ['D5', 3], ['C5', 1], ['A4', 4],
  ['E5', 2], ['G5', 2], ['C6', 3], ['B5', 1],
  ['A5', 2], ['G5', 2], ['D5', 4],
  ['E5', 2], ['A5', 2], ['B5', 2], ['C6', 2],
  ['D6', 3], ['C6', 1], ['A5', 2], ['F5', 2],
  ['G5', 2], ['D5', 2], ['G5', 2], ['B5', 2],
  ['D6', 4], ['B5', 1], ['A5', 1], ['G5', 2],
];

export const LOOP = PROGRESSION.length * BAR; // eighths

// Every note in one loop. night: a softer arrangement (no drums, gentler parts).
// Returns [{ t, dur, note, voice, vel }] with t and dur in eighths.
export function buildEvents({ night = false } = {}) {
  const ev = [];
  // lead
  let t = 0;
  for (const [n, d] of MELODY) {
    if (n !== 'R') ev.push({ t, dur: d, note: midi(n) - (night ? 12 : 0), voice: 'lead', vel: night ? 0.7 : 1 });
    t += d;
  }
  PROGRESSION.forEach((name, bar) => {
    const start = bar * BAR;
    const [root, third, fifth] = CHORDS[name];
    const r2 = midi(`${root}2`), f2 = midi(`${fifth}2`) + (NOTE[fifth] < NOTE[root] ? 12 : 0);
    // bass: a marching root–fifth bounce (just held roots at night)
    if (night) ev.push({ t: start, dur: 8, note: r2, voice: 'bass', vel: 0.8 });
    else [r2, f2, r2 + 12, f2].forEach((n, i) => ev.push({ t: start + i * 2, dur: 2, note: n, voice: 'bass', vel: 1 }));
    // shimmering arpeggio of the chord: sixteenths by day, eighths at night
    const tones = [root, third, fifth].map((x) => midi(`${x}4`)).sort((a, b) => a - b);
    const arp = [tones[0], tones[1], tones[2], tones[0] + 12, tones[2], tones[1]];
    const step = night ? 1 : 0.5;
    for (let k = 0; k * step < BAR; k++) ev.push({ t: start + k * step, dur: step, note: arp[k % arp.length], voice: 'arp', vel: night ? 0.6 : 1 });
    // drums (daytime only): hats on the eighths, snare on 2 and 4, a roll into each new section
    if (!night) {
      for (let k = 0; k < BAR; k++) ev.push({ t: start + k, dur: 0.5, voice: 'hat', vel: k % 2 ? 0.6 : 1 });
      ev.push({ t: start + 2, dur: 1, voice: 'snare', vel: 1 }, { t: start + 6, dur: 1, voice: 'snare', vel: 1 });
      ev.push({ t: start, dur: 1, voice: 'kick', vel: 1 }, { t: start + 4, dur: 1, voice: 'kick', vel: 1 });
      if (bar === 7 || bar === 15) for (let k = 0; k < 4; k++) ev.push({ t: start + 6 + k * 0.5, dur: 0.5, voice: 'snare', vel: 0.5 + k * 0.15 });
    }
  });
  return ev.sort((a, b) => a.t - b.t);
}
