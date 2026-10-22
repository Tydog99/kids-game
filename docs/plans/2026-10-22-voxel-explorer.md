# Voxel Explorer — Implementation Plan

**Goal:** A browser game for kids. You pick a boy or girl character and walk around a procedurally generated voxel world in the style of the original Pokémon games, with a third-person camera directly behind the character. A world seed makes the same world come back every time.

**Architecture:** Vite + vanilla JS ES modules + three.js. The world is a 2D tile grid, like a Pokémon overworld. Each tile type (grass, dirt, sand, water, volcanic rock, lava) becomes a stack of voxels. Trees, houses, stores and characters are small voxel models written as code (layered character grids), so no art files are needed. Every random choice goes through one seeded PRNG, so the same seed always produces the same world. Movement snaps to the grid, tile to tile, like Pokémon, with smooth tweening between tiles.

**Tech stack:** three.js (r170+), Vite, simplex-noise (with a seeded PRNG), Vitest for the pure-logic modules.

---

## Design decisions (change these before we start if you want something different)

| Topic | Decision |
|---|---|
| Movement | Grid-based, one tile per step, ~180ms tween. **Up** = step forward. **Down** = step back. **Left/Right** = turn 90° (the camera swings smoothly to stay behind). This keeps the camera directly behind the player at all times. WASD works too. |
| Camera | Follows behind and above (≈4 tiles back, 3 up), looks slightly ahead, and lerps for smoothness. |
| World size | A fixed 128×128 tiles for v1, with an invisible wall (tree border) at the edges like Pokémon routes. Infinite chunked worlds can come later. |
| Voxel scale | 1 tile = 1 world unit = 8×8 voxels across. Ground tiles are a flat top layer plus a little detail (grass tufts, pebbles). Characters are about 8 wide × 16 tall voxels. |
| Rendering | One `InstancedMesh` of unit cubes per model, with per-instance color. Static world voxels are merged per 16×16-tile chunk (`BufferGeometryUtils.mergeGeometries`) to keep draw calls low. |
| Seed | Text input on the title screen (blank = random), also read from `?seed=` in the URL. The seed is shown on screen so kids can share good worlds. |
| Buildings | **House** (red roof, 3×3 footprint) and **Store** (blue roof, 4×3, sign). Both are solid, with a door tile in front. Going inside is out of scope for v1. |

## File structure

```
index.html
package.json
src/
  main.js              # boot: title screen → game
  rng.js               # seeded PRNG + helpers (pure)
  tiles.js             # tile type enum + properties (walkable, colors) (pure)
  worldgen.js          # seed → tile grid + objects list (pure, tested)
  voxel/
    model.js           # parse layered string grids → voxel list (pure)
    builder.js         # voxel list → three.js mesh (instanced / merged)
    models/
      trees.js  house.js  store.js  boy.js  girl.js
  world/
    WorldRenderer.js   # builds chunk meshes from worldgen output
  player/
    Player.js          # grid position, facing, step tween, walk anim
    input.js           # keyboard → intents
  camera/
    FollowCamera.js
  ui/
    titleScreen.js  hud.js  style.css
tests/
  rng.test.js  worldgen.test.js  model.test.js  player.test.js
```

---

## Task 1: Project scaffold

**Files:** `package.json`, `index.html`, `src/main.js`, `src/ui/style.css`

1. `npm create vite@latest . -- --template vanilla`, then `npm i three simplex-noise` and `npm i -D vitest`.
2. Add `"test": "vitest run"` to `package.json`.
3. In `main.js`, render a spinning cube with a `WebGLRenderer`, a `PerspectiveCamera`, a `HemisphereLight` and a `DirectionalLight` with shadows, plus a resize handler.
4. Verify: `npm run dev` shows the cube, and `npm test` runs (no tests yet).
5. Commit: `chore: scaffold vite + three.js`.

## Task 2: Seeded RNG (TDD)

**Files:** `src/rng.js`, `tests/rng.test.js`

1. Write tests first:
   - The same seed string gives the same first 100 numbers.
   - Different seeds give different sequences.
   - `int(a,b)` stays within bounds, and `pick(arr)` returns an element of the array.
2. Implement it:
   ```js
   export function hashSeed(str) { // xmur3
     let h = 1779033703 ^ str.length;
     for (let i = 0; i < str.length; i++) {
       h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
       h = (h << 13) | (h >>> 19);
     }
     h = Math.imul(h ^ (h >>> 16), 2246822507);
     h = Math.imul(h ^ (h >>> 13), 3266489909);
     return (h ^= h >>> 16) >>> 0;
   }
   export function createRng(seed) { // mulberry32
     let a = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
     const next = () => {
       a |= 0; a = (a + 0x6d2b79f5) | 0;
       let t = Math.imul(a ^ (a >>> 15), 1 | a);
       t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
       return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
     };
     return {
       next,
       int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
       pick: (arr) => arr[Math.floor(next() * arr.length)],
       chance: (p) => next() < p,
     };
   }
   ```
