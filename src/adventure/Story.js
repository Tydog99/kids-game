// Runs Adventure mode inside a Game: Grandpa Ollie, the treasure chapter with sky-only dragons,
// the dragons landing, the Dragon Book, and saving progress for this world.
import { loadProgress, apply, nextGoal, ollieSays, canBefriend } from './adventure.js';
import { Villager } from './Villager.js';
import { placeQuestItems } from './questItems.js';
import { QuestItemsView } from './QuestItemsView.js';
import { openDragonBook } from '../ui/DragonBook.js';
import { DRAGONS } from '../creatures/dragonModels.js';
import { speak } from '../ui/speak.js';
import { load, save } from '../ui/storage.js';
import { DIRS } from '../worldgen.js';

const GROUND = 0.25;
const TALK_RANGE = 4.5; // Ollie's speech shows when the player is this close
const LOOK_RANGE = 2.2; // how close to a dragon's body to look at it with E
const BEAM = { ember: '#ff8a4a', glimmer: '#7af0c8', frost: '#9fdcff' };
const COLOR_WORD = { ember: 'orange', glimmer: 'green', frost: 'blue' };
const PICK_RANGE = 0.85; // how close to an item to pick it up
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
      if (this.p.chapter === 'treasure') {
        // up in the sky to begin with
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
    this.speechShown = null;
    this.intro = 6; // seconds Ollie's first words stay up wherever the player is
    this.refresh();
    game.hud.showGrownUp({ onSkip: () => this.skip(), onReset: () => this.reset() });
    if (this.p.chestOpen) game.hud.showBookButton(() => this.openBook());
  }

  olliesSpot() {
    const { chest } = this.g.hunt;
    const start = this.g.startTile();
    const open = (x, z) => this.g.walkable(x, z) === true;
    let best = null;
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) {
        const x = chest.x + dx, z = chest.z + dz;
        if (!open(x, z) || (x === start.x && z === start.z)) continue;
        const fromStart = Math.hypot(x - start.x, z - start.z), fromChest = Math.hypot(dx, dz);
        if (fromChest < 1 || fromStart < 2) continue;
        // close to the chest, a few steps from the player, not in the way straight ahead
        const [fx, fz] = DIRS[start.facing];
        const ahead = Math.abs((x - start.x) * fz - (z - start.z) * fx) < 0.5 && (x - start.x) * fx + (z - start.z) * fz > 0;
        const score = fromChest + Math.abs(fromStart - 3.5) + (ahead ? 3 : 0);
        if (!best || score < best.score) best = { x: x + 0.5, z: z + 0.5, score };
      }
    return best ?? { x: chest.x + 0.5, z: chest.z - 1.5 };
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
    if (e.type === 'key') this.set({ type: 'key', index: this.g.hunt.keys.indexOf(e.key) });
    if (e.type === 'open') {
      this.set({ type: 'chestOpened' });
      this.landingAt = 2.5; // a moment to enjoy the coins, then the dragons come down
      this.g.hud.showBookButton(() => this.openBook());
      this.say(ollieSays(this.p), true);
      setTimeout(() => this.g.hud.showBanner('You found the Dragon Book! 📖', true), 1800);
    }
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
    if (this.p.chapter === 'done') {
      setTimeout(() => {
        this.g.hud.showBanner('You are a real Dragon Keeper! 🏆', true);
        speak('You made friends with every dragon. You are a real Dragon Keeper!');
      }, 2500);
    }
  }

  // Something to look at with E: a dragon that isn't your friend yet, or Ollie.
  examinable() {
    if (this.p.chapter === 'treasure') return null;
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
  talk() {
    this.say(ollieSays(this.p), true);
  }

  say(text, force = false) {
    if (this.speechShown === text && !force) return;
    this.speechShown = text;
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
    const what = { ember: 'its egg back', glimmer: 'the sparkly gems', frost: 'the moon flower' }[d.kind];
    this.g.hud.showBanner(`${name} is so happy! 💛`, true);
    speak(`You gave ${name} ${what}! ${name} is so happy. Stay close so it learns to trust you.`);
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
    const before = this.p.chapter;
    this.set({ type: 'skip' });
    if (before === 'treasure') {
      const { hunt, treasureView } = this.g;
      hunt.keys.forEach((k) => (k.collected = true));
      hunt.chest.open = true;
      treasureView.restore();
      this.landingAt = 0.1;
      this.g.hud.showBookButton(() => this.openBook());
    }
    this.g.hud.showBanner(before === 'treasure' ? 'Skipped to: the dragons land' : 'Skipped: one dragon quest done', true);
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
    if ((near || this.intro > 0) && !this.g.riding) this.say(ollieSays(this.p));
    else if (this.speechShown) {
      this.speechShown = null;
      this.g.hud.showSpeech(null);
    }
    this.ollie.update(dt, t, player, !!this.speechShown);

    // chapter 1: the first time a dragon flies close by
    if (this.p.chapter === 'treasure' && !this.p.sawDragon) {
      for (const d of this.g.dragons.list) {
        // flying right over you (high up and maybe off the top of the screen, so say where to look)
        if (Math.hypot(d.x - player.x, d.z - player.z) < 9) {
          this.set({ type: 'sawDragon' });
          this.g.hud.showBanner('Whoa! Was that a dragon?! Look up!', true);
          speak('Whoa! Was that a dragon? Look up!');
          break;
        }
      }
    }

    // after the chest opens, the dragons fly down to their resting spots
    if (this.landingAt !== null) {
      this.landingAt -= dt;
      if (this.landingAt <= 0) {
        this.landingAt = null;
        for (const d of this.g.dragons.list) {
          if (d.trusted) continue;
          d.flyTo(d.restSpot);
          this.mark(d);
        }
        this.g.hud.showBanner('Look! The dragons are landing!', true);
      }
    }
    if (!this.p.landed && this.p.chapter !== 'treasure' && this.g.dragons.list.every((d) => d.trusted || (d.grounded && !d.summon))) {
      this.set({ type: 'landed' });
    }
  }

  dispose() {
    this.itemsView.dispose();
    this.ollie.dispose();
  }
}

