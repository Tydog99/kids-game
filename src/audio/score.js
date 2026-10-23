// The game's music: five original themes, each 16 bars that loop.
// Pure data and helpers so the arrangements can be tested without audio.
// Time is counted in eighth notes; pitches are MIDI note numbers.

const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

// 'C5' → 72
export function midi(name) {
  const m = /^([A-G][b#]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return (Number(m[2]) + 1) * 12 + NOTE[m[1]];
}

export const freq = (n) => 440 * Math.pow(2, (n - 69) / 12);

const CHORDS = {
  C: ['C', 'E', 'G'],
  D: ['D', 'F#', 'A'],
  E: ['E', 'G#', 'B'],
  F: ['F', 'A', 'C'],
  G: ['G', 'B', 'D'],
  A: ['A', 'C#', 'E'],
  Bb: ['Bb', 'D', 'F'],
  Ab: ['Ab', 'C', 'Eb'],
  Am: ['A', 'C', 'E'],
  Bm: ['B', 'D', 'F#'],
  Dm: ['D', 'F', 'A'],
  Em: ['E', 'G', 'B'],
  Gm: ['G', 'Bb', 'D'],
};

// Each theme: tempo (quarter notes per minute), bar (eighths per bar), a chord per bar, a melody of
// [note, eighths] ('R' = rest; every bar adds up to `bar`), and how the band plays it.
export const THEMES = [
  {
    id: 'hero',
    name: "Hero's Journey",
    blurb: 'Bold and heroic, a marching adventure.',
    tempo: 132,
    bar: 8,
    lead: { wave: 'square', gate: 0.92, gain: 0.075 },
    bass: 'march',
    arp: 0.5,
    drums: 'march',
    // the ♭VI (Ab) and ♭VII (Bb) chords give it that bold, adventurous lift
    progression: ['C', 'Bb', 'F', 'C', 'Ab', 'Bb', 'C', 'C', 'Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G'],
    melody: [
      ['G4', 4], ['C5', 2], ['D5', 1], ['E5', 1],
      ['F5', 3], ['E5', 1], ['D5', 2], ['Bb4', 2],
      ['C5', 4], ['A4', 2], ['C5', 2],
      ['G4', 6], ['R', 2],
      ['Ab4', 2], ['C5', 2], ['Eb5', 3], ['D5', 1],
      ['D5', 2], ['F5', 2], ['Bb5', 2], ['A5', 1], ['G5', 1],
      ['G5', 4], ['E5', 2], ['C5', 2],
      ['C5', 6], ['R', 2],
      ['E5', 2], ['A5', 2], ['G5', 1], ['E5', 1], ['C5', 2],
      ['D5', 3], ['C5', 1], ['A4', 4],
      ['E5', 2], ['G5', 2], ['C6', 3], ['B5', 1],
      ['A5', 2], ['G5', 2], ['D5', 4],
      ['E5', 2], ['A5', 2], ['B5', 2], ['C6', 2],
      ['D6', 3], ['C6', 1], ['A5', 2], ['F5', 2],
      ['G5', 2], ['D5', 2], ['G5', 2], ['B5', 2],
      ['D6', 4], ['B5', 1], ['A5', 1], ['G5', 2],
    ],
  },
  {
    id: 'village',
    name: 'Village Morning',
    blurb: 'Cozy and cheerful, a gentle waltz.',
    tempo: 104,
    bar: 6, // 3/4 time
    lead: { wave: 'pulse', gate: 0.85, gain: 0.11 },
    bass: 'waltz',
    arp: 1,
    drums: 'waltz',
    progression: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'F', 'F', 'Bb', 'C', 'Am', 'Dm', 'Gm', 'C', 'F', 'F'],
    melody: [
      ['A4', 2], ['C5', 2], ['F5', 2],
      ['E5', 3], ['D5', 1], ['C5', 2],
      ['D5', 2], ['F5', 2], ['A5', 2],
      ['G5', 4], ['F5', 2],
      ['F5', 2], ['E5', 1], ['F5', 1], ['A5', 2],
      ['G5', 3], ['E5', 1], ['C5', 2],
      ['C5', 2], ['A4', 2], ['C5', 2],
      ['F5', 4], ['R', 2],
      ['D5', 2], ['F5', 2], ['Bb5', 2],
      ['A5', 3], ['G5', 1], ['E5', 2],
      ['C5', 2], ['E5', 2], ['A5', 2],
      ['F5', 4], ['D5', 2],
      ['Bb5', 2], ['A5', 1], ['G5', 1], ['D5', 2],
      ['E5', 2], ['G5', 2], ['Bb5', 2],
      ['A5', 3], ['G5', 1], ['F5', 2],
      ['F5', 4], ['R', 2],
    ],
  },
  {
    id: 'sky',
    name: 'Sky Dragon',
    blurb: 'Fast and epic, for soaring through the clouds.',
    tempo: 160,
    bar: 8,
    lead: { wave: 'square', gate: 0.9, gain: 0.07 },
    bass: 'octaves',
    arp: 0.5,
    drums: 'driving',
    progression: ['Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'Dm', 'Dm'],
    melody: [
      ['D5', 2], ['A4', 2], ['D5', 2], ['F5', 2],
      ['Bb5', 3], ['A5', 1], ['F5', 4],
      ['G5', 2], ['E5', 2], ['C5', 2], ['E5', 2],
      ['D5', 6], ['R', 2],
      ['A5', 2], ['D6', 2], ['C6', 1], ['A5', 1], ['F5', 2],
      ['G5', 2], ['Bb5', 2], ['D6', 4],
      ['C6', 2], ['G5', 2], ['E5', 2], ['G5', 2],
      ['A5', 4], ['E5', 2], ['C#5', 2],
      ['F5', 2], ['A5', 2], ['C6', 3], ['A5', 1],
      ['G5', 4], ['E5', 2], ['C5', 2],
      ['D5', 2], ['F5', 2], ['A5', 2], ['D6', 2],
      ['D6', 3], ['C6', 1], ['Bb5', 4],
      ['Bb5', 2], ['A5', 2], ['G5', 2], ['D5', 2],
      ['C#6', 4], ['A5', 2], ['E5', 2],
      ['D6', 6], ['A5', 2],
      ['D6', 4], ['R', 4],
    ],
  },
  {
    id: 'woods',
    name: 'Mystic Woods',
    blurb: 'Mysterious and hushed, for exploring forests.',
    tempo: 96,
    bar: 8,
    lead: { wave: 'triangle', gate: 0.95, gain: 0.2 },
    bass: 'held',
    arp: 1,
    drums: 'brush',
    // A minor with a bright D major chord (Dorian): curious rather than sad
    progression: ['Am', 'D', 'Am', 'D', 'F', 'G', 'Am', 'Am', 'C', 'G', 'D', 'Am', 'F', 'G', 'E', 'E'],
    melody: [
      ['E5', 2], ['A5', 2], ['B5', 2], ['C6', 2],
      ['B5', 4], ['A5', 2], ['F#5', 2],
      ['E5', 6], ['R', 2],
      ['F#5', 2], ['A5', 2], ['D5', 4],
      ['C5', 2], ['F5', 2], ['A5', 2], ['G5', 2],
      ['G5', 4], ['D5', 4],
      ['E5', 2], ['C5', 2], ['A4', 4],
      ['R', 8],
      ['E5', 2], ['G5', 2], ['C6', 4],
      ['B5', 2], ['D5', 2], ['G5', 4],
      ['F#5', 2], ['A5', 2], ['D6', 2], ['C6', 2],
      ['A5', 8],
      ['A5', 2], ['C6', 2], ['F5', 4],
      ['B5', 2], ['G5', 2], ['D5', 4],
      ['G#5', 2], ['B5', 2], ['E5', 4],
      ['E5', 6], ['R', 2],
    ],
  },
  {
    id: 'town',
    name: 'Treasure Town',
    blurb: 'Playful and bouncy, with a skip in its step.',
    tempo: 126,
    bar: 8,
    lead: { wave: 'pulse', gate: 0.55, gain: 0.1 }, // short, springy notes
    bass: 'bounce',
    arp: 1,
    drums: 'bounce',
    progression: ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am', 'D', 'C', 'D', 'Bm', 'Em', 'C', 'D', 'G', 'G'],
    melody: [
      ['G4', 1], ['B4', 1], ['D5', 1], ['G5', 1], ['R', 1], ['D5', 1], ['B4', 2],
      ['E5', 2], ['G5', 1], ['E5', 1], ['B4', 2], ['R', 2],
      ['C5', 1], ['E5', 1], ['G5', 2], ['E5', 1], ['C5', 1], ['E5', 2],
      ['F#5', 2], ['A5', 2], ['D5', 3], ['R', 1],
      ['B5', 1], ['A5', 1], ['G5', 1], ['D5', 1], ['G5', 2], ['B5', 2],
      ['G5', 2], ['E5', 1], ['G5', 1], ['B5', 2], ['G5', 2],
      ['A5', 1], ['C6', 1], ['A5', 1], ['E5', 1], ['C5', 2], ['E5', 2],
      ['D5', 4], ['F#5', 2], ['A5', 2],
      ['G5', 2], ['E5', 1], ['G5', 1], ['C6', 2], ['G5', 2],
      ['A5', 2], ['F#5', 1], ['A5', 1], ['D6', 2], ['A5', 2],
      ['B5', 1], ['A5', 1], ['F#5', 1], ['D5', 1], ['B4', 2], ['D5', 2],
      ['E5', 4], ['G5', 2], ['B5', 2],
      ['C6', 2], ['B5', 1], ['A5', 1], ['G5', 2], ['E5', 2],
      ['F#5', 2], ['G5', 1], ['A5', 1], ['D6', 2], ['C6', 2],
      ['B5', 2], ['G5', 2], ['D5', 2], ['B4', 2],
      ['G5', 4], ['R', 4],
    ],
  },
];

export const theme = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];
export const eighthSeconds = (t) => 60 / t.tempo / 2;
export const loopLength = (t) => t.progression.length * t.bar; // eighths

// Every note in one loop of a theme. night: a softer arrangement (no drums, gentler parts).
// Returns [{ t, dur, note, voice, vel, wave, gate }] with t and dur in eighths.
export function buildEvents(th, { night = false } = {}) {
  const ev = [];
  const B = th.bar;
  // lead (at night: an octave lower on a soft triangle)
  let t = 0;
  for (const [n, d] of th.melody) {
    if (n !== 'R') {
      ev.push({
        t,
        dur: d,
        note: midi(n) - (night ? 12 : 0),
        voice: 'lead',
        vel: night ? 0.7 : 1,
        wave: night ? 'triangle' : th.lead.wave,
        gate: night ? 0.95 : th.lead.gate,
        gain: night ? 0.2 : th.lead.gain,
      });
    }
    t += d;
  }
  th.progression.forEach((name, bar) => {
    const start = bar * B;
    const [root, third, fifth] = CHORDS[name];
    const r2 = midi(`${root}2`);
    const f2 = midi(`${fifth}2`) + (NOTE[fifth] < NOTE[root] ? 12 : 0);
    const bass = (time, dur, note, vel = 1) => ev.push({ t: start + time, dur, note, voice: 'bass', vel });
    // bass
    const style = night ? 'held' : th.bass;
    if (style === 'held') bass(0, B, r2, 0.8);
    else if (style === 'march') [r2, f2, r2 + 12, f2].forEach((n, i) => bass(i * 2, 2, n));
    else if (style === 'waltz') {
      bass(0, 2, r2);
      bass(2, 2, f2, 0.7);
      bass(4, 2, f2, 0.7);
    } else if (style === 'octaves') for (let k = 0; k < B; k++) bass(k, 1, r2 + (k % 2 ? 12 : 0), k % 2 ? 0.7 : 1);
    else if (style === 'bounce') [r2, r2 + 12, f2, r2 + 12].forEach((n, i) => bass(i * 2, 1, n));
    // arpeggio of the chord
    const tones = [root, third, fifth].map((x) => midi(`${x}4`)).sort((a, b) => a - b);
    const arp = [tones[0], tones[1], tones[2], tones[0] + 12, tones[2], tones[1]];
    const step = night ? 1 : th.arp;
    for (let k = 0; k * step < B; k++) ev.push({ t: start + k * step, dur: step, note: arp[k % arp.length], voice: 'arp', vel: night ? 0.6 : 1 });
    // drums (daytime only)
    if (night) return;
    const hit = (voice, time, vel = 1) => ev.push({ t: start + time, dur: 0.5, voice, vel });
    if (th.drums === 'march' || th.drums === 'driving') {
      for (let k = 0; k < B; k++) hit('hat', k, k % 2 ? 0.6 : 1);
      hit('snare', 2);
      hit('snare', 6);
      const kicks = th.drums === 'driving' ? [0, 2, 4, 6] : [0, 4];
      kicks.forEach((k) => hit('kick', k));
      // a snare roll leading into each new section
      if (bar === 7 || bar === 15) for (let k = 0; k < 4; k++) hit('snare', 6 + k * 0.5, 0.5 + k * 0.15);
    } else if (th.drums === 'waltz') {
      hit('kick', 0, 0.7);
      hit('hat', 2, 0.6);
      hit('hat', 4, 0.6);
    } else if (th.drums === 'brush') {
      hit('hat', 2, 0.35);
      hit('hat', 6, 0.35);
    } else if (th.drums === 'bounce') {
      hit('kick', 0);
      hit('kick', 4);
      hit('snare', 2, 0.8);
      hit('snare', 6, 0.8);
      for (let k = 1; k < B; k += 2) hit('hat', k, 0.8); // off-beat hats
    }
  });
  return ev.sort((a, b) => a.t - b.t);
}
