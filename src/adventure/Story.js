// Runs Adventure mode inside a Game: Grandpa Ollie, the treasure chapter with sky-only dragons,
// the dragons landing, the Dragon Book, and saving progress for this world.
import { loadProgress, apply, nextGoal, ollieSays, canBefriend, progressAt } from './adventure.js';
import { Villager } from './Villager.js';
import { placeQuestItems } from './questItems.js';
import { QuestItemsView } from './QuestItemsView.js';
import { BookView } from './BookView.js';
import { DragonReveal } from './DragonReveal.js';
import { LandingShot } from './LandingShot.js';
import { Race } from '../race/Race.js';
import { Village } from './Village.js';
import { openDragonBook } from '../ui/DragonBook.js';
import { DRAGONS } from '../creatures/dragonModels.js';
import { speak, speakLine } from '../ui/speak.js';
import { load, save } from '../ui/storage.js';
import { DIRS } from '../worldgen.js';

const GROUND = 0.25;
const TALK_RANGE = 4.5; // Ollie's speech shows when the player is this close
const LOOK_RANGE = 2.2; // how close to a dragon's body to look at it with E
const BEAM = { ember: '#ff8a4a', glimmer: '#7af0c8', frost: '#9fdcff' };
const LATER = ['race', 'village', 'done']; // chapters after the dragons are all friends
const REVEAL_ORDER = ['ember', 'glimmer', 'frost']; // one more dragon shows up with each key
const REVEAL = {
  ember: { banner: 'Whoa! A fire dragon! 🔥' },
  glimmer: { banner: 'Wow! A sparkly diamond dragon! 💎' },
  frost: { banner: 'Look! An icy snow dragon! ❄️' },
};
const COLOR_WORD = { ember: 'orange', glimmer: 'green', frost: 'blue' };
const PICK_RANGE = 0.85; // how close to an item to pick it up
const BOOK_RANGE = 1.0; // how close to the Dragon Book to pick it up
const UNBOXING = 7; // seconds from the chest opening to the Dragon Book popping out (5 of coins, then a pause)
const GIVE_RANGE = 2.8; // how close to a dragon's body to hand it something

export class Story {
  constructor(game) {
    this.g = game;
    this.key = `adventure:${game.world.seed}`;
    this.p = loadProgress(load(this.key, ''));
    const { hunt, treasureView } = game;

    // restore the treasure hunt as it was left
    this.p.keys.forEach((i) => hunt.keys[i] && (hunt.keys[i].collected = true));
    hunt.chest.open = this.p.chestOpen;
    treasureView.restore();

    // Grandpa Ollie stands beside his chest, where the player can see him from the start
    const spot = this.olliesSpot();
    this.ollie = new Villager(game.scene, spot.x, spot.z);

    // exactly three dragons: one Ember, one Glimmer, one Frost
    const ds = game.dragons;
    ds.setCount(3);
    ds.setNames(Object.fromEntries(ds.list.filter((d) => this.p.friends[d.kind]).map((d) => [d.index, this.p.friends[d.kind]])));
    this.markers = new Map();
    for (const d of ds.list) {
      d.restSpot = { x: ds.spots[d.index].x + 0.5, z: ds.spots[d.index].z + 0.5 };
      if (!this.p.hasBook) {
        // up in the sky until the Dragon Book is found; each one appears when a key is found
        d.hidden = this.p.chapter === 'treasure' && REVEAL_ORDER.indexOf(d.kind) >= this.p.keys.length;
        d.skyOnly = true;
        d.flight = null;
        d.y = GROUND + 7 + d.index * 1.5;
      } else if (!d.trusted) this.rest(d);
    }
    // the dragons' quest items, placed away from the chest, Ollie and the dragons' resting spots
    const c = hunt.chest;
    this.items = placeQuestItems(game.world, game.startTile(), [
      { x: c.x, z: c.z, solid: true },
      { x: Math.floor(spot.x), z: Math.floor(spot.z) },
      ...ds.list.map((d) => ({ x: Math.floor(d.restSpot.x), z: Math.floor(d.restSpot.z) })),
    ]);
    this.itemsView = new QuestItemsView(game.scene, this.items);
    this.itemMarkers = new Map(); // 'egg' | 'flower' | 'gem3' → beam
    this.nagUntil = 0;
    this.time = 0;

    this.landingAt = null;
    this.unboxing = null; // counts down after the chest opens, until the Dragon Book pops out
    this.holdSpeech = 0; // keeps a line Ollie just said up for a while
    this.book = new BookView(game.scene);
    if (this.p.chestOpen && !this.p.hasBook) {
      const st = game.startTile();
      this.book.show(this.bookSpot({ x: st.x + 0.5, z: st.z + 0.5 }));
    }
    this.speechShown = null;
    this.heard = new Set(); // what Ollie has already said by himself this time
    this.intro = 6; // seconds Ollie's first words stay up wherever the player is
    this.refresh();
    game.hud.showGrownUp({ onSkip: () => this.skip(), onReset: () => this.reset(), onJump: (chapter) => this.jumpTo(chapter) });
    if (this.p.hasBook) game.hud.showBookButton(() => this.openBook());
    // the dragon lands already opened (one for each dragon friend), and beams over unfound nests
    this.nestMarkers = new Map();
    for (const kind of REVEAL_ORDER) if (this.p.friends[kind]) this.openLand(kind, false);
    if (LATER.includes(this.p.chapter)) this.startRace();
    if (this.p.chapter === 'village' || this.p.chapter === 'done') this.startVillage();
  }

