import { gidOf } from './art.mjs';

export const MAP_W = 40;
export const MAP_H = 30;
const RX = 19;
const RY = 12;

export const GAME_CONFIG = {
  title: 'POKE GAME',
  playerName: 'HERO',
  textSpeed: 2,
  showDebug: true,
  start: { map: 'town', x: 8, y: 9, facing: 'down' },
  defaultFlags: {
    running_shoes: true,
    dungeon1_cleared: false,
    dungeon2_cleared: false,
    dungeon3_cleared: false,
    dungeon4_cleared: false,
  },
  maps: [
    'town',
    'player_house',
    'poke_center',
    'poke_mart',
    'lab',
    'route_forest',
    'route_snow',
    'route_beach',
    'route_mountain',
    'route_desert',
    'dungeon_forest',
    'dungeon_snow',
    'dungeon_beach',
    'dungeon_mountain',
    'dungeon_desert',
  ],
  dialogue: ['world'],
};

function createMap(id, name, w, h, extra = {}) {
  const n = w * h;
  return {
    id,
    name,
    w,
    h,
    showName: extra.showName ?? true,
    interior: extra.interior ?? false,
    ground: new Array(n).fill(0),
    objects: new Array(n).fill(0),
    fringe: new Array(n).fill(0),
    overhead: new Array(n).fill(0),
    path: new Uint8Array(n),
    block: new Uint8Array(n),
    warps: [],
    connections: [],
    gates: [],
    signs: [],
    items: [],
  };
}

const at = (map, x, y) => y * map.w + x;
const inside = (map, x, y) => x >= 0 && y >= 0 && x < map.w && y < map.h;

function put(layer, map, x, y, gid) {
  if (!inside(map, x, y) || !gid) return;
  map[layer][at(map, x, y)] = gid;
}

function fillGround(map, gid) {
  map.ground.fill(gid);
}

function markPath(map, x, y) {
  if (!inside(map, x, y)) return;
  map.path[at(map, x, y)] = 1;
  map.block[at(map, x, y)] = 0;
}

function roadV(map, x, y0, y1) {
  const a = Math.min(y0, y1);
  const b = Math.max(y0, y1);
  for (let y = a; y <= b; y++) {
    markPath(map, x, y);
    markPath(map, x + 1, y);
  }
}

function roadH(map, y, x0, x1) {
  const a = Math.min(x0, x1);
  const b = Math.max(x0, x1);
  for (let x = a; x <= b; x++) {
    markPath(map, x, y);
    markPath(map, x, y + 1);
  }
}

function occupy(map, x, y) {
  if (inside(map, x, y)) map.block[at(map, x, y)] = 1;
}

function freeCell(map, x, y) {
  return inside(map, x, y) && map.path[at(map, x, y)] === 0 && map.block[at(map, x, y)] === 0;
}

function building(map, x, y, w, h, style, g) {
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const tx = x + col;
      const ty = y + row;
      occupy(map, tx, ty);
      const left = col === 0;
      const right = col === w - 1;
      const doorHere = row === h - 1 && col === Math.floor(w / 2);
      if (row === 0) put('overhead', map, tx, ty, g(`roof_${style}_${left ? 'tl' : right ? 'tr' : 'top'}`));
      else if (row === 1) put('overhead', map, tx, ty, g(`roof_${style}_${left ? 'bl' : right ? 'br' : 'eave'}`));
      else if (doorHere) {
        put('objects', map, tx, ty, g(`door_${style}`));
        markPath(map, tx, ty);
      } else if (row === h - 2 && (col === 2 || col === w - 3 || col === Math.floor(w / 2))) {
        put('objects', map, tx, ty, g('wall_window'));
      } else {
        put('objects', map, tx, ty, g('wall'));
      }
    }
  }
  return { x: x + Math.floor(w / 2), y: y + h - 1 };
}

function tryTree(map, x, y, snow, g) {
  const cells = [
    [x, y],
    [x + 1, y],
    [x, y + 1],
    [x + 1, y + 1],
  ];
  if (!cells.every(([cx, cy]) => freeCell(map, cx, cy))) return false;
  const prefix = snow ? 'stree' : 'tree';
  put('overhead', map, x, y, g(`${prefix}_tl`));
  put('overhead', map, x + 1, y, g(`${prefix}_tr`));
  put('objects', map, x, y + 1, g(`${prefix}_bl`));
  put('objects', map, x + 1, y + 1, g(`${prefix}_br`));
  cells.forEach(([cx, cy]) => occupy(map, cx, cy));
  return true;
}

