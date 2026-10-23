export const T = {
  GRASS: 0,
  TALL_GRASS: 1,
  DIRT: 2,
  SAND: 3,
  WATER: 4,
  VOLCANIC: 5,
  LAVA: 6,
  TREE: 7,
  BUILDING: 8,
  ICE: 9, // a frozen lake tile (made by ice breath), walkable
  // the dragon lands beyond the map (see realms.js)
  SNOW: 10,
  CRYSTAL: 11, // sparkly crystal moss in Glimmer's forest
  ROCK: 12, // mountains walling the lands in: tall, can't be walked through
  GATE: 13, // a magic gate across a corridor, until its dragon is your friend
};

// height: top surface of the tile in world units (1 tile = 1 unit).
export const TILE_INFO = {
  [T.GRASS]: { walkable: true, height: 0.25, colors: ['#5cb85c', '#4fae4f', '#68c468', '#57b357'] },
  [T.TALL_GRASS]: { walkable: true, height: 0.25, colors: ['#3d8b3d', '#347f34', '#449944'] },
  [T.DIRT]: { walkable: true, height: 0.25, colors: ['#c8a165', '#bd955a', '#d1ab70'] },
  [T.SAND]: { walkable: true, height: 0.25, colors: ['#f0dc9a', '#e8d28a', '#f4e3aa'] },
  [T.WATER]: { walkable: false, height: 0.125, colors: ['#3fa9f5', '#4fb3f6', '#3399e6'] },
  [T.VOLCANIC]: { walkable: true, height: 0.25, colors: ['#4a3f3f', '#564846', '#3d3434', '#5e4f4c'] },
  [T.LAVA]: { walkable: false, height: 0.125, colors: ['#ff5a1f', '#ff7a1a', '#ff9a2a'] },
  [T.TREE]: { walkable: false, height: 0.25, colors: ['#4fae4f', '#5cb85c'] },
  [T.BUILDING]: { walkable: false, height: 0.25, colors: ['#bd955a', '#c8a165'] },
  [T.ICE]: { walkable: true, height: 0.25, colors: ['#d4f1ff', '#c2e8fb', '#e2f6ff'] },
  [T.SNOW]: { walkable: true, height: 0.25, colors: ['#f4f8ff', '#e8f0fb', '#ffffff', '#dfe9f7'] },
  [T.CRYSTAL]: { walkable: true, height: 0.25, colors: ['#e3d4ff', '#d4f2f0', '#f6d6ec', '#dcdcff'] },
  [T.ROCK]: { walkable: false, height: 3, colors: ['#7d7672', '#8a827d', '#6f6864', '#948c86'] },
  [T.GATE]: { walkable: false, height: 0.25, colors: ['#c8a165', '#bd955a'] },
};

export const isWalkableTile = (t) => TILE_INFO[t].walkable;

// Building footprints in tiles. The door sits in the middle of the front (+z) side.
export const BUILDING_SIZE = {
  house: { w: 5, d: 5 },
  store: { w: 7, d: 5 },
};
