import { describe, it, expect } from 'vitest';
import { newProgress, loadProgress, apply, nextGoal, ollieSays, dragonsCanLand, canBefriend, progressAt } from '../src/adventure/adventure.js';

describe('adventure progress', () => {
  it('chapter 1: keys, then the chest opens the dragon chapter', () => {
    let p = newProgress();
    expect(nextGoal(p).text).toBe("Find Grandpa Ollie's keys (0/3)");
    expect(dragonsCanLand(p)).toBe(false);
    p = apply(p, { type: 'chestOpened' });
    expect(p.chapter).toBe('treasure'); // not without the keys
    for (const index of [0, 2, 2, 1]) p = apply(p, { type: 'key', index });
    expect(p.keys).toEqual([0, 2, 1]);
    expect(nextGoal(p).text).toBe('Open the treasure chest');
    expect(ollieSays(p)).toMatch(/all my keys/);
    p = apply(p, { type: 'chestOpened' });
    expect(p.chapter).toBe('dragons');
    // the Dragon Book pops out; the dragons wait until it's picked up
    expect(dragonsCanLand(p)).toBe(false);
    expect(nextGoal(p).text).toBe('Pick up the Dragon Book');
    expect(ollieSays(p)).toMatch(/pick up my Dragon Book/);
    p = apply(p, { type: 'gotBook' });
    expect(p.hasBook).toBe(true);
    expect(dragonsCanLand(p)).toBe(true);
  });

  it('chapter 2: a dragon can only be befriended after its quest; three friends finish it', () => {
    let p = apply(newProgress(), { type: 'skip' });
    expect(p.chapter).toBe('dragons');
    expect(canBefriend(p, 'ember')).toBe(false);
    p = apply(p, { type: 'questDone', kind: 'ember' });
    expect(canBefriend(p, 'ember')).toBe(true);
    expect(canBefriend(p, 'frost')).toBe(false);
    p = apply(p, { type: 'befriended', kind: 'ember', name: 'Sparky' });
    expect(nextGoal(p).text).toBe('Make friends with the dragons (1/3)');
    p = apply(p, { type: 'befriended', kind: 'glimmer', name: 'Twinkle' });
    p = apply(p, { type: 'befriended', kind: 'frost', name: 'Snowy' });
    expect(p.chapter).toBe('race');
  });

  it('chapter 3: the race; the best time is kept, and replays never go back a chapter', () => {
    let p = { ...newProgress(), chapter: 'race' };
    expect(nextGoal(p).text).toMatch(/magic ring/);
    expect(ollieSays(p)).toMatch(/Sky Pitch/);
    p = apply(p, { type: 'raceDone', time: 61.5 });
    expect(p.chapter).toBe('village');
    expect(p.bestTime).toBe(61.5);
    p = apply(p, { type: 'raceDone', time: 70 });
    expect(p.bestTime).toBe(61.5);
    p = apply(p, { type: 'raceDone', time: 48 });
    expect(p.bestTime).toBe(48);
    expect(p.chapter).toBe('village');
  });

  it('chapter 4: helping all three villagers finishes the adventure', () => {
    let p = { ...newProgress(), chapter: 'village', raceDone: true };
    expect(nextGoal(p).text).toBe('Help the villagers (0/3)');
    p = apply(p, { type: 'helped', kind: 'frost' });
    p = apply(p, { type: 'helped', kind: 'frost' });
    expect(nextGoal(p).text).toBe('Help the villagers (1/3)');
    expect(ollieSays(p)).toMatch(/Keep going/);
    p = apply(p, { type: 'helped', kind: 'ember' });
    p = apply(p, { type: 'helped', kind: 'glimmer' });
    expect(p.chapter).toBe('done');
  });

  it('skip ahead goes through the race and one villager at a time', () => {
    let p = apply({ ...newProgress(), chapter: 'race' }, { type: 'skip' });
    expect(p.chapter).toBe('village');
    for (let i = 0; i < 3; i++) p = apply(p, { type: 'skip' });
    expect(p.chapter).toBe('done');
  });

  it('jumping to a chapter starts it fresh, with everything before it done', () => {
    expect(progressAt('treasure')).toEqual(newProgress());
    const dragons = progressAt('dragons');
    expect([dragons.chapter, dragons.hasBook, dragons.landed]).toEqual(['dragons', true, false]);
    const race = progressAt('race', { ember: 'Sparky' });
    expect(race.chapter).toBe('race');
    expect(race.friends).toEqual({ ember: 'Sparky', glimmer: 'Glimmer', frost: 'Frost' });
    expect(nextGoal(race).text).toMatch(/magic ring/);
    const village = progressAt('village');
    expect([village.chapter, village.raceDone, nextGoal(village).text]).toEqual(['village', true, 'Help the villagers (0/3)']);
    // it survives saving and loading
    expect(loadProgress(JSON.stringify(village))).toEqual(village);
  });

  it('found nests are remembered', () => {
    let p = apply(newProgress(), { type: 'nest', kind: 'frost' });
    expect(p.nests).toEqual({ frost: true });
    expect(loadProgress(JSON.stringify(p)).nests).toEqual({ frost: true });
    expect(loadProgress('{}').nests).toEqual({});
  });

  it('old finished saves pick up at the race', () => {
    expect(loadProgress(JSON.stringify({ chapter: 'done' })).chapter).toBe('race');
    expect(loadProgress(JSON.stringify({ chapter: 'done', raceDone: true, helped: { ember: true, frost: true, glimmer: true } })).chapter).toBe('done');
  });

  it('does not change the progress it was given', () => {
    const p = newProgress();
    apply(p, { type: 'key', index: 1 });
    expect(p.keys).toEqual([]);
  });

  it('saves from before the book had to be picked up already have it', () => {
    expect(loadProgress(JSON.stringify({ chapter: 'dragons', chestOpen: true })).hasBook).toBe(true);
    expect(loadProgress(JSON.stringify({ chapter: 'treasure' })).hasBook).toBe(false);
    expect(loadProgress(JSON.stringify({ chapter: 'dragons', chestOpen: true, hasBook: false })).hasBook).toBe(false);
  });

  it('skipping while the book waits by the chest just picks it up', () => {
    let p = apply(newProgress(), { type: 'skip' });
    expect(p.hasBook).toBe(true);
    p = { ...p, hasBook: false };
    p = apply(p, { type: 'skip' });
    expect(p.hasBook).toBe(true);
    expect(Object.keys(p.quests)).toEqual([]);
  });

  it('loads saved progress and survives junk', () => {
    const p = apply(apply(newProgress(), { type: 'key', index: 1 }), { type: 'sawDragon' });
    expect(loadProgress(JSON.stringify(p))).toEqual(p);
    expect(loadProgress('not json')).toEqual(newProgress());
    expect(loadProgress('{"chapter":"???","keys":[7,1,"x"]}')).toMatchObject({ chapter: 'treasure', keys: [1] });
  });
});