function borderTrees(map, g, snow = false) {
  for (let y = 0; y < map.h - 1; y += 2) {
    for (let x = 0; x < map.w - 1; x += 2) {
      const edge = x === 0 || y === 0 || x >= map.w - 2 || y >= map.h - 2;
      if (!edge) continue;
      tryTree(map, x, y, snow, g);
    }
  }
}

function borderCliffs(map, g) {
  for (let x = 0; x < map.w; x++) {
    stampCliff(map, x, 0, g);
    stampCliff(map, x, map.h - 1, g);
  }
  for (let y = 0; y < map.h; y++) {
    stampCliff(map, 0, y, g);
    stampCliff(map, map.w - 1, y, g);
  }
}

function stampCliff(map, x, y, g) {
  if (!freeCell(map, x, y)) return;
  put('objects', map, x, y, g((x + y) % 2 === 0 ? 'cliff' : 'cliff_b'));
  occupy(map, x, y);
}

function gateH(map, x, y, flag, g) {
  put('objects', map, x - 1, y, g('fence_post'));
  put('objects', map, x + 2, y, g('fence_post'));
  occupy(map, x - 1, y);
  occupy(map, x + 2, y);
  map.path[at(map, x - 1, y)] = 0;
  map.path[at(map, x + 2, y)] = 0;
  map.gates.push({ x, y, w: 2, h: 1, flag, tiles: [g('bar_l'), g('bar_r')] });
}

function gateV(map, x, y, flag, g) {
  put('objects', map, x, y - 1, g('fence_post'));
  put('objects', map, x, y + 2, g('fence_post'));
  occupy(map, x, y - 1);
  occupy(map, x, y + 2);
  if (inside(map, x, y - 1)) map.path[at(map, x, y - 1)] = 0;
  if (inside(map, x, y + 2)) map.path[at(map, x, y + 2)] = 0;
  map.gates.push({ x, y, w: 1, h: 2, flag, tiles: [g('bar_v'), g('bar_v')] });
}

function sign(map, x, y, dialogue, g) {
  if (!freeCell(map, x, y)) return;
  put('objects', map, x, y, g('sign'));
  occupy(map, x, y);
  map.signs.push({ x, y, dialogue });
}

function resolvePaths(map, g) {
  const isPath = (x, y) => {
    if (!inside(map, x, y)) return true;
    return map.path[at(map, x, y)] === 1;
  };
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      if (!isPath(x, y)) continue;
      let mask = 0;
      if (!isPath(x, y - 1)) mask |= 1;
      if (!isPath(x + 1, y)) mask |= 2;
      if (!isPath(x, y + 1)) mask |= 4;
      if (!isPath(x - 1, y)) mask |= 8;
      put('ground', map, x, y, g(`path_${mask}`));
    }
  }
}

function salt(id) {
  let s = 0;
  for (const ch of id) s = (Math.imul(s, 33) + ch.charCodeAt(0)) >>> 0;
  return s || 1;
}

function hash(x, y, s) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1440662683)) >>> 0;
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function varyGround(map, baseIds, alts, s) {
  for (let i = 0; i < map.ground.length; i++) {
    if (!baseIds.includes(map.ground[i]) || map.path[i]) continue;
    const roll = hash(i % map.w, Math.floor(i / map.w), s);
    if (roll > 0.72) map.ground[i] = alts[roll > 0.88 ? 1 : 0];
  }
}

function flowers(map, grassIds, g, s) {
  const kinds = ['flower_red', 'flower_yellow', 'flower_white', 'flower_blue'];
  for (let y = 1; y < map.h - 1; y++) {
    for (let x = 1; x < map.w - 1; x++) {
      const i = at(map, x, y);
      if (map.path[i] || map.block[i] || !grassIds.includes(map.ground[i])) continue;
      if (hash(x, y, s + 9) > 0.93) {
        map.ground[i] = g(kinds[Math.floor(hash(x, y, s + 4) * kinds.length)]);
      }
    }
  }
}

