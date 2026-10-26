// The Frozen Land's quests, as plain data and rules so they can be tested (FrostQuest.js runs them
// in the game). Three, one after another:
//   1. Mama Penguin's five lost chicks: find each one (it waddles after you) and bring them home.
//   2. The skating party: freeze the big lake with Frost's ice breath.
//   3. The Penguin King's crown, lost on the snowy peak: fly up, fetch it and bring it to him. He
//      makes you an honorary penguin, with a little crown of your own.
export const CHICKS = 5;
export const LAKE_FROZEN = 0.75; // this much of the lake frozen is enough to skate on

export const MAMA = {
  want: 'Oh dear, oh dear! My five little chicks wandered off in the snow. Can you find them and bring them home?',
  more: 'You found some of my chicks! Please find the rest of them.',
  thanks: 'My babies! All five are home! Thank you!',
  skate: "Now let's have a skating party! Can Frost freeze the big lake for us?",
  party: 'Wheee! Look at us skate! Thank you, friend! The Penguin King at the ice castle wants to meet you.',
};
export const KING = {
  early: 'Hello, little traveler! Have you helped Mama Penguin yet?',
  want: 'Oh, woe! I lost my crown on top of the snowy peak. Only a flying dragon can reach it. Will you fetch it?',
  thanks: 'My crown! Thank you! I name you an honorary penguin! Here is a crown of your own!',
  after: 'Long live our honorary penguin!',
};

export function newFrostState() {
  return {
    metMama: false,
    found: [], // chick indexes found (following you, or home)
    home: [], // chick indexes back with Mama
    lake: false, // frozen for the skating party
    crown: 'peak', // 'peak' → 'carried' → 'king'
  };
}

export function loadFrostState(json) {
  const base = newFrostState();
  try {
    const s = JSON.parse(json);
    if (!s || typeof s !== 'object') return base;
    const idx = (a) => (Array.isArray(a) ? [...new Set(a.filter((i) => Number.isInteger(i) && i >= 0 && i < CHICKS))] : []);
    return { ...base, metMama: !!s.metMama, found: idx(s.found), home: idx(s.home), lake: !!s.lake, crown: ['peak', 'carried', 'king'].includes(s.crown) ? s.crown : 'peak' };
  } catch {
    return base;
  }
}

// Which quest is going on: 'chicks', 'lake', 'crown' or 'done'.
export function frostStage(s) {
  if (s.home.length < CHICKS) return 'chicks';
  if (!s.lake) return 'lake';
  if (s.crown !== 'king') return 'crown';
  return 'done';
}

export function applyFrost(s, event) {
  const q = { ...s, found: [...s.found], home: [...s.home] };
  switch (event.type) {
    case 'metMama':
      q.metMama = true;
      break;
    case 'chick': // found one; it follows you
      if (!q.found.includes(event.index)) q.found.push(event.index);
      break;
    case 'home': // the chicks following you reached Mama
      for (const i of q.found) if (!q.home.includes(i)) q.home.push(i);
      break;
    case 'lakeFrozen':
      if (frostStage(q) === 'lake') q.lake = true;
      break;
    case 'crown': // picked up on the peak
      if (frostStage(q) === 'crown' && q.crown === 'peak') q.crown = 'carried';
      break;
    case 'crownHome': // given back to the King
      if (q.crown === 'carried') q.crown = 'king';
      break;
  }
  return q;
}

// Chicks following you (found, not home yet).
export const following = (s) => s.found.filter((i) => !s.home.includes(i));

// The goal for the quest tracker while you're in the Frozen Land, or null when all done.
export function frostGoal(s) {
  const stage = frostStage(s);
  if (stage === 'chicks') {
    if (!s.metMama) return { icon: '🐧', text: "Find Mama Penguin's igloo" };
    if (following(s).length) return { icon: '🐧', text: `Bring the chicks home to Mama (${s.found.length}/${CHICKS})` };
    return { icon: '🐧', text: `Find Mama Penguin's lost chicks (${s.found.length}/${CHICKS})` };
  }
  if (stage === 'lake') return { icon: '⛸️', text: 'Ride Frost over the big lake and freeze it' };
  if (stage === 'crown') return s.crown === 'carried' ? { icon: '👑', text: 'Bring the crown to the Penguin King' } : { icon: '👑', text: "Fly to the snowy peak for the King's crown" };
  return null;
}

// What Mama and the King say right now.
export function mamaSays(s) {
  const stage = frostStage(s);
  if (stage === 'chicks') return s.found.length ? MAMA.more : MAMA.want;
  if (stage === 'lake') return MAMA.skate;
  return MAMA.party;
}

export function kingSays(s) {
  const stage = frostStage(s);
  if (stage === 'chicks' || stage === 'lake') return KING.early;
  if (stage === 'crown') return KING.want;
  return KING.after;
}

// How much of the lake is frozen (0..1). tiles: tile indexes of the lake; isIce(i) → boolean.
export function lakeFrozen(tiles, isIce) {
  if (!tiles.length) return 0;
  let n = 0;
  for (const i of tiles) if (isIce(i)) n++;
  return n / tiles.length;
}
