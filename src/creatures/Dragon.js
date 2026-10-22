// A rigged voxel dragon that can walk on all fours, rear up on its back legs, and fly.
// Poses blend smoothly: call setMode('walk' | 'rear' | 'fly') and update(dt) every frame.
import * as THREE from 'three';
import { buildGeometry } from '../voxel/builder.js';
import { buildDragonParts, DRAGON_VOXEL as V } from './dragonModels.js';
import { VoxelGrid } from '../voxel/VoxelGrid.js';
import { Breath } from './Breath.js';

// Target pose for each mode. Angles in radians; lift in world units.
const POSES = {
  walk: {
    lift: 0, pitch: 0, neck: -0.55, neckBend: -0.08, head: 0.75, tailLift: 0.12, tailCurl: -0.04, tailSway: 0.18,
    gait: 1, fold: 1, flap: 0, backLeg: 0, frontLeg: 0, paw: 0, wingRaise: 0, crouch: 0,
  },
  rear: {
    lift: 0.1, pitch: -0.95, neck: 0.15, neckBend: -0.02, head: 0.75, tailLift: 0.92, tailCurl: 0.03, tailSway: 0.06,
    gait: 0, fold: 0.25, flap: 0.22, backLeg: -0.12, frontLeg: -0.65, paw: 1, wingRaise: 0.35, crouch: 0,
  },
  fly: {
    lift: 2.2, pitch: -0.08, neck: -0.25, neckBend: -0.03, head: 0.3, tailLift: -0.08, tailCurl: 0.03, tailSway: 0.1,
    gait: 0, fold: 0, flap: 1, backLeg: 1.15, frontLeg: 0.95, paw: 0, wingRaise: 0.1, crouch: 0,
  },
  // sitting like a dog: hips down, back legs folded under, chest up on straight front legs
  sit: {
    lift: 0, pitch: -0.4, neck: -0.25, neckBend: -0.05, head: 0.6, tailLift: 0.33, tailCurl: 0.06, tailSway: 0.03,
    gait: 0, fold: 1, flap: 0, backLeg: -1.1, frontLeg: 0.4, paw: 0, wingRaise: 0, crouch: 1,
  },
};