function clumps(map, groundIds, tile, rects, g, s) {
  for (const [x0, y0, x1, y1] of rects) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!inside(map, x, y)) continue;
        const i = at(map, x, y);
        if (map.path[i] || map.block[i] || !groundIds.includes(map.ground[i])) continue;
        const noisy = hash(x, y, s) > 0.38;
        const friends =
          (hash(x - 1, y, s) > 0.38 ? 1 : 0) +
          (hash(x + 1, y, s) > 0.38 ? 1 : 0) +
          (hash(x, y - 1, s) > 0.38 ? 1 : 0) +
          (hash(x, y + 1, s) > 0.38 ? 1 : 0);
        if (noisy && friends >= 1) map.fringe[i] = g(tile);
      }
    }
  }
}

function scatterTrees(map, spots, snow, g) {
  for (const [x, y] of spots) tryTree(map, x, y, snow, g);
}

function caveMouth(map, x, y, destMap, g) {
  const cliffs = [
    [x - 1, y - 1],
    [x, y - 1],
    [x + 1, y - 1],
    [x - 1, y],
    [x + 1, y],
  ];
  for (const [cx, cy] of cliffs) {
    if (!inside(map, cx, cy)) continue;
    put('objects', map, cx, cy, g((cx + cy) % 2 === 0 ? 'cliff' : 'cliff_b'));
    occupy(map, cx, cy);
    if (map.path[at(map, cx, cy)]) map.path[at(map, cx, cy)] = 0;
  }
  put('objects', map, x, y, g('cave_hole'));
  markPath(map, x, y);
  markPath(map, x, y + 1);
  map.warps.push({ x, y, map: destMap, tx: 10, ty: 11, facing: 'up' });
  return { x, y };
}

function connect(map, side, id, offset = 0) {
  map.connections.push({ side, map: id, offset });
}

function interior(id, name, floor, style, backTo, g, furnish) {
  const map = createMap(id, name, 15, 10, { showName: false, interior: true });
  fillGround(map, g(floor));
  for (let x = 0; x < 15; x++) {
    put('objects', map, x, 0, g('wall'));
    put('objects', map, x, 1, g(x % 3 === 1 ? 'wall_window' : 'wall'));
    put('objects', map, x, 9, g(x === 7 ? 'door_shut' : 'wall'));
    occupy(map, x, 0);
    occupy(map, x, 1);
    occupy(map, x, 9);
  }
  for (let y = 0; y < 10; y++) {
    put('objects', map, 0, y, g('wall'));
    put('objects', map, 14, y, g('wall'));
    occupy(map, 0, y);
    occupy(map, 14, y);
  }
  put('ground', map, 7, 8, g('mat'));
  map.warps.push({ x: 7, y: 8, map: backTo.map, tx: backTo.x, ty: backTo.y, facing: 'down' });
  furnish(map);
  return map;
}

function dungeon(id, name, back, g) {
  const map = createMap(id, name, 20, 14);
  fillGround(map, g('floor_cave'));
  for (let x = 0; x < 20; x++) {
    put('objects', map, x, 0, g('wall_cave'));
    put('objects', map, x, 13, g('wall_cave'));
    occupy(map, x, 0);
    occupy(map, x, 13);
  }
  for (let y = 0; y < 14; y++) {
    put('objects', map, 0, y, g('wall_cave'));
    put('objects', map, 19, y, g('wall_cave'));
    occupy(map, 0, y);
    occupy(map, 19, y);
  }
  const rocks = [
    [4, 3],
    [15, 3],
    [3, 8],
    [16, 7],
    [6, 5],
    [13, 9],
  ];
  for (const [x, y] of rocks) {
    put('objects', map, x, y, g('boulder'));
    occupy(map, x, y);
  }
  put('objects', map, 4, 10, g('crate'));
  occupy(map, 4, 10);
  put('ground', map, 10, 12, g('mat'));
  map.warps.push({ x: 10, y: 12, map: back.map, tx: back.x, ty: back.y, facing: 'down' });
  sign(map, 10, 8, id, g);
  // sign() refuses occupied/path. (10,8) is free. Dialogue id matches the dungeon id.
  return map;
}

function baseOutdoor(id, name, ground, g) {
  const map = createMap(id, name, MAP_W, MAP_H);
  fillGround(map, g(ground));
  return map;
}

