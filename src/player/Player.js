// Ties the movement motor (logic) to the character (visuals).
import { PlayerMotor } from './PlayerMotor.js';
import { Character } from './Character.js';

export class Player {
  // start: { x, z, facing } tile to begin on
  constructor(start, characterId, isWalkable, look = null) {
    this.motor = new PlayerMotor(start, isWalkable);
    this.character = new Character(characterId, look);
    this.object = this.character.root;
    this.groundY = 0.25;
    this.sync(0);
  }

  update(dt, input, time) {
    this.motor.update(dt, input.peek());
    input.clearTaps();
    this.sync(time);
  }

  sync(time) {
    const m = this.motor;
    this.object.position.set(m.px, this.groundY, m.pz);
    this.object.rotation.y = m.yaw;
    this.character.animate(m.walkPhase, m.stride, time);
  }

  get position() {
    return this.object.position;
  }
}
