// Adventure mode ("The Dragon Keeper"): the story, as plain data and rules so it can be tested.
//
// Chapter 1, 'treasure': Grandpa Ollie lost the 3 golden keys to his treasure chest. Dragons only
//   fly overhead; they can't be reached yet.
// Chapter 2, 'dragons': opening the chest finds the Dragon Book, and the three dragons (Ember,
//   Glimmer, Frost) land around the world. Each one needs something before it will trust you.
// The adventure is finished once all three dragons are your friends.

export const CHAPTERS = ['treasure', 'dragons', 'done'];

// What each dragon needs before it trusts you.
export const DRAGON_NEEDS = {
  ember: { icon: '🥚', want: 'I lost my egg! Can you find it in the forest?', short: 'Find Ember’s lost egg' },
  glimmer: { icon: '💎', want: 'I love shiny things! Can you bring me 5 sparkly gems?', short: 'Bring Glimmer 5 sparkly gems' },
  frost: { icon: '🌸', want: 'Please bring me a moon flower. It only blooms at night, by a lake.', short: 'Bring Frost a moon flower' },
};

export function newProgress() {
  return {
    chapter: 'treasure',
    keys: [], // indexes of the keys found
    chestOpen: false,
    sawDragon: false, // the "was that a dragon?!" moment happened
    landed: false, // the dragons have come down
    quests: {}, // kind → true once that dragon's quest is done
    friends: {}, // kind → name, once befriended
  };
}

// Read saved progress, tolerating anything missing or broken.
export function loadProgress(json) {
  const base = newProgress();
  try {
    const p = JSON.parse(json);
    if (!p || typeof p !== 'object') return base;
    return {
      ...base,
      ...p,
      chapter: CHAPTERS.includes(p.chapter) ? p.chapter : base.chapter,
      keys: Array.isArray(p.keys) ? p.keys.filter((k) => Number.isInteger(k) && k >= 0 && k < 3) : [],
      quests: { ...(p.quests ?? {}) },
      friends: { ...(p.friends ?? {}) },
    };
  } catch {
    return base;
  }
}

// The one thing to do next, for the quest tracker.
export function nextGoal(p) {
  if (p.chapter === 'treasure') {
    if (p.keys.length < 3) return { icon: '🔑', text: `Find Grandpa Ollie's keys (${p.keys.length}/3)` };
    return { icon: '🧰', text: 'Open the treasure chest' };
  }
  const friends = Object.keys(p.friends).length;
  if (p.chapter === 'dragons') return { icon: '🐉', text: `Make friends with the dragons (${friends}/3)` };
  return { icon: '🏆', text: 'You are a Dragon Keeper!' };
}

// What Grandpa Ollie says right now.
export function ollieSays(p) {
  if (p.chapter === 'treasure') {
    const n = p.keys.length;
    if (n === 0) return 'Oh no! I lost my 3 golden keys! Can you find them? Look for the golden lights in the sky!';
    if (n < 3) return `You found ${n === 1 ? 'one key' : 'two keys'}! Keep looking. Follow the golden lights!`;
    return 'You found all my keys! Now touch the treasure chest to open it!';
  }
  if (p.chapter === 'dragons' && !p.landed) return 'My old Dragon Book! Look up! The dragons are coming down to land!';
  if (p.chapter === 'dragons') {
    return 'The dragons have landed! Walk up to a dragon and press E to look at it in your Dragon Book. Each one needs your help.';
  }
  return 'You made friends with every dragon. You are a real Dragon Keeper!';
}

// Apply something that happened. Returns the new progress (never changes the old one).
export function apply(p, event) {
  const q = { ...p, keys: [...p.keys], quests: { ...p.quests }, friends: { ...p.friends } };
  switch (event.type) {
    case 'key':
      if (q.chapter === 'treasure' && !q.keys.includes(event.index)) q.keys.push(event.index);
      break;
    case 'chestOpened':
      if (q.chapter === 'treasure' && q.keys.length >= 3) {
        q.chestOpen = true;
        q.chapter = 'dragons';
      }
      break;
    case 'sawDragon':
      q.sawDragon = true;
      break;
    case 'landed':
      q.landed = true;
      break;
    case 'questDone':
      q.quests[event.kind] = true;
      break;
    case 'befriended':
      q.friends[event.kind] = event.name;
      if (Object.keys(q.friends).length >= 3) q.chapter = 'done';
      break;
    case 'skip': // grown-up shortcut: jump to the next step
      if (q.chapter === 'treasure') {
        q.keys = [0, 1, 2];
        q.chestOpen = true;
        q.sawDragon = true;
        q.chapter = 'dragons';
      } else if (q.chapter === 'dragons') {
        const kind = ['ember', 'glimmer', 'frost'].find((k) => !q.quests[k]);
        if (kind) q.quests[kind] = true;
      }
      break;
  }
  return q;
}

// Can this dragon be ridden / befriended yet?
export const dragonsCanLand = (p) => p.chapter !== 'treasure';
export const canBefriend = (p, kind) => p.chapter !== 'treasure' && !!p.quests[kind];