  // Things the player can't walk through: Ollie, and the villagers and their things.
  obstacles() {
    return [this.ollie.obstacle, ...(this.village?.obstacles ?? [])];
  }

  // ---- the dragon lands beyond the map ----

  // Open a dragon's land (its gate), with a beam over its nest until the nest is found.
  openLand(kind, animate = true) {
    this.g.realms.unlock(kind, animate);
    const land = this.g.world.realms?.find((r) => r.kind === kind);
    if (land && !this.p.nests[kind] && !this.nestMarkers.has(kind)) {
      this.nestMarkers.set(kind, this.g.treasureView.addMarker(Math.floor(land.nest.x), Math.floor(land.nest.z), BEAM[kind]));
    }
  }

  onLockedGate(kind) {
    this.nag(`This way is closed. Make friends with ${DRAGONS[kind].name} to open it!`);
  }

  onNest(kind) {
    const name = DRAGONS[kind].name;
    if (this.p.nests[kind]) return this.g.hud.showBanner(`${name}'s nest 🥚`);
    this.set({ type: 'nest', kind });
    const m = this.nestMarkers.get(kind);
    if (m) this.g.treasureView.removeMarker(m);
    this.nestMarkers.delete(kind);
    this.g.hud.showBanner(`You found ${name}'s nest! 🥚`, true);
    speakLine(`n_nest_${kind}`);
  }

  // ---- chapter 3: the Sky Pitch race ----

  startRace() {
    if (this.race) return;
    const spot = this.ringSpot();
    this.race = new Race(this.g, spot, {
      bestTime: this.p.bestTime,
      nag: (text) => this.nag(text),
      onFinish: (time) => {
        this.firstRace = this.p.chapter === 'race';
        this.set({ type: 'raceDone', time });
      },
      onHome: () => this.onRaceHome(),
    });
  }

