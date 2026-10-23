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
    accepted: {}, // kind → true once you've looked at that dragon in the Dragon Book
    carrying: null, // 'egg' or 'flower' while carried
    egg: false, // picked up (and maybe delivered)
    flower: false,
    gems: [], // indexes of the gems found
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
      accepted: { ...(p.accepted ?? {}) },
      carrying: ['egg', 'flower'].includes(p.carrying) ? p.carrying : null,
      gems: Array.isArray(p.gems) ? p.gems.filter((g) => Number.isInteger(g) && g >= 0 && g < 5) : [],
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
  if (p.chapter === 'dragons') {
    if (p.carrying === 'egg') return { icon: '🥚', text: 'Bring the egg back to Ember' };
    if (p.carrying === 'flower') return { icon: '🌸', text: 'Bring the moon flower to Frost' };
    if (p.accepted.glimmer && !p.quests.glimmer) {
      if (p.gems.length >= 5) return { icon: '💎', text: 'Bring the 5 gems to Glimmer' };
      if (p.gems.length > 0) return { icon: '💎', text: `Find sparkly gems (${p.gems.length}/5)` };
    }
    // a dragon that's been helped and now just needs you close by
    const ready = KINDS.find((k) => p.quests[k] && !p.friends[k]);
    if (ready) return { icon: '💛', text: `Stay close to ${NAMES[ready]} so it trusts you` };
    if (p.accepted.ember && !p.egg) return { icon: '🥚', text: "Find Ember's egg in the forest" };
    if (p.accepted.glimmer && !p.quests.glimmer) return { icon: '💎', text: 'Find sparkly gems (0/5)' };
    if (p.accepted.frost && !p.flower) return { icon: '🌸', text: 'Find the moon flower by a lake, at night' };
    return { icon: '🐉', text: `Make friends with the dragons (${friends}/3)` };
  }
  return { icon: '🏆', text: 'You are a Dragon Keeper!' };
}

const KINDS = ['ember', 'glimmer', 'frost'];
const NAMES = { ember: 'Ember', glimmer: 'Glimmer', frost: 'Frost' };
const ITEM_OWNER = { egg: 'ember', flower: 'frost' };

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
    if (!KINDS.some((k) => p.accepted[k])) return 'The dragons have landed! Walk up to a dragon and press E to look at it in your Dragon Book. Each one needs your help.';
    return 'Follow the colored lights to find what the dragons need. You can do it!';
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
    case 'accept':
      if (q.chapter === 'dragons') q.accepted[event.kind] = true;
      break;
    case 'pickUp': // the egg or the moon flower; you can carry one thing at a time
      if (!q.carrying && !q[event.item]) {
        q[event.item] = true;
        q.carrying = event.item;
      }
      break;
    case 'gem':
      if (!q.gems.includes(event.index)) q.gems.push(event.index);
      break;
    case 'deliver': {
      // bring what a dragon needs: kind is the dragon you're next to
      const k = event.kind;
      if (q.quests[k]) break;
      if (q.carrying && ITEM_OWNER[q.carrying] === k) {
        q.carrying = null;
        q.quests[k] = true;
      } else if (k === 'glimmer' && q.gems.length >= 5) q.quests[k] = true;
      break;
    }
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
        const kind = KINDS.find((k) => !q.quests[k]);
        if (kind) {
          q.quests[kind] = true;
          q.accepted[kind] = true;
          if (q.carrying && ITEM_OWNER[q.carrying] === kind) q.carrying = null;
        }
      }
      break;
  }
  return q;
}

// Can this dragon be ridden / befriended yet?
export const dragonsCanLand = (p) => p.chapter !== 'treasure';
export const canBefriend = (p, kind) => p.chapter !== 'treasure' && !!p.quests[kind];