describe('dragon quests', () => {
  const landed = () => apply(apply(newProgress(), { type: 'skip' }), { type: 'landed' });

  it('Ember: accept, find the egg, carry it back', () => {
    let p = apply(landed(), { type: 'accept', kind: 'ember' });
    expect(nextGoal(p).text).toBe("Find Ember's egg in the forest");
    p = apply(p, { type: 'pickUp', item: 'egg' });
    expect(p.carrying).toBe('egg');
    expect(nextGoal(p).text).toBe('Bring the egg back to Ember');
    p = apply(p, { type: 'deliver', kind: 'frost' }); // wrong dragon
    expect(p.quests.frost).toBeUndefined();
    expect(p.carrying).toBe('egg');
    p = apply(p, { type: 'deliver', kind: 'ember' });
    expect(p.quests.ember).toBe(true);
    expect(p.carrying).toBeNull();
    expect(canBefriend(p, 'ember')).toBe(true);
    expect(nextGoal(p).text).toBe('Stay close to Ember so it trusts you');
  });

  it('Glimmer: 5 gems, counted once each', () => {
    let p = apply(landed(), { type: 'accept', kind: 'glimmer' });
    for (const index of [0, 3, 3, 1]) p = apply(p, { type: 'gem', index });
    expect(nextGoal(p).text).toBe('Find sparkly gems (3/5)');
    p = apply(p, { type: 'deliver', kind: 'glimmer' });
    expect(p.quests.glimmer).toBeUndefined(); // not enough yet
    p = apply(apply(p, { type: 'gem', index: 2 }), { type: 'gem', index: 4 });
    expect(nextGoal(p).text).toBe('Bring the 5 gems to Glimmer');
    expect(apply(p, { type: 'deliver', kind: 'glimmer' }).quests.glimmer).toBe(true);
  });

  it('Frost: the moon flower; only one thing carried at a time', () => {
    let p = apply(apply(landed(), { type: 'accept', kind: 'frost' }), { type: 'pickUp', item: 'egg' });
    p = apply(p, { type: 'pickUp', item: 'flower' });
    expect(p.flower).toBe(false); // hands full
    p = apply(apply(p, { type: 'deliver', kind: 'ember' }), { type: 'pickUp', item: 'flower' });
    expect(nextGoal(p).text).toBe('Bring the moon flower to Frost');
    expect(apply(p, { type: 'deliver', kind: 'frost' }).quests.frost).toBe(true);
  });
});