3. Tests pass. Commit: `feat: seeded rng`.

## Task 3: Tile types

**Files:** `src/tiles.js`

```js
export const T = { GRASS: 0, TALL_GRASS: 1, DIRT: 2, SAND: 3, WATER: 4, VOLCANIC: 5, LAVA: 6, TREE: 7 };
export const TILE_INFO = {
  [T.GRASS]:      { walkable: true,  height: 1, colors: ['#5cb85c', '#4cae4c', '#6cc96c'] },
  [T.TALL_GRASS]: { walkable: true,  height: 1, colors: ['#3d8b3d', '#2f7a2f'] },
  [T.DIRT]:       { walkable: true,  height: 1, colors: ['#c8a165', '#b88f55'] },
  [T.SAND]:       { walkable: true,  height: 1, colors: ['#f0dc9a', '#e6cf85'] },
  [T.WATER]:      { walkable: false, height: 0.8, colors: ['#3fa9f5', '#5bb8f7'], animated: true },
  [T.VOLCANIC]:   { walkable: true,  height: 1, colors: ['#4a3f3f', '#5a4a48', '#3a3030'] },
  [T.LAVA]:       { walkable: false, height: 0.8, colors: ['#ff5a1f', '#ff8c1a'], emissive: true },
  [T.TREE]:       { walkable: false, height: 1, colors: ['#5cb85c'] }, // grass base + tree model
};
```
Commit: `feat: tile definitions`.

## Task 4: World generation (TDD, the core of the project)

**Files:** `src/worldgen.js`, `tests/worldgen.test.js`

Output: `{ seed, width, height, tiles: Uint8Array, objects: [{type:'house'|'store'|'tree', x, z, w, d, rot}], spawn: {x, z} }`

Pipeline, all driven by `createRng(seed)`, with simplex noise seeded from `rng.next`:
1. **Biomes:** combine two noise fields. Elevation `e` decides water (`e < -0.35`) and sand at the shore (`e < -0.25`). Heat `h` makes volcanic regions (`h > 0.55`, about 10% of the map), with lava pools inside them where `h > 0.7` and a second noise is high. Everything else is grass, and higher moisture adds tall grass patches.
2. **Forests:** where forest noise is above 0.3 on grass, place a tree on ~60% of tiles. Always put a 2-tile tree border around the map edge.
3. **Towns:** pick 2–4 town centers on large grass areas, keeping them at least 30 tiles apart. Around each center, clear a 14×14 area, lay a dirt plaza, then place 1 store and 2–5 houses with a dirt tile in front of every door. Retry placement up to N times if a footprint overlaps water, lava or another building.
4. **Paths:** connect the towns with dirt paths (an L-shaped walk with a little noise wobble), turning trees on the path into dirt. Paths across water become sand "bridges" for v1.
5. **Spawn:** the dirt tile in front of the first town's store.
6. **Reachability:** flood-fill from spawn and check that every building door is reachable. If a door isn't, carve a dirt path to it.

Tests:
- The same seed gives byte-identical `tiles` and deep-equal `objects`. A different seed gives different tiles.
- The spawn tile is walkable.
- No building footprint overlaps water, lava or another building.
- Every door is reachable from spawn (BFS).
- The map edge is all trees.
- Across 20 seeds: at least 1 store, at least 2 houses, and some volcanic tiles in most seeds (a loose check).

Commit: `feat: deterministic world generation`.

## Task 5: Voxel model format (TDD)

**Files:** `src/voxel/model.js`, `tests/model.test.js`

Models are written as a palette plus layers of strings, from bottom to top. Each character is a palette key, and `.` means empty:
```js
export const boy = {
  palette: { s: '#f1c27d', h: '#6b4423', b: '#3b6fd6', j: '#2b3f73', w: '#ffffff', k: '#222222' },
  layers: [ /* y=0 */ ['..jj.jj..', ...], /* y=1 */ [...], ... ],
};
```
`parseModel(def) → [{x, y, z, color}]`, centered on x/z with the bottom at y=0. Tests cover the voxel count, the color mapping, `.` being skipped and centering.

To keep the art easy to write, also add `box(x0, y0, z0, x1, y1, z1, color)` helpers, so trees, houses and stores can be built from boxes in code instead of hand-written layers.

Commit: `feat: voxel model parser`.

## Task 6: Voxel → three.js builder

**Files:** `src/voxel/builder.js`

