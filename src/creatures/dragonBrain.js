// When each world dragon does what. Pure (no three.js) so it can be tested.
// Every dragon loops walk → rear (and breathe) → sit → fly → walk…, but each one starts at a
// random point in the loop and every activity lasts a random time, so they drift apart.

export const ACTIVITIES = ['walk', 'rear', 'sit', 'fly'];

export const DURATIONS = {
  walk: [6, 20],
  rear: [2.5, 5],
  sit: [4, 12],
  fly: [10, 26],
};

export class DragonBrain {
  constructor(random) {
    this.random = random;
    this.index = Math.floor(random() * ACTIVITIES.length);
    this.elapsed = 0;
    this.duration = this.pickDuration();
    // start part-way through the first activity
    this.elapsed = random() * this.duration;
    this.hold = false; // set while the body needs more time (e.g. still landing)
  }

  get activity() {
    return ACTIVITIES[this.index];
  }

  get timeLeft() {
    return this.duration - this.elapsed;
  }

  pickDuration() {
    const [lo, hi] = DURATIONS[ACTIVITIES[this.index]];
    return lo + this.random() * (hi - lo);
  }

  // Returns true when the activity changed this step.
  update(dt) {
    this.elapsed += dt;
    if (this.elapsed < this.duration || this.hold) return false;
    this.index = (this.index + 1) % ACTIVITIES.length;
    this.elapsed = 0;
    this.duration = this.pickDuration();
    return true;
  }
}
