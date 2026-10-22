// Ties the grid motor (logic) to the character (visuals).
import { PlayerMotor } from './PlayerMotor.js';
import { Character } from './Character.js';
import { DIRS } from '../worldgen.js';

export class Player {
  constructor(world, characterId, isWalkable) {
    this.motor = new PlayerMotor(world.spawn, isWalkable);
    this.character = new Character(characterId);
    this.object = this.character.root;
    this.groundY = 0.25;
    this.sync(0);
  }

  update(dt, input, time) {
    if (this.motor.update(dt, input.peek())) input.clearTaps();
    this.sync(time);
  }

  sync(time) {
    const m = this.motor;
    const [dx, dz] = DIRS[m.facing];
    const nudge = m.bump * 0.12;
    this.object.position.set(m.px + 0.5 + dx * nudge, this.groundY, m.pz + 0.5 + dz * nudge);
    this.object.rotation.y = m.yaw;
    this.character.animate(m.walkPhase, m.state === 'step', time);
  }

  get position() {
    return this.object.position;
  }
}