  // Grandpa Ollie's magic ring floats over open ground a little way from his chest.
  ringSpot() {
    const { chest } = this.g.hunt;
    const cx = chest.x + 0.5, cz = chest.z + 0.5;
    const open = (x, z) => this.g.walkable(x, z) === true;
    const clear = (tx, tz) => {
      for (let z = tz - 3; z <= tz + 3; z++) for (let x = tx - 3; x <= tx + 3; x++) if (!open(x, z)) return false;
      return true;
    };
    for (const r of [8, 10, 7, 12, 14, 17, 20]) {
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const tx = Math.floor(cx + Math.sin(a) * r), tz = Math.floor(cz + Math.cos(a) * r);
        if (!clear(tx, tz) || Math.hypot(tx + 0.5 - this.ollie.x, tz + 0.5 - this.ollie.z) < 4) continue;
        return { x: tx + 0.5, z: tz + 0.5, heading: Math.atan2(tx + 0.5 - cx, tz + 0.5 - cz) };
      }
    }
    return { x: cx + 6, z: cz, heading: Math.PI / 2 };
  }

  // Back from the Sky Pitch: after the first race, the village chapter begins.
  onRaceHome() {
    if (!this.firstRace) return;
    this.firstRace = false;
    if (this.raceMarker) this.g.treasureView.removeMarker(this.raceMarker);
    this.raceMarker = null;
    this.startVillage();
    this.say(ollieSays(this.p), true);
    this.holdSpeech = 8;
  }

  // ---- chapter 4: helping the villagers ----

  startVillage() {
    if (this.village) return;
    this.village = new Village(this.g, this.p, {
      story: this,
      onHelped: (kind) => {
        this.set({ type: 'helped', kind });
        this.village.progress = this.p;
        if (this.p.chapter === 'done') this.finale();
      },
      nag: (text) => this.nag(text),
    });
  }

  finale() {
    setTimeout(() => {
      this.g.hud.showBanner('You helped everyone! Best Dragon Keeper ever! 🏆', true);
      speakLine('n_finale');
      this.celebrate = 10; // Ollie jumps for joy
    }, 3500);
  }

  // Where the Dragon Book lands: beside the chest (not hidden behind it), as seen from `from`, a world position.
  bookSpot(from) {
    const { chest } = this.g.hunt;
    const cx = chest.x + 0.5, cz = chest.z + 0.5;
    const base = Math.atan2(cz - from.z, cx - from.x);
    for (const off of [1.6, -1.6, 1.25, -1.25, 2, -2, 0.9, -0.9, 0, 2.6, -2.6]) {
      for (const r of [1.8, 1.4, 2.3]) {
        const x = cx + Math.cos(base + off) * r, z = cz + Math.sin(base + off) * r;
        if (this.g.walkable(Math.floor(x), Math.floor(z)) === true && Math.hypot(x - this.ollie.x, z - this.ollie.z) > 1) return { x, z };
      }
    }
    return { x: cx, z: cz + 1.5 };
  }

  // Ollie stands in front of the player, level with the chest but on the other side of the
  // path, so the opening view shows the chest on one side and Ollie on the other.
  olliesSpot() {
    const { chest } = this.g.hunt;
    const start = this.g.startTile();
    const [fx, fz] = DIRS[start.facing];
    const [rx, rz] = DIRS[(start.facing + 1) % 4];
    const sx = start.x + 0.5, sz = start.z + 0.5;
    const ahead = (chest.x + 0.5 - sx) * fx + (chest.z + 0.5 - sz) * fz;
    const chestSide = Math.sign((chest.x + 0.5 - sx) * rx + (chest.z + 0.5 - sz) * rz) || 1;
    const open = (x, z) => this.g.walkable(Math.floor(x), Math.floor(z)) === true;
    for (const a of [ahead, ahead + 1, ahead - 1, ahead + 2])
      for (const w of [1.5, 2.5, 1.2, 3.5]) {
        const x = sx + fx * a - rx * chestSide * w, z = sz + fz * a - rz * chestSide * w;
        if (open(x, z) && Math.hypot(x - chest.x - 0.5, z - chest.z - 0.5) > 1.2) return { x, z };
      }
    // no room on the other side: stand beside the chest
    return { x: chest.x + 0.5 + rx * chestSide * 1.5, z: chest.z + 0.5 + rz * chestSide * 1.5 };
  }

  // A dragon sits at its resting spot, marked with a beam until it becomes your friend.
  rest(d) {
    d.skyOnly = false;
    d.flight = null;
    d.summon = null;
    d.x = d.restSpot.x;
    d.z = d.restSpot.z;
    d.y = GROUND;
    d.waiting = Infinity;
    d.dragon.setMode('sit');
    this.mark(d);
  }

  mark(d) {
    if (d.trusted || this.markers.has(d.index)) return;
    this.markers.set(d.index, this.g.treasureView.addMarker(d.restSpot.x - 0.5, d.restSpot.z - 0.5, BEAM[d.kind]));
  }

  unmark(d) {
    const m = this.markers.get(d.index);
    if (m) this.g.treasureView.removeMarker(m);
    this.markers.delete(d.index);
  }

  set(event) {
    this.p = apply(this.p, event);
    save(this.key, JSON.stringify(this.p));
    this.refresh();
  }

  refresh() {
    this.g.hud.showGoal(nextGoal(this.p));
  }

  // ---- hooks from the game ----

  onHuntEvent(e) {
    if (e.type === 'key') {
      this.set({ type: 'key', index: this.g.hunt.keys.indexOf(e.key) });
      if (this.p.chapter === 'treasure') this.revealDragon(REVEAL_ORDER[this.p.keys.length - 1]);
    }
    if (e.type === 'open') {
      this.set({ type: 'chestOpened' });
      // enjoy the treasure; then Ollie spots something else in the chest
      this.unboxing = UNBOXING;
      this.speechShown = null;
      this.g.hud.showSpeech(null);
    }
  }

  // A key was found: show the player one of the dragons, swooping in from far away.
  revealDragon(kind) {
    const d = this.g.dragons.list.find((d) => d.kind === kind);
    if (!d || this.g.riding) {
      if (d) d.hidden = false;
      return;
    }
    const { x, z, heading } = this.g.playerInfo();
    this.g.cutscene = new DragonReveal(d, { x, z }, heading, {
      onSee: () => {
        this.set({ type: 'sawDragon' });
        this.g.hud.showBanner(REVEAL[d.kind].banner, true);
        speakLine(`n_see_${d.kind}`);
      },
      onDone: () => {
        if (this.p.keys.length >= 3) this.g.hud.showBanner('All 3 keys! Head back to the treasure chest', true);
      },
    });
  }

  // The dragon at hand can't start trusting the player until its quest is done.
  canBefriend(d) {
    return canBefriend(this.p, d.kind);
  }

  trustHint(d) {
    return this.p.chapter === 'treasure' ? null : `${DRAGONS[d.kind].name} needs your help first. Press E to look.`;
  }

  onBefriend(d, name) {
    this.unmark(d);
    this.set({ type: 'befriended', kind: d.kind, name });
    // a new friend opens the way to their land
    this.openLand(d.kind);
    const land = this.g.world.realms?.find((r) => r.kind === d.kind);
    const announce = () => land && this.g.hud.showBanner(`A new land is open: ${land.name}! ${land.icon}`, true);
    if (this.p.chapter === 'race') {
      setTimeout(() => {
        this.g.hud.showBanner('You are a real Dragon Keeper! 🏆', true);
        speakLine(['n_keeper', `n_open_${d.kind}`, 'n_race_call']);
        this.startRace();
      }, 2500);
      setTimeout(announce, 6500);
    } else {
      setTimeout(() => {
        announce();
        speakLine(`n_open_${d.kind}`);
      }, 3000);
    }
  }

  // Something to look at with E: a dragon that isn't your friend yet, or Ollie.
  examinable() {
    if (!this.p.hasBook) return null;
    const { x, z } = this.g.playerInfo();
    for (const d of this.g.dragons.list) if (!d.trusted && d.grounded && !d.summon && d.distanceTo(x, z) < LOOK_RANGE) return d;
    return null;
  }

  nearOllie() {
    const { x, z } = this.g.playerInfo();
    return Math.hypot(x - this.ollie.x, z - this.ollie.z) < 2.2;
  }

  // Looking at a dragon with E: its page in the Dragon Book, and its quest starts.
  examine(d) {
    if (!this.p.accepted[d.kind]) {
      this.set({ type: 'accept', kind: d.kind });
      setTimeout(() => this.g.hud.showBanner(`Follow the ${COLOR_WORD[d.kind]} lights!`, true), 400);
    }
    // giving it what it needs, if you have it
    this.tryDeliver(d);
    this.openBook(d.kind);
  }

  openBook(kind) {
    const status = (d) => {
      if (d.trusted) return 'Your friend 💛';
      if (this.p.chapter === 'treasure') return 'Flying high in the sky…';
      if (d.summon) return 'Flying down to land…';
      return 'Resting. Follow the colored light to find it.';
    };
    this.g.modal = true; // the game waits while the book is open
    openDragonBook({
      dragons: this.g.dragons.list.map((d) => ({ kind: d.kind, status: status(d) })),
      progress: this.p,
      start: kind,
      onClose: () => (this.g.modal = false),
    });
  }

  // Pressing E next to Ollie: hear him again.
  // Someone close enough to talk to with E (Ollie or a villager): { name, talk() }, or null.
  talker() {
    if (this.nearOllie()) return { name: 'Grandpa Ollie', talk: () => this.talk() };
    return this.village?.talker() ?? null;
  }

  talk() {
    this.say(ollieSays(this.p), true);
  }

  say(text, force = false) {
    if (this.speechShown === text && !force) return;
    this.speechShown = text;
    this.heard.add(text);
    this.g.hud.showSpeech({ who: 'Grandpa Ollie', text, onRead: () => speak(text) });
    speak(text);
  }

  // ---- the dragon quests ----

  tryDeliver(d) {
    if (this.p.quests[d.kind]) return false;
    const next = apply(this.p, { type: 'deliver', kind: d.kind });
    if (!next.quests[d.kind]) return false;
    this.p = next;
    save(this.key, JSON.stringify(this.p));
    this.refresh();
    const name = DRAGONS[d.kind].name;
    this.g.hud.showBanner(`${name} is so happy! 💛`, true);
    speakLine([`${d.kind}_thanks`, `n_trust_${d.kind}`]); // the dragon says thank you, then a hint
    d.dragon.setMode('rear');
    setTimeout(() => d.dragon.setMode('sit'), 1800);
    return true;
  }

  nag(text) {
    const now = performance.now();
    if (now < this.nagUntil) return;
    this.nagUntil = now + 5000;
    this.g.hud.showBanner(text, true);
    speak(text);
  }

  updateQuests(player) {
    const p = this.p;
    if (p.chapter !== 'dragons') return this.itemsView.update(0, this.time, {}, 0, this.g.player.character.root);
    const night = this.g.dayCycle.state?.stars ?? 0;
    const at = (o) => Math.hypot(player.x - o.x - 0.5, player.z - o.z - 0.5);

    if (p.accepted.ember && !p.egg && at(this.items.egg) < PICK_RANGE) {
      if (p.carrying) this.nag('Your hands are full! Deliver what you are carrying first.');
      else {
        this.set({ type: 'pickUp', item: 'egg' });
        this.g.hud.showBanner("You found Ember's egg! 🥚", true);
        speak("You found Ember's egg! Carry it back to Ember.");
      }
    }
    if (p.accepted.glimmer && !p.quests.glimmer) {
      this.items.gems.forEach((g, i) => {
        if (this.p.gems.includes(i) || at(g) >= PICK_RANGE) return;
        this.set({ type: 'gem', index: i });
        const n = this.p.gems.length;
        this.g.hud.showBanner(n < 5 ? `Sparkly gem ${n} of 5! 💎` : 'All 5 gems! Bring them to Glimmer 💎', true);
        speak(n < 5 ? `Sparkly gem ${n} of 5!` : 'You found all 5 gems! Bring them to Glimmer.');
      });
    }
    if (p.accepted.frost && !p.flower && at(this.items.flower) < PICK_RANGE + 0.2) {
      if (night < 0.5) this.nag('The moon flower is still asleep. Come back at night! 🌙');
      else if (p.carrying) this.nag('Your hands are full! Deliver what you are carrying first.');
      else {
        this.set({ type: 'pickUp', item: 'flower' });
        this.g.hud.showBanner('You picked the moon flower! 🌸', true);
        speak('You picked the moon flower! Bring it to Frost.');
      }
    }
    // walking up to a dragon with what it needs hands it over
    for (const d of this.g.dragons.list) if (!d.trusted && d.grounded && d.distanceTo(player.x, player.z) < GIVE_RANGE) this.tryDeliver(d);

    this.syncItemMarkers();
    const q = this.p;
    this.itemsView.update(0, this.time, {
      egg: q.egg,
      flower: q.flower,
      gems: q.gems,
      carrying: q.carrying,
      showEgg: !!q.accepted.ember,
      showGems: !!q.accepted.glimmer && !q.quests.glimmer,
      showFlower: !!q.accepted.frost,
    }, night, this.g.player.character.root);
    this.g.player.character.carrying = !!q.carrying;
  }

  // A beam of light over each item still to find, in its dragon's color.
  syncItemMarkers() {
    const p = this.p, want = new Map();
    if (p.accepted.ember && !p.egg) want.set('egg', [this.items.egg, BEAM.ember]);
    if (p.accepted.frost && !p.flower) want.set('flower', [this.items.flower, BEAM.frost]);
    if (p.accepted.glimmer && !p.quests.glimmer) this.items.gems.forEach((g, i) => !p.gems.includes(i) && want.set(`gem${i}`, [g, BEAM.glimmer]));
    for (const [k, beam] of this.itemMarkers) {
      if (want.has(k)) continue;
      this.g.treasureView.removeMarker(beam);
      this.itemMarkers.delete(k);
    }
    for (const [k, [pos, color]] of want) if (!this.itemMarkers.has(k)) this.itemMarkers.set(k, this.g.treasureView.addMarker(pos.x, pos.z, color));
  }

  // Grown-up shortcut.
  skip() {
    if (this.p.chapter === 'treasure') return this.skipToTreasure();
    if (this.p.chapter === 'race' || this.p.chapter === 'village') {
      const before = this.p.chapter;
      this.set({ type: 'skip' });
      if (before === 'race') {
        this.firstRace = true;
        this.onRaceHome();
        return this.g.hud.showBanner('Skipped: the race', true);
      }
      this.village.progress = this.p;
      this.village.sync();
      if (this.p.chapter === 'done') this.finale();
      return this.g.hud.showBanner('Skipped: one villager helped', true);
    }
    const hadBook = this.p.hasBook;
    this.set({ type: 'skip' });
    if (!hadBook) {
      this.unboxing = null;
      this.book.hide();
      this.g.hud.showBookButton(() => this.openBook());
      this.landingAt = 0.1;
    }
    this.g.hud.showBanner(!hadBook ? 'Skipped to: the dragons land' : 'Skipped: one dragon quest done', true);
  }

  // Skipping the key hunt still plays Ollie's reward: all the keys are found, the player is put
  // back in front of the chest, and it opens just as if they'd walked up to it.
  skipToTreasure() {
    const { hunt, treasureView, player } = this.g;
    hunt.keys.forEach((k, i) => {
      k.collected = true;
      this.set({ type: 'key', index: i });
    });
    this.g.cutscene?.cancel();
    this.g.cutscene = null;
    for (const d of this.g.dragons.list) d.hidden = false;
    treasureView.restore();
    if (!this.g.riding) {
      const st = this.g.startTile(), m = player.motor, c = hunt.chest;
      m.px = st.x + 0.5;
      m.pz = st.z + 0.5;
      m.yaw = Math.atan2(c.x + 0.5 - m.px, c.z + 0.5 - m.pz);
    }
    hunt.chest.open = true;
    treasureView.open();
    this.g.hud.showBanner('You opened the treasure!', true);
    this.onHuntEvent({ type: 'open' });
  }

  // Grown-up shortcut: start this world over at the beginning of a chapter.
  jumpTo(chapter) {
    save(this.key, JSON.stringify(progressAt(chapter, this.p.friends)));
    save(this.g.namesKey, '{}');
    this.g.restart();
  }

  reset() {
    save(this.key, '');
    save(this.g.namesKey, '{}');
    location.reload();
  }

  update(dt, t) {
    this.time = t;
    const player = this.g.playerInfo();
    this.updateQuests(player);
    // Ollie talks when you're near him (and at the very start)
    this.intro -= dt;
    const near = Math.hypot(player.x - this.ollie.x, player.z - this.ollie.z) < TALK_RANGE;
    this.holdSpeech -= dt;
    if (this.g.cutscene && this.speechShown) {
      // out of the way while a dragon is shown
      this.speechShown = null;
      this.g.hud.showSpeech(null);
    } else if (this.g.cutscene || this.unboxing !== null || this.holdSpeech > 0) {
      // quiet while the treasure pours out; then his line about the book stays up a while
    } else if ((near || this.intro > 0) && !this.g.riding) {
      // each line once by itself, the first time it comes up; after that, press E to hear it again
      const text = ollieSays(this.p);
      if (this.speechShown !== text && !this.heard.has(text)) this.say(text);
    } else if (this.speechShown) {
      this.speechShown = null;
      this.g.hud.showSpeech(null);
    }
    this.celebrate = (this.celebrate ?? 0) - dt;
    this.ollie.cheering = (this.unboxing !== null && this.unboxing > UNBOXING - 5) || this.celebrate > 0;
    this.ollie.update(dt, t, player, !!this.speechShown);
    this.updateBook(dt, t, player);
    this.race?.update(dt, t);
    this.village?.update(dt, t);

    // once the Dragon Book is found, the dragons fly down to their resting spots
    if (this.landingAt !== null) {
      this.landingAt -= dt;
      if (this.landingAt <= 0) {
        this.landingAt = null;
        const waiting = this.g.dragons.list.filter((d) => !d.trusted);
        for (const d of waiting) d.hidden = false;
        if (this.watchLanding && waiting.length && !this.g.riding) {
          // the camera visits each dragon's spot in turn and watches it land
          const { x, z, heading } = this.g.playerInfo();
          const inOrder = REVEAL_ORDER.map((k) => waiting.find((d) => d.kind === k)).filter(Boolean);
          this.g.cutscene = new LandingShot(inOrder, { x, z }, heading, this.g.scene, (d, from) => {
            if (from) {
              d.x = from.x;
              d.y = from.y;
              d.z = from.z;
              d.heading = Math.atan2(d.restSpot.x - from.x, d.restSpot.z - from.z);
            }
            d.flyTo(d.restSpot);
            this.mark(d);
            if (from) this.g.hud.showBanner(`${DRAGONS[d.kind].name} is landing!`, true);
          });
          this.g.hud.showBanner('Look! The dragons are landing!', true);
        } else {
          for (const d of waiting) {
            d.flyTo(d.restSpot);
            this.mark(d);
          }
          this.g.hud.showBanner('Look! The dragons are landing!', true);
        }
        this.watchLanding = false;
      }
    }
    if (!this.p.landed && this.p.hasBook && this.g.dragons.list.every((d) => d.trusted || (d.grounded && !d.summon))) {
      this.set({ type: 'landed' });
    }
  }

  // After the chest opens: the treasure pours out, a pause, then Ollie spots his Dragon Book in
  // the chest and it pops out onto the ground. Picking it up brings the dragons down.
  updateBook(dt, t, player) {
    if (this.unboxing !== null) {
      this.unboxing -= dt;
      if (this.unboxing <= 0) {
        this.unboxing = null;
        const { chest } = this.g.hunt;
        this.book.show(this.bookSpot(player), { x: chest.x + 0.5, y: GROUND + 0.8, z: chest.z + 0.5 });
        this.say('Oh, look what else is in there! My Dragon Book!', true);
        this.holdSpeech = 5;
      }
    }
    this.book.update(dt, t);
    if (!this.p.hasBook && this.book.landed && Math.hypot(player.x - this.book.spot.x, player.z - this.book.spot.z) < BOOK_RANGE) {
      this.book.pickUp(this.g.player.object.position);
      this.set({ type: 'gotBook' });
      this.g.hud.showBookButton(() => this.openBook());
      this.g.hud.showBanner('You found the Dragon Book! 📖', true);
      this.say(ollieSays(this.p), true);
      this.holdSpeech = 5;
      this.landingAt = 1.2; // the dragons come down, and the camera follows them
      this.watchLanding = true;
    }
  }

  dispose() {
    this.race?.dispose();
    this.village?.dispose();
    this.book.dispose();
    this.itemsView.dispose();
    this.ollie.dispose();
  }
}

