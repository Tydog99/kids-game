// Turns generateWorld() output into three.js meshes.
import * as THREE from 'three';
import { T, TILE_INFO } from '../tiles.js';
import { TREE_KIND } from '../worldgen.js';
import { createRng } from '../rng.js';
import { buildGeometry, buildGreedyGeometry, voxelMaterial } from '../voxel/builder.js';
import { oakTree, pineTree, deadTree, snowyPine, crystalTree } from '../voxel/models/trees.js';
import { house, store } from '../voxel/models/buildings.js';

const CHUNK = 16; // ground chunk size in tiles
const REGION = 16; // tree instancing region size in tiles (small so off-screen trees get culled)
const CELL = 0.5; // ground is 2x2 cells per tile
const V = 1 / 8; // model voxel size

const TREE_VARIANTS = {
  [TREE_KIND.OAK]: [0, 1, 2, 3].map((v) => oakTree(v)),
  [TREE_KIND.PINE]: [0, 1, 2].map((v) => pineTree(v)),
  [TREE_KIND.DEAD]: [0, 1].map((v) => deadTree(v)),
  [TREE_KIND.SNOW_PINE]: [0, 1, 2].map((v) => snowyPine(v)),
  [TREE_KIND.CRYSTAL]: [0, 1, 2, 3].map((v) => crystalTree(v)),
};
// the ground under a tree, by kind of tree
// mountain rock by land (realms.js ROCK_STYLE): grey, Frost's blue-grey, Ember's basalt, Glimmer's
// pastel crystal; high Frost and grey peaks get snow on top, and Ember's basalt has glowing cracks
const ROCK_COLORS = [
  ['#7d7672', '#8a827d', '#6f6864', '#948c86'],
  ['#8a96a8', '#9aa6b6', '#7f8b9c', '#a4afbd'],
  ['#2e2626', '#3b302e', '#463936', '#332a29'],
  ['#cdb8f0', '#f0c2e0', '#b8e8ee', '#e8d8ff'],
];
const SNOW_LINE = [6.2, 3.4, Infinity, Infinity];
const SNOW = ['#ffffff', '#eef4fd', '#f6f9ff'];
const LAVA_CRACK = ['#ff6a1a', '#ff8c1a'];
const TREE_GROUND = { [TREE_KIND.DEAD]: T.VOLCANIC, [TREE_KIND.SNOW_PINE]: T.SNOW, [TREE_KIND.CRYSTAL]: T.CRYSTAL };

const DETAIL = {
  grass: ['#7fd16f', '#4a9e3f'],
  flower: ['#f5d33b', '#ffffff', '#e84a7f', '#7aa8ff'],
  pebble: ['#9a8a70', '#8a7a62', '#a89878'],
  rock: ['#2e2626', '#3b302e'],
  snow: ['#ffffff', '#eef4fd'],
  crystal: ['#ff9fd0', '#8ff0ff', '#c9a6ff', '#ffe27a'],
};

// Accumulates faces of axis-aligned boxes into one geometry.
class BoxBatch {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.idx = [];
    this.n = 0;
    this.c = new THREE.Color();
  }

  quad(a, b, c, d, normal, hex, shade) {
    this.c.set(hex).multiplyScalar(shade);
    for (const p of [a, b, c, d]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(normal[0], normal[1], normal[2]);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
    const n = this.n;
    this.idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    this.n += 4;
  }

  // faces: top is a boolean; each side is false (skip), true (full height) or the y it starts from.
  box(x0, y0, z0, x1, y1, z1, hex, faces = { top: true, px: true, nx: true, pz: true, nz: true }, shade = 1) {
    const bot = (f) => (f === true ? y0 : f);
    const has = (f) => f !== false && f != null;
    if (faces.top) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], hex, shade);
    if (has(faces.px)) {
      const b = bot(faces.px);
      this.quad([x1, b, z0], [x1, y1, z0], [x1, y1, z1], [x1, b, z1], [1, 0, 0], hex, shade * 0.86);
    }
    if (has(faces.nx)) {
      const b = bot(faces.nx);
      this.quad([x0, b, z1], [x0, y1, z1], [x0, y1, z0], [x0, b, z0], [-1, 0, 0], hex, shade * 0.86);
    }
    if (has(faces.pz)) {
      const b = bot(faces.pz);
      this.quad([x1, b, z1], [x1, y1, z1], [x0, y1, z1], [x0, b, z1], [0, 0, 1], hex, shade * 0.93);
    }
    if (has(faces.nz)) {
      const b = bot(faces.nz);
      this.quad([x0, b, z0], [x0, y1, z0], [x1, y1, z0], [x1, b, z0], [0, 0, -1], hex, shade * 0.93);
    }
  }

  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// Trees dissolve (dithered) where they would hide the player: right next to the camera,
