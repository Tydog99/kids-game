// The Fire Mountains' quests, as plain data and rules so they can be tested (EmberQuest.js runs
// them in the game). Three, one after another:
//   1. Flicker the fire sprite's five friends have gone cold: warm each with Ember's fire breath.
//   2. Flicker's treasure is on an island in a river of lava, too hot for dragons to land on: cool
//      the lava into stepping stones with Frost's ice breath, then walk across for the egg.
//   3. The egg only hatches in the volcano's heat: carry it up to the crater and breathe fire on it
//      with Ember. Out comes a baby dragon to name, who follows you everywhere.
export const SPRITES = 5;

export const FLICKER = {
  want: 'Oh no! My fire sprite friends have gone cold and sleepy. Can Ember breathe fire to warm them up?',
  more: 'You warmed some of my friends! Please find the others. They look grey and sleepy.',
  thanks: "Hooray! We're all warm again! Let's dance!",
  river: "I have a secret treasure on the island in the lava river. Dragons can't land there, it's too hot! Can Frost make stepping stones?",
  egg: 'You found it! That is a fire dragon egg. It needs the heat of the volcano to hatch. Fly it up to the crater!',
  done: 'Your baby dragon is so cute! Come and dance with us any time!',
};

export function newEmberState() {
  return {
    metFlicker: false,
    warm: [], // sprite indexes warmed up
    stones: [], // lava tiles cooled into stepping stones
    egg: 'island', // 'island' → 'carried' → 'crater' → 'hatched'
    babyName: null,
  };
}

export function loadEmberState(json) {
  const base = newEmberState();
  try {
    const s = JSON.parse(json);
    if (!s || typeof s !== 'object') return base;
    const ints = (a, max = Infinity) => (Array.isArray(a) ? [...new Set(a.filter((i) => Number.isInteger(i) && i >= 0 && i < max))] : []);
    return {
      ...base,
      metFlicker: !!s.metFlicker,
      warm: ints(s.warm, SPRITES),
      stones: ints(s.stones),
      egg: ['island', 'carried', 'crater', 'hatched'].includes(s.egg) ? s.egg : 'island',
      babyName: typeof s.babyName === 'string' && s.babyName ? s.babyName.slice(0, 16) : null,
    };
  } catch {
    return base;
  }
}

// Which quest is going on: 'sprites', 'river', 'hatch' or 'done'.
export function emberStage(s) {
  if (s.warm.length < SPRITES) return 'sprites';
  if (s.egg === 'island') return 'river';
  if (s.egg !== 'hatched') return 'hatch';
  return 'done';
}

export function applyEmber(s, event) {
  const q = { ...s, warm: [...s.warm], stones: [...s.stones] };
  switch (event.type) {
    case 'metFlicker':
      q.metFlicker = true;
      break;
    case 'warm': // a sleepy sprite got Ember's fire
      if (!q.warm.includes(event.index)) q.warm.push(event.index);
      break;
    case 'stone': // ice breath cooled a lava tile
      if (!q.stones.includes(event.tile)) q.stones.push(event.tile);
      break;
    case 'egg': // picked up from the island (only once the sprites are warm)
      if (emberStage(q) === 'river') q.egg = 'carried';
      break;
    case 'eggSet': // set down at the crater
      if (q.egg === 'carried') q.egg = 'crater';
      break;
    case 'hatch': // Ember's fire on the egg in the crater
      if (q.egg === 'crater') q.egg = 'hatched';
      break;
    case 'name':
      q.babyName = event.name;
      break;
  }
  return q;
}

// The goal for the quest tracker while you're in the Fire Mountains, or null when all done.
export function emberGoal(s) {
  const stage = emberStage(s);
  if (stage === 'sprites') {
    if (!s.metFlicker) return { icon: '🔥', text: 'Find Flicker the fire sprite' };
    return { icon: '🔥', text: `Warm up the sleepy fire sprites with Ember (${s.warm.length}/${SPRITES})` };
  }
  if (stage === 'river') return { icon: '🪨', text: 'Make stepping stones with Frost to reach the island' };
  if (stage === 'hatch') return s.egg === 'carried' ? { icon: '🌋', text: "Carry the egg up to the volcano's crater" } : { icon: '🥚', text: 'Breathe fire on the egg with Ember' };
  return null;
}

export function flickerSays(s) {
  const stage = emberStage(s);
  if (stage === 'sprites') return s.warm.length ? FLICKER.more : FLICKER.want;
  if (stage === 'river') return FLICKER.river;
  if (stage === 'hatch') return FLICKER.egg;
  return FLICKER.done;
}