export function buildMaps(art) {
  const g = (name) => gidOf(art, name);
  const grassIds = [g('grass'), g('grass_b'), g('grass_c')];
  const maps = {};

  const town = baseOutdoor('town', 'WILLOW TOWN', 'grass', g);
  roadV(town, RX, 0, MAP_H - 1);
  roadH(town, RY, 0, MAP_W - 1);
  const pc = building(town, 3, 3, 11, 5, 'center', g);
  const mart = building(town, 26, 3, 10, 5, 'mart', g);
  const house = building(town, 3, 17, 9, 5, 'house', g);
  const lab = building(town, 25, 17, 11, 5, 'lab', g);
  roadV(town, pc.x, pc.y, RY);
  roadV(town, pc.x - 1, pc.y + 1, RY);
  roadV(town, mart.x, mart.y, RY);
  roadV(town, mart.x - 1, mart.y + 1, RY);
  roadH(town, house.y + 1, house.x, RX + 1);
  roadH(town, lab.y + 1, RX, lab.x);
  gateH(town, RX, 1, 'dungeon1_cleared', g);
  gateH(town, RX, MAP_H - 2, 'dungeon3_cleared', g);
  gateV(town, MAP_W - 2, RY, 'dungeon2_cleared', g);
  connect(town, 'up', 'route_snow');
  connect(town, 'down', 'route_mountain');
  connect(town, 'left', 'route_forest');
  connect(town, 'right', 'route_beach');
  town.warps.push({ x: pc.x, y: pc.y, map: 'poke_center', tx: 7, ty: 7, facing: 'up' });
  town.warps.push({ x: mart.x, y: mart.y, map: 'poke_mart', tx: 7, ty: 7, facing: 'up' });
  town.warps.push({ x: house.x, y: house.y, map: 'player_house', tx: 7, ty: 7, facing: 'up' });
  town.warps.push({ x: lab.x, y: lab.y, map: 'lab', tx: 7, ty: 7, facing: 'up' });
  // Little well beside the center path.
  put('ground', town, 15, 9, g('water_0'));
  occupy(town, 15, 9);
  for (const [x, y] of [
    [14, 8],
    [16, 8],
    [14, 10],
    [16, 10],
  ]) {
    put('objects', town, x, y, g('boulder'));
    occupy(town, x, y);
  }
  sign(town, 11, 8, 'pc_sign', g);
  sign(town, 33, 8, 'mart_sign', g);
  sign(town, 5, 23, 'house_sign', g);
  sign(town, 33, 23, 'lab_sign', g);
  sign(town, 12, 11, 'town_sign', g);
  sign(town, 22, 3, 'sign_snow', g);
  sign(town, 22, 26, 'sign_mountain', g);
  sign(town, 36, 15, 'sign_beach', g);
  sign(town, 2, 15, 'sign_forest', g);
  scatterTrees(
    town,
    [
      [14, 4],
      [18, 5],
      [22, 18],
      [16, 18],
      [36, 20],
      [0, 16],
    ],
    false,
    g,
  );
  borderTrees(town, g, false);
  resolvePaths(town, g);
  varyGround(town, [g('grass')], [g('grass_b'), g('grass_c')], salt('town'));
  flowers(town, grassIds, g, salt('town'));
  clumps(town, grassIds, 'tall', [[14, 24, 24, 27], [30, 14, 36, 20]], g, salt('town'));
  maps.town = town;

  const exits = {
    center: { map: 'town', x: pc.x, y: pc.y + 1 },
    mart: { map: 'town', x: mart.x, y: mart.y + 1 },
    house: { map: 'town', x: house.x, y: house.y + 1 },
    lab: { map: 'town', x: lab.x, y: lab.y + 1 },
  };

  maps.poke_center = interior('poke_center', 'POKE CENTER', 'floor_tile', 'center', exits.center, g, (map) => {
    for (let x = 3; x <= 11; x++) {
      put('objects', map, x, 3, g(x === 6 ? 'machine' : 'counter'));
      occupy(map, x, 3);
    }
    put('objects', map, 12, 6, g('plant'));
    occupy(map, 12, 6);
    put('objects', map, 2, 6, g('plant'));
    occupy(map, 2, 6);
  });

  maps.poke_mart = interior('poke_mart', 'POKE MART', 'floor_mart', 'mart', exits.mart, g, (map) => {
    for (const x of [2, 5, 10, 12]) {
      put('objects', map, x, 3, g('shelf'));
      occupy(map, x, 3);
    }
    for (let x = 9; x <= 12; x++) {
      put('objects', map, x, 6, g('counter'));
      occupy(map, x, 6);
    }
    put('objects', map, 2, 7, g('crate'));
    occupy(map, 2, 7);
  });

  maps.lab = interior('lab', "PROFESSOR'S LAB", 'floor_lab', 'lab', exits.lab, g, (map) => {
    put('objects', map, 3, 3, g('shelf'));
    occupy(map, 3, 3);
    put('objects', map, 11, 3, g('shelf'));
    occupy(map, 11, 3);
    put('objects', map, 3, 5, g('table'));
    occupy(map, 3, 5);
    put('objects', map, 10, 5, g('table'));
    occupy(map, 10, 5);
    put('objects', map, 12, 7, g('plant'));
    occupy(map, 12, 7);
    put('objects', map, 5, 3, g('machine'));
    occupy(map, 5, 3);
  });

  maps.player_house = interior('player_house', "PLAYER'S HOUSE", 'floor_wood', 'house', exits.house, g, (map) => {
    put('ground', map, 4, 4, g('rug'));
    put('ground', map, 5, 4, g('rug'));
    put('ground', map, 4, 5, g('rug'));
    put('ground', map, 5, 5, g('rug'));
    put('objects', map, 11, 3, g('bed_top'));
    put('objects', map, 11, 4, g('bed_bot'));
    occupy(map, 11, 3);
    occupy(map, 11, 4);
    put('objects', map, 3, 6, g('table'));
    occupy(map, 3, 6);
    put('objects', map, 12, 6, g('plant'));
    occupy(map, 12, 6);
  });

  const forest = baseOutdoor('route_forest', 'VERDANT PATH', 'grass', g);
  roadH(forest, RY, 2, MAP_W - 1);
  roadV(forest, RX, 2, MAP_H - 1);
  roadH(forest, 20, 6, RX + 1);
  gateH(forest, RX, MAP_H - 2, 'dungeon4_cleared', g);
  connect(forest, 'right', 'town');
  connect(forest, 'down', 'route_desert');
  const forestCave = caveMouth(forest, 8, 20, 'dungeon_forest', g);
  sign(forest, 6, 22, 'cave_forest', g);
  borderTrees(forest, g, false);
  scatterTrees(
    forest,
    [
      [4, 4],
      [10, 6],
      [28, 4],
      [30, 16],
      [8, 14],
      [26, 22],
      [14, 24],
    ],
    false,
    g,
  );
  resolvePaths(forest, g);
  varyGround(forest, [g('grass')], [g('grass_b'), g('grass_c')], salt('forest'));
  flowers(forest, grassIds, g, salt('forest'));
  clumps(
    forest,
    grassIds,
    'tall',
    [
      [4, 8, 16, 11],
      [24, 8, 36, 11],
      [4, 16, 14, 18],
      [24, 18, 36, 26],
    ],
    g,
    salt('forest'),
  );
  maps.route_forest = forest;

  const snow = baseOutdoor('route_snow', 'FROST LANE', 'snow', g);
  roadV(snow, RX, 4, MAP_H - 1);
  roadH(snow, 8, RX, 26);
  gateH(snow, RX, MAP_H - 2, 'dungeon1_cleared', g);
  connect(snow, 'down', 'town');
  const snowCave = caveMouth(snow, 26, 8, 'dungeon_snow', g);
  sign(snow, 24, 10, 'cave_snow', g);
  for (let y = 6; y <= 10; y++) {
    for (let x = 6; x <= 12; x++) {
      if (snow.path[at(snow, x, y)]) continue;
      put('ground', snow, x, y, g('ice'));
      occupy(snow, x, y);
    }
  }
  borderTrees(snow, g, true);
  scatterTrees(snow, [[4, 4], [8, 16], [28, 16], [14, 20], [30, 22]], true, g);
  resolvePaths(snow, g);
  varyGround(snow, [g('snow')], [g('snow_b'), g('snow_b')], salt('snow'));
  clumps(snow, [g('snow'), g('snow_b')], 'tall_snow', [[4, 12, 16, 18], [24, 18, 36, 26]], g, salt('snow'));
  maps.route_snow = snow;

  const beach = baseOutdoor('route_beach', 'TIDAL REACH', 'sand', g);
  roadH(beach, RY, 0, 24);
  roadV(beach, 22, RY, 22);
  gateV(beach, 1, RY, 'dungeon2_cleared', g);
  connect(beach, 'left', 'town');
  for (let y = 0; y < MAP_H; y++) {
    put('ground', beach, 29, y, g('shore_w'));
    for (let x = 30; x < MAP_W; x++) put('ground', beach, x, y, g('water_0'));
  }
  for (let x = 29; x <= 34; x++) put('ground', beach, x, 18, g('pier'));
  const beachCave = caveMouth(beach, 22, 20, 'dungeon_beach', g);
  sign(beach, 20, 22, 'cave_beach', g);
  for (const [x, y] of [
    [16, 6],
    [26, 6],
    [8, 18],
    [14, 16],
  ]) {
    if (freeCell(beach, x, y)) {
      put('objects', beach, x, y, g('boulder'));
      occupy(beach, x, y);
    }
  }
  resolvePaths(beach, g);
  varyGround(beach, [g('sand')], [g('sand_b'), g('sand_b')], salt('beach'));
  clumps(beach, [g('sand'), g('sand_b')], 'tall_dune', [[4, 4, 18, 10], [6, 16, 18, 26]], g, salt('beach'));
  maps.route_beach = beach;

  const mountain = baseOutdoor('route_mountain', 'RIDGE TRAIL', 'gravel', g);
  roadV(mountain, RX, 0, 20);
  roadH(mountain, RY, 0, RX + 1);
  roadH(mountain, 18, RX, 30);
  gateH(mountain, RX, 1, 'dungeon3_cleared', g);
  gateV(mountain, 1, RY, 'dungeon4_cleared', g);
  connect(mountain, 'up', 'town');
  connect(mountain, 'left', 'route_desert');
  const mountainCave = caveMouth(mountain, 30, 18, 'dungeon_mountain', g);
  sign(mountain, 28, 20, 'cave_mountain', g);
  borderCliffs(mountain, g);
  for (const [x, y] of [
    [8, 6],
    [26, 6],
    [10, 20],
    [34, 8],
    [8, 24],
    [24, 24],
  ]) {
    if (freeCell(mountain, x, y)) {
      put('objects', mountain, x, y, g('boulder'));
      occupy(mountain, x, y);
    }
  }
  resolvePaths(mountain, g);
  varyGround(mountain, [g('gravel')], [g('gravel_b'), g('gravel_b')], salt('mountain'));
  clumps(mountain, [g('gravel'), g('gravel_b')], 'tall_scrub', [[4, 16, 16, 26], [24, 6, 36, 12]], g, salt('mountain'));
  maps.route_mountain = mountain;

  const desert = baseOutdoor('route_desert', 'DUNE WALK', 'sand', g);
  roadV(desert, RX, 0, 22);
  roadH(desert, RY, RX, MAP_W - 1);
  roadH(desert, 20, 8, RX + 1);
  gateH(desert, RX, 1, 'dungeon4_cleared', g);
  gateV(desert, MAP_W - 2, RY, 'dungeon4_cleared', g);
  connect(desert, 'up', 'route_forest');
  connect(desert, 'right', 'route_mountain');
  const desertCave = caveMouth(desert, 8, 20, 'dungeon_desert', g);
  sign(desert, 6, 22, 'cave_desert', g);
  borderCliffs(desert, g);
  for (const [x, y] of [
    [6, 6],
    [14, 8],
    [28, 6],
    [10, 16],
    [30, 20],
    [16, 24],
  ]) {
    if (freeCell(desert, x, y) && freeCell(desert, x, y + 1)) {
      put('objects', desert, x, y, g('cactus_top'));
      put('objects', desert, x, y + 1, g('cactus_bot'));
      occupy(desert, x, y);
      occupy(desert, x, y + 1);
    }
  }
  resolvePaths(desert, g);
  varyGround(desert, [g('sand')], [g('sand_b'), g('sand_b')], salt('desert'));
  clumps(desert, [g('sand'), g('sand_b')], 'tall_sand', [[4, 8, 16, 14], [24, 16, 36, 26]], g, salt('desert'));
  maps.route_desert = desert;

  maps.dungeon_forest = dungeon('dungeon_forest', 'SHADED GROTTO', { map: 'route_forest', x: forestCave.x, y: forestCave.y + 1 }, g);
  maps.dungeon_snow = dungeon('dungeon_snow', 'FROST CAVE', { map: 'route_snow', x: snowCave.x, y: snowCave.y + 1 }, g);
  maps.dungeon_beach = dungeon('dungeon_beach', 'TIDE CAVE', { map: 'route_beach', x: beachCave.x, y: beachCave.y + 1 }, g);
  maps.dungeon_mountain = dungeon('dungeon_mountain', 'RIDGE CAVE', { map: 'route_mountain', x: mountainCave.x, y: mountainCave.y + 1 }, g);
  maps.dungeon_desert = dungeon('dungeon_desert', 'DUNE CAVE', { map: 'route_desert', x: desertCave.x, y: desertCave.y + 1 }, g);

  // Dungeon signs used the map id as the dialogue id inside dungeon(). Point those
  // at the written scripts by rewriting the dialogue field to the cave_* ids already
  // used outside, and keep a stable id per dungeon.
  const dungeonDialogue = {
    dungeon_forest: 'dungeon_forest',
    dungeon_snow: 'dungeon_snow',
    dungeon_beach: 'dungeon_beach',
    dungeon_mountain: 'dungeon_mountain',
    dungeon_desert: 'dungeon_desert',
  };
  for (const [id, dialogue] of Object.entries(dungeonDialogue)) {
    for (const s of maps[id].signs) s.dialogue = dialogue;
  }

  return maps;
}

