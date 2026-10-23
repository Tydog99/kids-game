// 3D side of the treasure hunt: glowing chest, floating keys with sky-high beams of light,
// and the shower of coins when the chest opens.
import * as THREE from 'three';
import { buildGeometry } from '../voxel/builder.js';
import { goldenKey, chestBody, chestLid, CHEST_LID_HINGE } from '../voxel/models/treasure.js';
import { DIRS } from '../worldgen.js';

const GROUND = 0.25;
const BEAM_HEIGHT = 60;
const BEAM_RADIUS = 0.22;
const BEAM_MAX_DIST = 34; // beams farther than this are drawn closer (and smaller) so they're never clipped
const TREELINE = 6.5; // far-away beams float with their foot up here, above the trees
const LAND_RANGE = 10; // over this last stretch before BEAM_MAX_DIST, a beam's foot comes down to the ground
const MIN_BEAM_ANGLE = 0.006; // radians: beams never get thinner than this on screen
const COINS = 1600;
const POUR_SECONDS = 6;

function beamMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 1 }, uTime: { value: 0 }, uStrength: { value: 1 }, uFloat: { value: 0 } },
    vertexShader: `
      varying float vH;
      varying float vEdge;
      void main() {
        vH = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vEdge = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      uniform float uStrength;
      uniform float uFloat; // 1 = floating above the trees: soft bottom edge, no glowing foot
      varying float vH;
      varying float vEdge;
      void main() {
        float core = pow(vEdge, 2.0);
        float fade = pow(1.0 - vH, 0.7) * (1.0 + 0.6 * (1.0 - uFloat) * smoothstep(0.03, 0.0, vH));
        fade *= mix(1.0, smoothstep(0.0, 0.12, vH), uFloat);
        float shimmer = 0.85 + 0.15 * sin(vH * 120.0 - uTime * 6.0);
        gl_FragColor = vec4(uColor * (0.85 + 0.35 * core) * shimmer, min(1.0, core * fade * uOpacity * uStrength));
      }`,
    // normal (not additive) blending keeps the beam gold against a bright daytime sky
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// Column of light: widest at the ground, tapering toward the sky.
function makeBeam(color, radius = BEAM_RADIUS) {
  const geo = new THREE.CylinderGeometry(radius * 0.35, radius, BEAM_HEIGHT, 16, 1, true);
  geo.translate(0, BEAM_HEIGHT / 2, 0);
  const mesh = new THREE.Mesh(geo, beamMaterial(color));
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return mesh;
}

// Soft round pool of light lying on the ground.
function makeGlowPool(color, radius, opacity) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 40),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
        void main() { float r = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), 1.8); gl_FragColor = vec4(uColor, a * uOpacity); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