// and along the line from the camera to the player. Shadows are unaffected.
function makeTreeMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.userData.uniforms = { uPlayerView: { value: new THREE.Vector3(0, 0, -1000) } };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPlayerView = mat.userData.uniforms.uPlayerView;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vViewPos;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvViewPos = mvPosition.xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vViewPos;\nuniform vec3 uPlayerView;')
      .replace(
        'void main() {',
        `void main() {
          float keep = smoothstep(0.8, 2.2, length(vViewPos));
          vec3 toPlayer = normalize(uPlayerView);
          float along = dot(vViewPos, toPlayer);
          if (along < length(uPlayerView) - 0.3) {
            float side = length(vViewPos - toPlayer * along);
            keep = min(keep, smoothstep(0.45, 0.85, side));
          }
          float noise = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
          if (keep < noise) discard;`,
      );
  };
  return mat;
}

function makeLiquidMaterial(opts) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, ...opts });
  mat.userData.uniforms = { uTime: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = mat.userData.uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        if (normal.y > 0.5) {
          transformed.y += sin(position.x * 2.7 + uTime * 1.8) * 0.02 + cos(position.z * 2.3 + uTime * 1.4) * 0.02;
        }`,
      );
  };
  return mat;
}

export class WorldRenderer {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.waterMat = makeLiquidMaterial({});
    this.lavaMat = makeLiquidMaterial({ emissive: new THREE.Color('#ff4a00'), emissiveIntensity: 0.6 });
    this.rng = createRng(world.seed + ':render');
    this.treeInstances = new Map(); // tile index → { mesh, index } for each tree
    this.buildingMeshes = []; // one per world.buildings entry
    this.buildGround();
    this.buildTrees();
    this.buildBuildings();
  }

  heightAt(x, z) {
    const w = this.world;
    if (x < 0 || z < 0 || x >= w.width || z >= w.height) return 0.25;
    const t = w.tiles[z * w.width + x];
    // mountains: each column of rock its own height (realms.js)
    if (t === T.ROCK) return w.rockHeight?.[z * w.width + x] || 3;
    return TILE_INFO[t].height;
  }

  groundColors(x, z) {
    const w = this.world;
    const i = z * w.width + x;
    const t = w.tiles[i];
    if (t === T.TREE && TREE_GROUND[w.treeKind[i]] !== undefined) return TILE_INFO[TREE_GROUND[w.treeKind[i]]].colors;
    return TILE_INFO[t].colors;
  }

  buildGround() {
    const w = this.world;
    const rng = this.rng;
    for (let cz = 0; cz < w.height; cz += CHUNK) {
      for (let cx = 0; cx < w.width; cx += CHUNK) {
        const land = new BoxBatch(), water = new BoxBatch(), lava = new BoxBatch();
        for (let z = cz; z < cz + CHUNK; z++) {
          for (let x = cx; x < cx + CHUNK; x++) {
            const t = w.tiles[z * w.width + x];
            const h = this.heightAt(x, z);
            const batch = t === T.WATER ? water : t === T.LAVA ? lava : land;
            const colors = this.groundColors(x, z);
            if (t === T.ROCK) {
              this.addRock(land, x, z, h);
              continue;
            }
            // side faces only where the neighbour is lower
            const side = (nx, nz) => {
              const nh = this.heightAt(nx, nz);
              return nh < h ? nh : false;
            };
            for (let sz = 0; sz < 2; sz++) {
              for (let sx = 0; sx < 2; sx++) {
                const x0 = x + sx * CELL, z0 = z + sz * CELL;
                batch.box(x0, 0, z0, x0 + CELL, h, z0 + CELL, rng.pick(colors), {
                  top: true,
                  px: sx === 1 ? side(x + 1, z) : false,
                  nx: sx === 0 ? side(x - 1, z) : false,
                  pz: sz === 1 ? side(x, z + 1) : false,
                  nz: sz === 0 ? side(x, z - 1) : false,
                }, 0.94 + rng.next() * 0.12);
              }
            }
            this.addDetail(land, t, x, z, h);
          }
        }
        for (const [batch, mat] of [[land, voxelMaterial], [water, this.waterMat], [lava, this.lavaMat]]) {
          if (!batch.n) continue;
          const mesh = new THREE.Mesh(batch.toGeometry(), mat);
          mesh.receiveShadow = true;
          mesh.castShadow = false;
          this.group.add(mesh);
        }
      }
    }
  }

  // A column of mountain rock, with a snow cap above the snow line or glowing cracks in basalt.
  addRock(batch, x, z, h) {
    const w = this.world, rng = this.rng;
    const style = w.rockStyle?.[z * w.width + x] ?? 0;
    const colors = ROCK_COLORS[style];
    const cap = h > SNOW_LINE[style] ? 0.3 : 0;
    const side = (nx, nz) => {
      const nh = this.heightAt(nx, nz);
      return nh < h ? nh : false;
    };
    for (let sz = 0; sz < 2; sz++)
      for (let sx = 0; sx < 2; sx++) {
        const x0 = x + sx * CELL, z0 = z + sz * CELL;
        const faces = {
          top: !cap,
          px: sx === 1 ? side(x + 1, z) : false,
          nx: sx === 0 ? side(x - 1, z) : false,
          pz: sz === 1 ? side(x, z + 1) : false,
          nz: sz === 0 ? side(x, z - 1) : false,
        };
        const color = style === 2 && rng.chance(0.025) ? rng.pick(LAVA_CRACK) : rng.pick(colors);
        batch.box(x0, 0, z0, x0 + CELL, h - cap, z0 + CELL, color, faces, 0.94 + rng.next() * 0.12);
        if (cap) {
          const capSide = (f) => (f === false ? false : Math.max(f, h - cap));
          batch.box(x0, h - cap, z0, x0 + CELL, h, z0 + CELL, rng.pick(SNOW), { top: true, px: capSide(faces.px), nx: capSide(faces.nx), pz: capSide(faces.pz), nz: capSide(faces.nz) });
        }
      }
  }

  // Little voxel decorations so tiles don't look flat.
  addDetail(batch, t, x, z, h) {
    const rng = this.rng;
    const s = V;
    const tuft = (px, pz, height, color) => batch.box(px, h, pz, px + s, h + height, pz + s, color);
    if (t === T.TALL_GRASS) {
      // Pokémon-style tall grass: a field of blades
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++) {
          const px = x + 0.06 + i * 0.24 + rng.next() * 0.04, pz = z + 0.06 + j * 0.24 + rng.next() * 0.04;
          tuft(px, pz, 0.22 + rng.next() * 0.16, rng.pick(['#2f7d2f', '#3d8b3d', '#4a9e3f']));
        }
    } else if (t === T.GRASS && rng.chance(0.35)) {
      const n = rng.int(1, 3);
      for (let i = 0; i < n; i++) {
        const px = x + rng.int(0, 7) * s, pz = z + rng.int(0, 7) * s;
        if (rng.chance(0.15)) {
          // flower: green stem, colored head
          tuft(px, pz, s * 1.5, '#4a9e3f');
          batch.box(px - s * 0.25, h + s * 1.5, pz - s * 0.25, px + s * 1.25, h + s * 2.25, pz + s * 1.25, rng.pick(DETAIL.flower));
        } else {
          tuft(px, pz, s, rng.pick(DETAIL.grass));
        }
      }
    } else if (t === T.DIRT && rng.chance(0.25)) {
      tuft(x + rng.int(0, 7) * s, z + rng.int(0, 7) * s, s * 0.5, rng.pick(DETAIL.pebble));
    } else if (t === T.SNOW && rng.chance(0.3)) {
      // little drifts of snow
      const px = x + rng.int(0, 6) * s, pz = z + rng.int(0, 6) * s;
      batch.box(px, h, pz, px + s * 2, h + s * 0.6, pz + s * 1.5, rng.pick(DETAIL.snow));
    } else if (t === T.CRYSTAL && rng.chance(0.3)) {
      // tiny crystal sprigs
      const px = x + rng.int(0, 7) * s, pz = z + rng.int(0, 7) * s;
      tuft(px, pz, s * (1 + rng.int(0, 2)), rng.pick(DETAIL.crystal));
    } else if (t === T.VOLCANIC && rng.chance(0.2)) {
      const px = x + rng.int(0, 6) * s, pz = z + rng.int(0, 6) * s;
      batch.box(px, h, pz, px + s * 2, h + s * 1.5, pz + s * 2, rng.pick(DETAIL.rock));
    }
  }

  buildTrees() {
    this.treeMat = makeTreeMaterial();
    const w = this.world;
    const geos = {};
    for (const [kind, variants] of Object.entries(TREE_VARIANTS)) {
      geos[kind] = variants.map((g) => buildGeometry(g, { size: V, origin: [4, 0, 4] }));
    }
    // bucket instances by region + kind + variant
    const buckets = new Map();
    for (const o of w.objects) {
      if (o.type !== 'tree') continue;
      const nv = geos[o.kind].length;
      const v = o.variant % nv;
      const key = `${(o.x / REGION) | 0},${(o.z / REGION) | 0},${o.kind},${v}`;
      if (!buckets.has(key)) buckets.set(key, { kind: o.kind, v, list: [] });
      buckets.get(key).list.push(o);
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (const { kind, v, list } of buckets.values()) {
      const mesh = new THREE.InstancedMesh(geos[kind][v], this.treeMat, list.length);
      list.forEach((o, i) => {
        const r = o.variant;
        q.setFromAxisAngle(up, ((r >> 3) % 4) * (Math.PI / 2));
        const s = 0.9 + ((r >> 5) % 8) * 0.04;
        sc.set(s, s * (0.95 + ((r >> 2) % 3) * 0.06), s);
        p.set(o.x + 0.5, this.heightAt(o.x, o.z), o.z + 0.5);
        mesh.setMatrixAt(i, m.compose(p, q, sc));
        this.treeInstances.set(o.z * w.width + o.x, { mesh, index: i });
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
    }
  }

  buildBuildings() {
    for (const b of this.world.buildings) {
      const grid = b.type === 'store' ? store(b.variant) : house(b.variant);
      const mesh = new THREE.Mesh(buildGreedyGeometry(grid, { size: V }), voxelMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(-b.w / 2, 0, -b.d / 2);
      const holder = new THREE.Group();
      holder.position.set(b.x + b.w / 2, 0.25, b.z + b.d / 2);
      holder.rotation.y = b.doorDir === 0 ? Math.PI : 0;
      holder.add(mesh);
      this.group.add(holder);
      this.buildingMeshes.push(mesh);
    }
  }

  // Where the player is, in the camera's view space (used to see through trees).
  setPlayerView(viewPos) {
    this.treeMat.userData.uniforms.uPlayerView.value.copy(viewPos);
  }

  update(time) {
    this.waterMat.userData.uniforms.uTime.value = time;
    this.lavaMat.userData.uniforms.uTime.value = time;
    this.lavaMat.emissiveIntensity = 0.55 + Math.sin(time * 2) * 0.15;
  }

  dispose() {
    this.group.traverse((o) => o.geometry?.dispose());
    this.waterMat.dispose();
    this.lavaMat.dispose();
    this.treeMat.dispose();
  }
}

