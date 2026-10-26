// The Crystal Forest's quests, as plain data and rules so they can be tested (GlimmerQuest.js runs
// them in the game). Three, one after another:
//   1. Luna the crystal unicorn's forest has gone dull: make the five dull crystals shine with
//      Glimmer's diamond breath.
//   2. The singing crystals in the song glade light up one by one to show a tune: walk into them in
//      the same order to sing it back.
//   3. Luna gives you the star crystal: fly it up to the top of the giant crystal tree. The forest
//      lights up, a rainbow appears, and you get sparkly rainbow footsteps.
export const CRYSTALS = 5;

export const LUNA = {
  want: 'Hello, friend! My crystals have gone dull and grey. Can Glimmer breathe her sparkly diamonds on them to make them shine?',
  more: 'They are starting to shine! Please find the other dull crystals.',
  song: 'My forest sparkles again! Now come to the song glade. Watch the singing crystals light up, then walk to them in the same order.',
  oops: 'Oops! Watch the lights and try again.',
  star: 'What a beautiful song! Here is the star crystal. Fly it up to the very top of the giant crystal tree!',
  done: 'The whole forest is glowing! Thank you! Now you leave rainbow sparkles wherever you go!',
};

export function newGlimmerState() {
  return {
    metLuna: false,
    shining: [], // crystal indexes made to shine
    sang: false, // the song played back
    star: 'luna', // 'luna' → 'carried' → 'tree'
  };
}

export function loadGlimmerState(json) {
  const base = newGlimmerState();
  try {
    const s = JSON.parse(json);
    if (!s || typeof s !== 'object') return base;
    const shining = Array.isArray(s.shining) ? [...new Set(s.shining.filter((i) => Number.isInteger(i) && i >= 0 && i < CRYSTALS))] : [];
    return { ...base, metLuna: !!s.metLuna, shining, sang: !!s.sang, star: ['luna', 'carried', 'tree'].includes(s.star) ? s.star : 'luna' };
  } catch {
    return base;
  }
}

// Which quest is going on: 'crystals', 'song', 'star' or 'done'.
export function glimmerStage(s) {
  if (s.shining.length < CRYSTALS) return 'crystals';
  if (!s.sang) return 'song';
  if (s.star !== 'tree') return 'star';
  return 'done';
}

export function applyGlimmer(s, event) {
  const q = { ...s, shining: [...s.shining] };
  switch (event.type) {
    case 'metLuna':
      q.metLuna = true;
      break;
    case 'shine':
      if (!q.shining.includes(event.index)) q.shining.push(event.index);
      break;
    case 'sang':
      if (glimmerStage(q) === 'song') q.sang = true;
      break;
    case 'star': // Luna hands it over
      if (glimmerStage(q) === 'star' && q.star === 'luna') q.star = 'carried';
      break;
    case 'starPlaced': // on top of the giant crystal tree
      if (q.star === 'carried') q.star = 'tree';
      break;
  }
  return q;
}

// The song puzzle: notes sung so far (pillar indexes) against the tune. Returns 'more' (right so
// far), 'wrong' or 'done'.
export function songStep(tune, sung) {
  for (let i = 0; i < sung.length; i++) if (sung[i] !== tune[i]) return 'wrong';
  return sung.length >= tune.length ? 'done' : 'more';
}

export function glimmerGoal(s) {
  const stage = glimmerStage(s);
  if (stage === 'crystals') {
    if (!s.metLuna) return { icon: '🦄', text: 'Find Luna the crystal unicorn' };
    return { icon: '💎', text: `Make the dull crystals shine with Glimmer (${s.shining.length}/${CRYSTALS})` };
  }
  if (stage === 'song') return { icon: '🎵', text: 'Sing the crystal song in the song glade' };
  if (stage === 'star') return s.star === 'carried' ? { icon: '⭐', text: 'Fly the star to the top of the giant crystal tree' } : { icon: '⭐', text: 'Go back to Luna for the star crystal' };
  return null;
}

export function lunaSays(s) {
  const stage = glimmerStage(s);
  if (stage === 'crystals') return s.shining.length ? LUNA.more : LUNA.want;
  if (stage === 'song') return LUNA.song;
  if (stage === 'star') return LUNA.star;
  return LUNA.done;
}