const mesh = (grid, origin = [0, 0, 0]) => {
  const m = new THREE.Mesh(buildGeometry(grid, { size: V, origin, jitter: 0.03 }), Dragon.material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

const at = (v) => new THREE.Vector3(v[0] * V, v[1] * V, v[2] * V);

export class Dragon {
  static material = new THREE.MeshLambertMaterial({ vertexColors: true });

  constructor(id) {
    const parts = buildDragonParts(id);
    const spec = (this.spec = parts.spec);
    this.mode = 'walk';
    this.pose = { ...POSES.walk };
    this.walkPhase = Math.random() * 6;
    this.flapPhase = 0;
    this.time = 0;

    // root sits on the ground under the hips; everything else hangs off it
    this.root = new THREE.Group();
    this.body = new THREE.Group(); // lifts when flying
    this.root.add(this.body);
    this.hips = new THREE.Group(); // pitches up when rearing; holds torso, neck, tail, front legs, wings
    this.hips.position.y = spec.backLeg.len * V;
    this.body.add(this.hips);
    this.hips.add(mesh(parts.torso));

    // neck chain → head
    let parent = this.hips;
    let pos = at(spec.neck.base);
    this.neck = parts.neck.map((grid) => {
      const j = new THREE.Group();
      j.position.copy(pos);
      j.add(mesh(grid));
      parent.add(j);
      parent = j;
      pos = new THREE.Vector3(0, 0, spec.neck.len * V);
      return j;
    });
    this.head = new THREE.Group();
    this.head.position.copy(pos);
    parent.add(this.head);
    // split the lower jaw off the head so the mouth can open
    const { skull, snoutLen, snoutW } = spec.head;
    const zc = skull[2] * 0.6, s0 = Math.floor(zc + skull[2] * 0.4), s1 = zc + skull[2] * 0.4 + snoutLen;
    const upper = new VoxelGrid(), jaw = new VoxelGrid();
    for (const v of parts.head.voxels()) {
      const inMouth = v.z >= s0 + 1 && Math.abs(v.x + 0.5) < snoutW - 1;
      if (v.z >= s0 && v.y <= -2) jaw.set(v.x, v.y, v.z, inMouth && v.y === -2 ? '#c94a5a' : v.color); // tongue on top
      else upper.set(v.x, v.y, v.z, inMouth && v.y === -1 ? '#6e1b1b' : v.color); // roof of the mouth
    }
    this.head.add(mesh(upper));
    this.jaw = new THREE.Group();
    this.jaw.position.set(0, -1 * V, s0 * V);
    this.jaw.add(mesh(jaw, [0, -1, s0]));
    this.head.add(this.jaw);
    // where the breath comes out: just in front of the open mouth
    this.mouth = new THREE.Object3D();
    this.mouth.position.set(0, -1.5 * V, (s1 + 1.5) * V);
    this.head.add(this.mouth);
    this.breathTime = 0;
    this.breathOpen = 0;

    // tail chain
    parent = this.hips;
    pos = at(spec.tail.base);
    this.tail = parts.tail.map((grid) => {
      const j = new THREE.Group();
      j.position.copy(pos);
      j.add(mesh(grid));
      parent.add(j);
      parent = j;
      pos = new THREE.Vector3(0, 0, -spec.tail.len * V);
      return j;
    });

    // limbs: build the right side, mirror for the left
    this.legs = {};
    this.wings = [];
    for (const side of [1, -1]) {
      const mirrorBody = new THREE.Group();
      mirrorBody.scale.x = side;
      this.hips.add(mirrorBody);
      const mirrorRoot = new THREE.Group();
      mirrorRoot.scale.x = side;
      this.body.add(mirrorRoot);

      const back = new THREE.Group();
      back.position.set(spec.hipX * V, spec.backLeg.len * V, 0);
      back.add(mesh(parts.backLeg));
      mirrorRoot.add(back); // back legs stay planted when the body rears up
      const front = new THREE.Group();
      front.position.copy(at(spec.shoulder));
      front.add(mesh(parts.frontLeg));
      mirrorBody.add(front);
      this.legs[side > 0 ? 'backR' : 'backL'] = back;
      this.legs[side > 0 ? 'frontR' : 'frontL'] = front;

      const inner = new THREE.Group();
      inner.position.copy(at(spec.wing.pivot));
      inner.add(mesh(parts.wingInner));
      const outer = new THREE.Group();
      outer.position.set(spec.wing.spanA * V, V * 0.6, 0);
      outer.add(mesh(parts.wingOuter));
      inner.add(outer);
      mirrorBody.add(inner);
      this.wings.push({ inner, outer, side });
    }
  }

  setMode(mode) {
    this.mode = mode;
  }

  // Adds the breath particles (fire, ice or diamonds) to a scene.
  enableBreath(scene, groundY = 0) {
    this.breath = new Breath(scene, this.spec.breath);
    this.groundY = groundY;
  }

  dispose() {
    this.breath?.dispose();
  }

  breathe(seconds = 2) {
    this.breathTime = Math.max(this.breathTime, seconds);
  }

  get breathing() {
    return this.breathTime > 0;
  }

  update(dt) {
    this.time += dt;
    const target = POSES[this.mode];
    const k = 1 - Math.exp(-3.5 * dt);
    for (const key in target) this.pose[key] += (target[key] - this.pose[key]) * k;
    const p = this.pose;
    const t = this.time;

    this.walkPhase += dt * 5 * Math.max(0.15, p.gait);
    this.flapPhase += dt * (4 + 3 * p.flap);
    const w = this.walkPhase, f = this.flapPhase;

    // whole body: hover and bob when flying, small step bob when walking
    // crouch lowers the hips by part of the back leg's length (used when sitting)
    const crouch = p.crouch * this.spec.backLeg.len * V * 0.45;
    this.body.position.y = p.lift - crouch + Math.sin(f + Math.PI) * 0.12 * p.flap + Math.abs(Math.sin(w)) * 0.03 * p.gait;
    this.hips.rotation.x = p.pitch + Math.sin(f) * 0.05 * p.flap + Math.sin(t * 2) * 0.02 * p.paw;
    this.hips.rotation.z = Math.sin(w) * 0.03 * p.gait;

    // neck curves up, head stays fairly level
    this.neck.forEach((j, i) => {
      j.rotation.x = (i === 0 ? p.neck : p.neckBend) + Math.sin(w * 2 + i) * 0.02 * p.gait;
      j.rotation.y = Math.sin(t * 0.7 + i) * 0.05;
    });
    // breathing: jaw drops open, head pushes forward and aims a little down, with a shudder
    this.breathTime = Math.max(0, this.breathTime - dt);
    this.breathOpen += ((this.breathing ? 1 : 0) - this.breathOpen) * Math.min(1, dt * 9);
    const b = this.breathOpen;
    this.jaw.rotation.x = b * 0.55;
    this.neck[this.neck.length - 1].rotation.x += b * 0.12;
    this.head.rotation.x = p.head + Math.sin(t * 1.3) * 0.04 * (1 - b) + b * 0.18 + Math.sin(t * 40) * 0.015 * b;
    this.head.rotation.z = Math.sin(t * 0.9) * 0.05 * p.paw;

    // tail sways side to side and streams out behind in flight
    this.tail.forEach((j, i) => {
      j.rotation.x = (i === 0 ? p.tailLift : p.tailCurl) + Math.sin(f * 0.8 - i * 0.7) * 0.06 * p.flap;
      j.rotation.y = Math.sin(w * 0.5 - i * 0.6) * p.tailSway;
    });

    // legs: diagonal gait (front-left with back-right), pawing when reared, tucked when flying
    const swing = (phase) => Math.sin(phase) * 0.45 * p.gait;
    this.legs.backR.rotation.x = p.backLeg + swing(w);
    this.legs.frontL.rotation.x = p.frontLeg + swing(w) + Math.sin(t * 5) * 0.35 * p.paw;
    this.legs.backL.rotation.x = p.backLeg + swing(w + Math.PI);
    this.legs.frontR.rotation.x = p.frontLeg + swing(w + Math.PI) + Math.sin(t * 5 + Math.PI) * 0.35 * p.paw;

    // wings: fold = 1 tucks them along the flank like a cape; flap beats them up and down.
    // Rotation order YXZ: lift (z) first, then roll the membrane down around the bone (x),
    // then sweep the bone back along the body (y).
    for (const { inner, outer } of this.wings) {
      const beat = Math.sin(f);
      const spread = 1 - p.fold;
      inner.rotation.set(-p.fold * 0.8, p.fold * 1.4, p.fold * 0.2 + spread * (p.wingRaise + beat * 0.7 * p.flap), 'YXZ');
      // the outer half folds back along the inner half, flipped so its membrane hangs the same way
      outer.rotation.set(p.fold * Math.PI, -p.fold * 2.95, spread * Math.sin(f - 0.7) * 0.45 * p.flap, 'YXZ');
    }

    if (this.breath) {
      this.root.updateMatrixWorld(true);
      const origin = this.mouth.getWorldPosition(new THREE.Vector3());
      const dir = this.head.getWorldDirection(new THREE.Vector3());
      this.breath.update(dt, this.breathing && this.breathOpen > 0.5, origin, dir, this.groundY);
    }
  }
}
