// The dragon lands in the game (see realms.js for where they are): a magic gate across each
// corridor until its dragon is your friend, and each dragon's nest with its eggs.
import * as THREE from 'three';
import { openGate } from '../realms.js';

const GROUND = 0.25;
const COLOUR = { ember: '#ff7a2a', glimmer: '#7af0c8', frost: '#8fd4ff' };
const EGGS = {
  ember: ['#e8742a', '#c9452a', '#f2a03a'],
  glimmer: ['#ff9fd0', '#8ff0ff', '#c9a6ff'],
  frost: ['#d8f0ff', '#a8d8ff', '#eef8ff'],
};
const NEAR_GATE = 3.2; // walking this close to a closed gate explains it
const NEAR_NEST = 3.5; // …and this close to a nest finds it

function gateCurtain(colour) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColour: { value: new THREE.Color(colour) }, uFade: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime, uFade;
      uniform vec3 uColour;
      void main() {
        float wave = sin(vUv.x * 18.0 + sin(vUv.y * 6.0 + uTime * 2.0) * 1.5 + uTime * 1.3) * 0.5 + 0.5;
        float shimmer = sin(vUv.y * 40.0 - uTime * 4.0 + vUv.x * 9.0) * 0.5 + 0.5;
        float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x) * smoothstep(1.0, 0.85, vUv.y);
        vec3 col = mix(uColour, vec3(1.0), shimmer * 0.35);
        gl_FragColor = vec4(col, (0.35 + 0.35 * wave) * edge * uFade);
      }`,
  });
}

export class RealmView {
  // world: from generateRealmWorld(); hooks: onLocked(kind) when the player walks up to a closed
  // gate; onNest(kind) when the player reaches a nest
  constructor(scene, world, { onLocked = () => {}, onNest = () => {} } = {}) {
    this.scene = scene;
    this.world = world;
    this.onLocked = onLocked;
    this.onNest = onNest;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.gates = new Map();
    this.nests = new Map();
    for (const r of world.realms ?? []) {
      this.gates.set(r.kind, this.buildGate(r));
      this.nests.set(r.kind, this.buildNest(r));
    }
    this.atNest = new Set();
  }

  buildGate(r) {
    const g = new THREE.Group();
    g.position.set(r.gateAt.x, GROUND, r.gateAt.z);
    g.rotation.y = r.gateAt.east ? Math.PI / 2 : 0;
    const stone = new THREE.MeshLambertMaterial({ color: '#8a827d' });
    const trim = new THREE.MeshLambertMaterial({ color: COLOUR[r.kind], emissive: COLOUR[r.kind], emissiveIntensity: 0.35 });
    for (const x of [-2, 2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5, 0.8), stone);
      post.position.set(x, 2.5, 0);
      post.castShadow = true;
      g.add(post);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 1), trim);
      cap.position.set(x, 5.2, 0);
      g.add(cap);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(5, 0.6, 0.8), stone);
    lintel.position.y = 5.1;
    lintel.castShadow = true;
    g.add(lintel);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), trim);
    gem.position.y = 5.9;
    g.add(gem);
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.8), gateCurtain(COLOUR[r.kind]));
    curtain.position.y = 2.4;
    g.add(curtain);
    this.group.add(g);
    return { group: g, curtain, gem, opening: null };
  }

  buildNest(r) {
    const g = new THREE.Group();
    g.position.set(r.nest.x, GROUND, r.nest.z);
    const twig = new THREE.MeshLambertMaterial({ color: '#7a5230' });
    const twig2 = new THREE.MeshLambertMaterial({ color: '#94683c' });
    // a round bowl of woven sticks: a thick ring, with short sticks laid round it
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.38, 8, 24), twig);
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(1, 1, 0.75);
    ring.position.y = 0.32;
    ring.castShadow = true;
    g.add(ring);
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + (i % 3) * 0.07;
      const r = 1.15 + ((i * 7) % 5 - 2) * 0.08;
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.09, 0.09), i % 2 ? twig : twig2);
      stick.position.set(Math.cos(a) * r, 0.3 + ((i * 5) % 4) * 0.1, Math.sin(a) * r);
      // along the ring (tangent to it), each a little askew
      stick.rotation.set(0, -a - Math.PI / 2 + ((i * 13) % 7 - 3) * 0.08, ((i * 11) % 5 - 2) * 0.12);
      g.add(stick);
    }
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.1, 0.3, 20), new THREE.MeshLambertMaterial({ color: '#d9b36a' }));
    bed.position.y = 0.15;
    g.add(bed);
    // the eggs
    const eggs = EGGS[r.kind].map((c, i) => {
      const egg = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 14, 10),
        new THREE.MeshPhongMaterial({ color: c, emissive: c, emissiveIntensity: 0.18, shininess: 70 }),
      );
      egg.scale.set(1, 1.35, 1);
      const a = (i / 3) * Math.PI * 2 + 0.4;
      egg.position.set(Math.cos(a) * 0.45, 0.65, Math.sin(a) * 0.45);
      egg.castShadow = true;
      g.add(egg);
      return egg;
    });
    g.scale.setScalar(1.3);
    this.group.add(g);
    return { group: g, eggs };
  }

  // Open a land's gate (animate: with a flourish, rather than already gone).
  unlock(kind, animate = true) {
    if (!openGate(this.world, kind)) return;
    const gate = this.gates.get(kind);
    if (!gate) return;
    if (animate) gate.opening = 0;
    else gate.group.visible = false;
  }

  isOpen(kind) {
    return !!this.world.realms?.find((r) => r.kind === kind)?.open;
  }

  // player: { x, z }
  update(dt, t, player) {
    for (const [kind, gate] of this.gates) {
      if (!gate.group.visible) continue;
      gate.curtain.material.uniforms.uTime.value = t;
      gate.gem.rotation.y = t * 1.5;
      if (gate.opening !== null) {
        // the curtain shimmers away and the gate sinks into the ground
        gate.opening += dt;
        const k = Math.min(1, gate.opening / 2.2);
        gate.curtain.material.uniforms.uFade.value = 1 - k;
        gate.gem.scale.setScalar(1 + Math.sin(k * Math.PI) * 1.5);
        gate.group.position.y = GROUND - Math.max(0, k - 0.4) * 9;
        if (k >= 1) gate.group.visible = false;
        continue;
      }
      const r = this.world.realms.find((r) => r.kind === kind);
      if (!r.open && player && Math.hypot(player.x - r.gateAt.x, player.z - r.gateAt.z) < NEAR_GATE) this.onLocked(kind);
    }
    for (const [kind, nest] of this.nests) {
      // the eggs wobble now and then
      nest.eggs.forEach((egg, i) => {
        const w = Math.max(0, Math.sin(t * 1.3 + i * 2.1)) ** 8;
        egg.rotation.z = Math.sin(t * 18 + i) * 0.18 * w;
      });
      const r = this.world.realms.find((r) => r.kind === kind);
      const near = player && Math.hypot(player.x - r.nest.x, player.z - r.nest.z) < NEAR_NEST;
      if (near && !this.atNest.has(kind)) {
        this.atNest.add(kind);
        this.onNest(kind);
      } else if (!near) this.atNest.delete(kind);
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose?.();
    });
  }
}