- `buildInstanced(voxels, voxelSize)`: one `InstancedMesh(BoxGeometry, MeshLambertMaterial)` with `setColorAt` for each voxel. Used for characters (body parts are separate meshes so they can animate).
- `buildMerged(voxels, voxelSize)`: bakes positions and colors into one `BufferGeometry` with vertex colors. Used for static world chunks.
- Hidden-face culling inside `buildMerged`: skip a face if the neighboring voxel is filled. This matters for performance.
- Add a small random brightness jitter (±6%) to each voxel color, so surfaces look hand-made like the reference images.

Verify visually: render one tree and one house in the scaffold scene. Commit: `feat: voxel mesh builders`.

## Task 7: Models (art pass)

**Files:** `src/voxel/models/{trees,house,store,boy,girl}.js`

- **Trees:** a round oak (brown trunk, a lumpy green canopy built from 3 overlapping boxes plus a few random voxels) and a pine. Volcanic biomes get a dead/charred tree variant. Tree variety comes from the world rng.
- **House:** white walls, a red stepped roof, a brown door, 2 blue windows, a chimney.
- **Store:** cream walls, a blue roof, a big window and a sign voxel strip on the front (like a Poké Mart).
- **Boy:** brown hair, a blue shirt, dark jeans, white sneakers.
- **Girl:** long dark hair, a pink/white top, shorts, brown boots (in the style of the reference images).
- Characters are split into `head`, `torso`, `armL`, `armR`, `legL`, `legR` voxel groups, each with a pivot, so they can swing.

Verify with a model-viewer debug page at `/?debug=models` that orbits around all models. Commit: `feat: voxel models`.

## Task 8: World renderer

**Files:** `src/world/WorldRenderer.js`

- Split the map into 16×16-tile chunks. For each chunk, collect the ground voxels (the top layer of 8×8 per tile, with tile colors chosen per voxel by the rng; water and lava tops sit lower), add the tree/building voxels whose origin is in the chunk, then run `buildMerged` to get one mesh per chunk.
- Water and lava are a separate animated mesh: a shader-free approach that shifts the instance colors over time, or a gentle y-bob.
- Lava gets `emissive` plus a dim orange `PointLight` per cluster (with a cap on how many).
- Use `scene.fog` matched to the sky color to hide the map edges.

Verify: generate the seed `"pallet"` and fly the debug orbit camera around. Commit: `feat: world rendering`.

## Task 9: Player + input (TDD for the logic)

**Files:** `src/player/Player.js`, `src/player/input.js`, `tests/player.test.js`

- State: `{tileX, tileZ, facing: 0..3, moving, t}`.
- `tryStep(dir)`: compute the target tile and check `world.isWalkable(x, z)`. If it is walkable, start a tween; if not, play a small "bump" animation.
- Turning: tween the rotation over ~150ms. Input is ignored during a step or turn. A held key repeats the step (continuous walking, like Pokémon).
- Walk animation: arms and legs swing ±30° on a sine wave over the step, plus a slight body bob.
- Tests (pure logic, no three.js): you can't step into trees, water, lava or buildings; facing wraps around correctly; stepping back keeps the facing.

Commit: `feat: grid player movement`.

## Task 10: Follow camera

**Files:** `src/camera/FollowCamera.js`

- Each frame, the desired position = player position − forward × 4 + up × 3, and the look-at target = player position + forward × 1.5 + up × 0.8.
- Lerp the position (`1 - exp(-8·dt)`) and the yaw, so a 90° turn swings smoothly.

Verify by feel: walking and turning look smooth. Commit: `feat: third-person follow camera`.

## Task 11: Title screen + HUD

**Files:** `src/ui/titleScreen.js`, `src/ui/hud.js`, `src/ui/style.css`, `src/main.js`

- Title screen: the game name, two big character cards (Boy / Girl) showing live-rendered spinning voxel previews, a seed text box with a 🎲 random button, and a big **Play** button. It uses large, kid-friendly buttons.
- HUD: the seed in a corner (click to copy a share link with `?seed=`), an arrow-key hint that fades out after the first moves, and a **New World** button.
- `main.js` flow: title → `generateWorld(seed)` → build the renderer → spawn the player → start the game loop.

Commit: `feat: title screen and hud`.

## Task 12: Polish + verification

1. Performance: aim for a steady 60fps on a mid-range laptop. Check `renderer.info.render.calls`, which should be under ~100.
2. Ambient life: grass tufts sway, small particles drift up from the lava, and an optional little day/sky gradient.
3. Optional: footstep sounds (WebAudio blips).
4. Final checks: `npm test` all green. `npm run build` gives a static `dist/` that can be opened from any static host. Manual playtest on 3 seeds, checking each biome, a town, collisions and both characters.
5. Commit: `chore: polish`.

---

## Later (not v1)
Entering buildings, NPCs, tall-grass encounters, infinite chunked worlds, touch controls for tablets, and saving progress.