export function tiledDocument(map) {
  let nextId = 1;
  const objects = [];
  const prop = (name, type, value) => ({ name, type, value });
  const push = (type, x, y, w, h, properties) => {
    objects.push({
      id: nextId++,
      name: type,
      type,
      x: x * 16,
      y: y * 16,
      width: w * 16,
      height: h * 16,
      rotation: 0,
      visible: true,
      properties,
    });
  };
  for (const warp of map.warps) {
    push('warp', warp.x, warp.y, 1, 1, [
      prop('map', 'string', warp.map),
      prop('x', 'int', warp.tx),
      prop('y', 'int', warp.ty),
      prop('facing', 'string', warp.facing),
    ]);
  }
  for (const conn of map.connections) {
    push('connection', 0, 0, 0, 0, [
      prop('side', 'string', conn.side),
      prop('map', 'string', conn.map),
      prop('offset', 'int', conn.offset),
    ]);
  }
  for (const gate of map.gates) {
    push('gate', gate.x, gate.y, gate.w, gate.h, [
      prop('flag', 'string', gate.flag),
      prop('tiles', 'string', gate.tiles.join(',')),
    ]);
  }
  for (const s of map.signs) {
    push('sign', s.x, s.y, 1, 1, [prop('dialogue', 'string', s.dialogue)]);
  }
  for (const item of map.items) {
    push('item', item.x, item.y, 1, 1, [prop('item', 'string', item.itemId), prop('flag', 'string', item.flag)]);
  }

  const layer = (name, data, id) => ({
    id,
    name,
    type: 'tilelayer',
    x: 0,
    y: 0,
    width: map.w,
    height: map.h,
    opacity: 1,
    visible: true,
    data,
  });

  return {
    compressionlevel: -1,
    width: map.w,
    height: map.h,
    infinite: false,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.10.2',
    tileheight: 16,
    tilewidth: 16,
    type: 'map',
    version: '1.10',
    nextlayerid: 6,
    nextobjectid: nextId,
    properties: [
      prop('name', 'string', map.name),
      prop('showName', 'bool', map.showName),
      prop('interior', 'bool', map.interior),
    ],
    tilesets: [{ firstgid: 1, source: '../../tilesets/overworld.tsj' }],
    layers: [
      layer('ground', map.ground, 1),
      layer('fringe', map.fringe, 2),
      layer('objects', map.objects, 3),
      layer('overhead', map.overhead, 4),
      {
        id: 5,
        name: 'events',
        type: 'objectgroup',
        draworder: 'topdown',
        opacity: 1,
        visible: true,
        x: 0,
        y: 0,
        objects,
      },
    ],
  };
}
