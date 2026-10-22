# Voxel Explorer

A browser game for kids: choose a boy or girl and explore a procedurally
generated voxel world inspired by the original Pokémon games.

## Play

```bash
npm install
npm run dev        # open the printed localhost URL
```

`npm run build` makes a static site in `dist/`, which can be hosted anywhere
(GitHub Pages, Netlify, or any web server). `npm run build:single` writes
`dist-single/voxel-explorer.html`, the whole game in one self-contained file.

## Controls

| Key | Action |
|---|---|
| ↑ / W | Walk forward |
| ↓ / S | Step back |
| ← → / A D | Turn left / right |

Touch screens get an on-screen D-pad.

## Worlds & seeds

Every world comes from a **seed** (the text box on the title screen). The same
seed always builds the same world. Click the 🌍 seed button in-game to copy the
seed. A link can also open a world directly: `?seed=pallet` or `#pallet`.

## Code tour

| Path | What it does |
|---|---|
| `src/rng.js` | Seeded random numbers. All randomness goes through here. |
| `src/worldgen.js` | Seed → tile grid: biomes, forests, towns, roads, spawn. |
| `src/tiles.js` | Tile types (grass, dirt, sand, water, volcanic, lava…). |
| `src/voxel/` | Voxel grid, mesh builder and the voxel models (trees, buildings, characters). |
| `src/world/WorldRenderer.js` | Turns the tile grid into chunked three.js meshes. |
| `src/player/` | Grid movement (`PlayerMotor`), keyboard input, and the animated character. |
| `src/camera/FollowCamera.js` | Third-person camera directly behind the player. |
| `src/ui/` | Title screen, HUD, styles. |

`npm test` runs the unit tests (world generation, movement, voxel grid, RNG).
