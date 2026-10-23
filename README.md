# Voxel Explorer

A browser game for kids: choose a boy or girl and explore a procedurally
generated voxel world inspired by the original Pokémon games.

## Play

```bash
npm install
npm run dev        # open the printed localhost URL
```

`npm run build` makes a static site in `dist/`, which can be hosted anywhere
(GitHub Pages, Netlify, or any web server). `npm run build:single` writes each page
(`voxel-explorer.html` and `dragon-designs.html`) to `dist-single/` as one self-contained file.

`/dragons.html` is a viewer for the three dragon designs (Ember, Glimmer, Frost): switch
between walking, rearing up and flying, and drag to look around.

## Modes

- **Adventure** ("The Dragon Keeper"): Grandpa Ollie lost the 3 golden keys to his treasure
  chest. Dragons fly overhead while you search; opening the chest finds the Dragon Book and the
  three dragons land. Each needs your help before it will trust you. Progress saves per world.
  Grown-ups can skip ahead or start over from the settings panel.
- **Free Play**: everything unlocked, with a slider for how many dragons roam the world.

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
| `src/adventure/` | Adventure mode: story progress (`adventure.js`), Grandpa Ollie, and the `Story` that runs it. |
| `src/creatures/` | Dragon designs (`dragonModels.js`) and their rig and poses (`Dragon.js`). |

`npm test` runs the unit tests (world generation, movement, voxel grid, RNG).