export class TreasureView {
  constructor(scene, hunt) {
    this.scene = scene;
    this.hunt = hunt;
    this.group = new THREE.Group();
    scene.add(this.group);

    // --- chest ---
    const chestMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#5a3c00', emissiveIntensity: 0.6 });
    this.chestMat = chestMat;
    const V = 1 / 16;
    const c = hunt.chest;
    this.chest = new THREE.Group();
    this.chest.position.set(c.x + 0.5, GROUND + V, c.z + 0.5);
    const [fx, fz] = DIRS[c.facing];
    this.chest.rotation.y = Math.atan2(fx, fz);
    const body = new THREE.Mesh(buildGeometry(chestBody(), { size: V, jitter: 0.03 }), chestMat);
    body.castShadow = body.receiveShadow = true;
    this.lid = new THREE.Group();
    this.lid.position.set(0, CHEST_LID_HINGE.y * V, CHEST_LID_HINGE.z * V);
    const lidMesh = new THREE.Mesh(buildGeometry(chestLid(), { size: V, jitter: 0.03, origin: [0, 0, CHEST_LID_HINGE.z] }), chestMat);
    lidMesh.castShadow = true;
    this.lid.add(lidMesh);
    this.chest.add(body, this.lid);
    // warm glow on the ground and a soft halo
    this.glowLight = new THREE.PointLight('#ffc23d', 6, 11, 1.2);
    this.glowLight.position.set(0, 1.2, 0);
    this.chest.add(this.glowLight);
    this.halo = makeBeam('#ffcf4d', 1.7);
    this.halo.scale.y = 3.6 / BEAM_HEIGHT;
    this.halo.material.uniforms.uOpacity.value = 0.45;
    this.chest.add(this.halo);
    // soft pool of golden light on the ground around the chest
    this.pool = makeGlowPool('#ffc93d', 3.2, 0.6);
    this.pool.position.y = 0.01 - 1 / 16;
    this.chest.add(this.pool);
    this.group.add(this.chest);
    this.lidOpen = 0;
    // a beam over the chest appears once all keys are found, to guide you home
    this.chestBeam = this.addBeam(c.x, c.z, '#ffe27a');
    this.chestBeam.visible = false;
    this.chestBeamOn = 0;

    // --- keys ---
    const keyGeo = buildGeometry(goldenKey(), { size: 1 / 24, jitter: 0.02, origin: [0, 10, 0] });
    this.keyMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#7a5600', emissiveIntensity: 0.7 });
    this.keys = hunt.keys.map((k, i) => {
      const mesh = new THREE.Mesh(keyGeo, this.keyMat);
      mesh.castShadow = true;
      mesh.position.set(k.x + 0.5, GROUND + 0.9, k.z + 0.5);
      mesh.scale.setScalar(1.3);
      this.group.add(mesh);
      const pool = makeGlowPool('#ffc93d', 1.4, 0.55);
      pool.position.set(k.x + 0.5, GROUND + 0.01, k.z + 0.5);
      this.group.add(pool);
      return { data: k, mesh, pool, beam: this.addBeam(k.x, k.z, '#ffd23f'), phase: i * 2.1, gone: 0 };
    });

    // --- coins ---
    const coinGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.025, 12);
    coinGeo.rotateX(Math.PI / 2);
    this.coinMat = new THREE.MeshLambertMaterial({ color: '#ffcc33', emissive: '#6b4a00', emissiveIntensity: 0.6 });
    this.coins = new THREE.InstancedMesh(coinGeo, this.coinMat, COINS);
    this.coins.count = 0;
    this.coins.frustumCulled = false;
    this.coins.castShadow = true;
    this.group.add(this.coins);
    this.coinState = [];
    this.tmp = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(1, 1, 1), p: new THREE.Vector3() };
  }

  addBeam(x, z, color) {
    const beam = makeBeam(color);
    beam.userData.base = new THREE.Vector3(x + 0.5, GROUND, z + 0.5);
    this.group.add(beam);
    return beam;
  }

  // Keep a beam visible at any distance: past the view range, slide it toward the camera and
  // shrink it by the same factor (so it looks the same size), and never let it get too thin.
  // Far away its foot floats above the treeline, so it doesn't slide across the ground and trees as
  // you approach; over the last stretch it comes down to touch the ground at its real spot.
  placeBeam(beam, camera) {
    const base = beam.userData.base;
    const cam = camera.position;
    const d = Math.hypot(base.x - cam.x, base.z - cam.z);
    const s = d > BEAM_MAX_DIST ? BEAM_MAX_DIST / d : 1;
    const widen = Math.max(1, (d * MIN_BEAM_ANGLE) / BEAM_RADIUS);
    const k = Math.min(1, Math.max(0, (d - (BEAM_MAX_DIST - LAND_RANGE)) / LAND_RANGE));
    const lift = k * k * (3 - 2 * k); // 0 close up, 1 far away
    const footWorld = base.y + (TREELINE - base.y) * lift;
    const foot = cam.y + (footWorld - cam.y) * s;
    const top = cam.y + (base.y + BEAM_HEIGHT - cam.y) * s; // where the real beam's top appears
    beam.position.set(cam.x + (base.x - cam.x) * s, foot, cam.z + (base.z - cam.z) * s);
    beam.scale.set(s * widen, Math.max(0.001, (top - foot) / BEAM_HEIGHT), s * widen);
    beam.material.uniforms.uFloat.value = lift;
    // see-through up close (so the key shows inside it), solid when far away and thin
    beam.material.uniforms.uStrength.value = Math.min(1.1, 0.45 + d / 60);
  }

  // Show a saved hunt as it was left: collected keys gone, an opened chest open.
  restore() {
    for (const k of this.keys) {
      if (!k.data.collected) continue;
      k.mesh.visible = k.pool.visible = k.beam.visible = false;
    }
    if (this.hunt.chest.open) {
      this.lidOpen = 1;
      this.lid.rotation.x = -1.95;
      this.chestBeam.visible = false;
    }
  }

  // A soft beam of light marking a spot (like a resting dragon). Returns it, for removeMarker.
  addMarker(x, z, color) {
    const beam = this.addBeam(x, z, color);
    beam.material.uniforms.uOpacity.value = 0.75;
    (this.markers ??= []).push(beam);
    return beam;
  }

  removeMarker(beam) {
    this.markers = this.markers.filter((b) => b !== beam);
    this.group.remove(beam);
    beam.geometry.dispose();
    beam.material.dispose();
  }

  collectKey(key) {
    const k = this.keys.find((k) => k.data === key);
    if (k) k.collecting = true;
  }

  showChestBeam() {
    this.chestBeam.visible = true;
  }

  open() {
    this.opening = true;
    this.coinTimer = 0;
  }

  update(dt, t, camera) {
    // chest glow pulses; brighter once you have all the keys
    const eager = this.hunt.hasAllKeys && !this.hunt.chest.open ? 1 : 0;
    this.glowLight.intensity = 5 + Math.sin(t * 3) * 1.5 + eager * 4;
    this.pool.material.uniforms.uOpacity.value = 0.5 + Math.sin(t * 3) * 0.12 + eager * 0.25;
    this.chestMat.emissiveIntensity = 0.5 + Math.sin(t * 3) * 0.15 + eager * 0.3;
    this.halo.material.uniforms.uTime.value = t;

    for (const k of this.keys) {
      const m = k.mesh;
      if (k.collecting) {
        // swoop up, spin fast and vanish
        k.gone = Math.min(1, k.gone + dt / 0.8);
        m.position.y = GROUND + 0.9 + k.gone * 2.5;
        m.rotation.y += dt * 18;
        m.scale.setScalar(1.3 * (1 - k.gone));
        k.beam.material.uniforms.uOpacity.value = 1 - k.gone;
        k.pool.material.uniforms.uOpacity.value = 0.55 * (1 - k.gone);
        if (k.gone >= 1) {
          m.visible = false;
          k.pool.visible = false;
          k.beam.visible = false;
        }
      } else {
        m.position.y = GROUND + 0.9 + Math.sin(t * 2 + k.phase) * 0.12;
        m.rotation.y = t * 1.5 + k.phase;
      }
      k.beam.material.uniforms.uTime.value = t;
      if (k.beam.visible) this.placeBeam(k.beam, camera);
    }

    if (this.chestBeam.visible) {
      this.chestBeamOn = Math.min(1, this.chestBeamOn + dt);
      const fadeOut = this.hunt.chest.open ? Math.max(0, 1 - (this.openTime ?? 0) / 0.8) : 1;
      this.chestBeam.material.uniforms.uOpacity.value = this.chestBeamOn * fadeOut;
      this.chestBeam.material.uniforms.uTime.value = t;
      this.placeBeam(this.chestBeam, camera);
      if (fadeOut === 0) this.chestBeam.visible = false;
    }

    for (const b of this.markers ?? []) {
      b.material.uniforms.uTime.value = t;
      this.placeBeam(b, camera);
    }

    if (this.opening) this.updateOpening(dt);
  }

  updateOpening(dt) {
    this.openTime = (this.openTime ?? 0) + dt;
    // lid swings back with a little overshoot
    this.lidOpen = Math.min(1, this.lidOpen + dt / 0.7);
    const e = 1 - Math.pow(1 - this.lidOpen, 3);
    this.lid.rotation.x = -1.95 * e - Math.sin(e * Math.PI) * 0.2;

    // pour coins out for several seconds: a big burst first, then a steady fountain
    this.coinTimer += dt;
    const k = Math.min(1, this.coinTimer / POUR_SECONDS);
    const want = Math.min(COINS, Math.floor((1 - Math.pow(1 - k, 1.6)) * COINS));
    const origin = this.chest.position;
    while (this.coinState.length < want) {
      const a = Math.random() * Math.PI * 2, out = 0.6 + Math.random() * 3.4;
      this.coinState.push({
        p: new THREE.Vector3(origin.x + (Math.random() - 0.5) * 0.4, origin.y + 0.65, origin.z + (Math.random() - 0.5) * 0.3),
        v: new THREE.Vector3(Math.cos(a) * out, 3.5 + Math.random() * 4.5, Math.sin(a) * out),
        r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        spin: new THREE.Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20),
        resting: false,
      });
    }
    const floor = GROUND + 0.015;
    const { m, q, e: eul, s } = this.tmp;
    this.coinState.forEach((c, i) => {
      if (!c.resting) {
        c.v.y -= 9.8 * dt;
        c.p.addScaledVector(c.v, dt);
        c.r.addScaledVector(c.spin, dt);
        if (c.p.y < floor) {
          c.p.y = floor;
          c.v.y *= -0.42;
          c.v.x *= 0.65;
          c.v.z *= 0.65;
          c.spin.multiplyScalar(0.6);
          if (Math.abs(c.v.y) < 0.4) {
            // settle flat on the ground
            c.resting = true;
            c.r.set(Math.PI / 2, c.r.y, 0);
          }
        }
      }
      eul.set(c.r.x, c.r.y, c.r.z);
      q.setFromEuler(eul);
      m.compose(c.p, q, s);
      this.coins.setMatrixAt(i, m);
    });
    this.coins.count = this.coinState.length;
    this.coins.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.group.traverse((o) => {
      o.geometry?.dispose();
      if (o.material?.isShaderMaterial) o.material.dispose();
    });
    this.chestMat.dispose();
    this.keyMat.dispose();
    this.coinMat.dispose();
    this.scene.remove(this.group);
  }
}
