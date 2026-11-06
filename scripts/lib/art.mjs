import { canvas, hash, hex, mirror, outline } from './canvas.mjs';

const C = {
  outline: hex('#241810'),
  grass: hex('#54a028'),
  grassLt: hex('#78c448'),
  grassDk: hex('#3c8618'),
  grassDp: hex('#2a6412'),
  dirt: hex('#e0b86a'),
  dirtLt: hex('#f0d090'),
  dirtDk: hex('#c09048'),
  dirtDp: hex('#8d642c'),
  water: hex('#3c7ed0'),
  waterLt: hex('#6cb0ec'),
  waterDk: hex('#2458a4'),
  waterHi: hex('#dff6ff'),
  foam: hex('#f4fbff'),
  sand: hex('#f2d59a'),
  sandLt: hex('#fae8bc'),
  sandDk: hex('#d8b56e'),
  rock: hex('#9a9aa6'),
  rockLt: hex('#c8c8d2'),
  rockDk: hex('#6c6c7c'),
  rockDp: hex('#45454f'),
  snow: hex('#f5f8fd'),
  snowDk: hex('#d5e1ef'),
  snowDp: hex('#a9c0d6'),
  ice: hex('#b9def4'),
  iceLt: hex('#e7f7ff'),
  trunk: hex('#8d5a30'),
  trunkDk: hex('#5b3a1c'),
  trunkLt: hex('#b47b48'),
  leaf: hex('#2f8c22'),
  leafLt: hex('#4eae36'),
  leafDk: hex('#1c6414'),
  leafDp: hex('#12480e'),
  wall: hex('#f4e7cb'),
  wallDk: hex('#ddc7a0'),
  wallDp: hex('#b89870'),
  roofRed: hex('#d24b4b'),
  roofRedDk: hex('#9d2d35'),
  roofRedLt: hex('#f08484'),
  roofBlue: hex('#3d72c8'),
  roofBlueDk: hex('#27498f'),
  roofBlueLt: hex('#7eacf0'),
  roofPink: hex('#ee6d8c'),
  roofPinkDk: hex('#b83d5d'),
  roofPinkLt: hex('#ffb0c2'),
  roofGreen: hex('#3e8e4d'),
  roofGreenDk: hex('#246433'),
  roofGreenLt: hex('#74bc82'),
  trim: hex('#f7f1e2'),
  wood: hex('#c4924e'),
  woodDk: hex('#8a5e2c'),
  woodDp: hex('#5c3c1c'),
  floorTile: hex('#d5e4f4'),
  floorTileDk: hex('#b7cbe2'),
  floorMart: hex('#e7e2d6'),
  floorMartDk: hex('#cfc6b4'),
  floorLab: hex('#d7e2d4'),
  floorLabDk: hex('#b7cbb4'),
  cave: hex('#514a5e'),
  caveDk: hex('#322c3c'),
  caveDp: hex('#16131c'),
  cloth: hex('#c45058'),
  clothDk: hex('#8a3038'),
  pot: hex('#6ea04a'),
  frame: hex('#6a5030'),
  glass: hex('#8fd4ea'),
  glassLt: hex('#e4f8ff'),
  glassDk: hex('#3a88a8'),
  metal: hex('#d8dee8'),
  metalDk: hex('#8090a4'),
  ember: hex('#f0d060'),
  skin: hex('#ffd0a8'),
  skinDk: hex('#e8a880'),
  hair: hex('#3a2418'),
  hairLt: hex('#6a4630'),
  cap: hex('#1f9c94'),
  capDk: hex('#146e68'),
  capLt: hex('#5ed0c4'),
  jacket: hex('#1f8f88'),
  jacketDk: hex('#14645e'),
  shirt: hex('#f6f1e4'),
  shirtDk: hex('#d9d0bc'),
  pants: hex('#2c3e70'),
  pantsDk: hex('#1b2848'),
  shoe: hex('#f4f5f8'),
  shoeDk: hex('#b0b3be'),
  eye: hex('#1c140f'),
  mouth: hex('#c86a62'),
  npcHair: hex('#6b3f28'),
  npcHairLt: hex('#8d5a3a'),
  npcJacket: hex('#3f7d3a'),
  npcJacketDk: hex('#2a5628'),
  npcShirt: hex('#f0ddb0'),
  npcShirtDk: hex('#d2bc8c'),
  npcPants: hex('#5a4634'),
  npcPantsDk: hex('#3a2c20'),
  npcShoe: hex('#4a3428'),
  npcShoeDk: hex('#2a1c16'),
};

function paintGrass(c, salt) {
  c.fill(0, 0, 16, 16, C.grass);
  const tufts = [
    [1, 2],
    [6, 0],
    [11, 3],
    [14, 1],
    [3, 7],
    [8, 6],
    [13, 8],
    [2, 12],
    [7, 11],
    [12, 13],
    [5, 15],
    [15, 10],
  ];
  tufts.forEach(([x, y], i) => {
    const xx = (x + (salt % 3)) % 16;
    const yy = (y + ((salt + i) % 2)) % 16;
    c.px(xx, yy, C.grassLt);
    c.px(xx, Math.min(15, yy + 1), i % 3 === 0 ? C.grassDp : C.grassDk);
    if (i % 2 === 0) c.px(Math.max(0, xx - 1), Math.min(15, yy + 1), C.grassDk);
  });
}

function paintFlower(c, color, frame) {
  paintGrass(c, color[0] + frame);
  const shift = frame === 0 ? 0 : 1;
  const cx = 7 + shift;
  const cy = 8;
  c.px(cx, cy + 2, C.grassDp);
  c.px(cx, cy + 1, C.grassDk);
  c.fill(cx - 1, cy - 1, 3, 2, color);
  c.px(cx, cy - 2, color);
  c.px(cx - 2, cy, color);
  c.px(cx + 2, cy - shift, color);
  c.px(cx, cy, C.ember);
  c.px(cx + 3, cy + 3, color);
  c.px(cx - 3, cy + 2, color);
}

function paintTall(c, tip, mid, dark, frame) {
  const sway = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  for (let i = 0; i < 6; i++) {
    const x = 1 + ((i * 3) % 13);
    const top = 1 + ((i * 2 + frame) % 5);
    for (let y = top; y < 16; y++) {
      const xx = Math.max(0, Math.min(15, x + (y < top + 4 ? sway : 0) + (i % 2 === 0 && y < 8 ? 0 : 0)));
      const color = y < top + 2 ? tip : y < top + 7 ? mid : dark;
      c.px(xx, y, color);
      if (y > top + 5) c.px(Math.min(15, xx + 1), y, dark);
    }
  }
}

const JAG = [2, 1, 2, 1, 2, 2, 1, 2, 1, 2, 2, 1, 2, 1, 2, 1];

function paintPath(c, mask) {
  paintGrass(c, 3 + mask);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = (mask & 1) !== 0 ? JAG[x] : 0;
      const s = (mask & 4) !== 0 ? JAG[15 - x] : 0;
      const w = (mask & 8) !== 0 ? JAG[y] : 0;
      const e = (mask & 2) !== 0 ? JAG[15 - y] : 0;
      if (y < n || y >= 16 - s || x < w || x >= 16 - e) continue;
      const nse = hash(x, y, 20 + mask);
      const color = nse > 0.94 ? C.dirtLt : nse > 0.88 ? C.dirtDk : C.dirt;
      c.px(x, y, color);
    }
  }
}

function paintWater(c, frame) {
  c.fill(0, 0, 16, 16, C.water);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const band = (y + frame * 2) % 4 === 0;
      const spark = (x * 3 + y * 5 + frame * 7) % 17 === 0;
      if (band && (x + frame) % 3 !== 0) c.px(x, y, C.waterLt);
      else if ((y + frame) % 5 === 2 && x % 2 === 0) c.px(x, y, C.waterDk);
      if (spark) c.px(x, y, C.waterHi);
    }
  }
}

function paintShore(c, land) {
  // land: n e s w as booleans, meaning that side is sand.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dn = land.n ? y < 7 + (JAG[x] > 2 ? 1 : 0) : false;
      const ds = land.s ? y > 8 - (JAG[x] > 2 ? 1 : 0) : false;
      const dw = land.w ? x < 7 + (JAG[y] > 2 ? 1 : 0) : false;
      const de = land.e ? x > 8 - (JAG[y] > 2 ? 1 : 0) : false;
      // A shore tile has land on the named sides and water elsewhere.
      const isLand = (land.n && dn) || (land.s && ds) || (land.w && dw) || (land.e && de);
      if (isLand) {
        const nse = hash(x, y, 4);
        c.px(x, y, nse > 0.8 ? C.sandLt : C.sand);
      } else {
        c.px(x, y, (x + y) % 5 === 0 ? C.waterLt : C.water);
      }
    }
  }
  // foam along the boundary
  for (let y = 1; y < 15; y++) {
    for (let x = 1; x < 15; x++) {
      const i = (y * 16 + x) * 4;
      const here = c.data[i] > 200;
      const left = c.data[(y * 16 + x - 1) * 4] > 200;
      if (here !== left) c.px(x, y, C.foam);
    }
  }
}

function paintSand(c, salt) {
  c.fill(0, 0, 16, 16, C.sand);
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(hash(i, salt, 3) * 16);
    const y = Math.floor(hash(i, salt, 4) * 16);
    c.px(x, y, hash(i, salt, 5) > 0.5 ? C.sandLt : C.sandDk);
  }
  c.px(2, 12, C.sandDk);
  c.px(3, 12, C.sandDk);
  c.px(11, 5, C.sandLt);
  c.px(12, 5, C.sandLt);
}

function paintGravel(c, salt) {
  c.fill(0, 0, 16, 16, salt ? C.rockDk : C.rock);
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(hash(i, salt, 6) * 14);
    const y = Math.floor(hash(i, salt, 7) * 14);
    c.fill(x, y, 2, 2, hash(i, salt, 8) > 0.5 ? C.rockLt : C.rockDp);
  }
}

function paintSnow(c, salt) {
  c.fill(0, 0, 16, 16, C.snow);
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(hash(i, salt, 2) * 15);
    const y = Math.floor(hash(i, salt, 3) * 15);
    c.px(x, y, C.snowDk);
    if (hash(i, salt, 4) > 0.7) c.px(x + 1, y, C.iceLt);
  }
  c.fill(0, 14, 16, 2, C.snowDk);
}

function paintIce(c) {
  c.fill(0, 0, 16, 16, C.ice);
  c.fill(0, 4, 16, 1, C.iceLt);
  c.fill(0, 10, 16, 1, C.snow);
  for (let x = 2; x < 16; x += 5) c.px(x, 7, C.waterLt);
}

function paintCliff(c, alt) {
  c.fill(0, 0, 16, 16, C.rockDk);
  c.fill(0, 0, 16, 3, alt ? C.rock : C.rockLt);
  c.fill(0, 3, 16, 1, C.rockDp);
  for (let y = 5; y < 15; y += 5) {
    c.fill(0, y, 16, 1, C.rockDp);
    c.fill(1, y + 1, 6, 3, C.rock);
    c.fill(9, y + 1, 6, 3, alt ? C.rockLt : C.rock);
  }
  c.px(4, 8, C.rockDp);
  c.px(12, 12, C.rockDp);
}

function paintBoulder(c) {
  c.fill(3, 5, 10, 8, C.rock);
  c.fill(4, 4, 8, 2, C.rockLt);
  c.fill(5, 12, 7, 2, C.rockDk);
  c.fill(2, 7, 2, 4, C.rockDk);
  c.fill(12, 7, 2, 4, C.rock);
  c.px(6, 7, C.rockLt);
  c.px(7, 8, C.rockDp);
  outline(c, C.rockDp);
}

function paintCanopy(target, ox, oy, snowy) {
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const dx = (x - 15.5) / 13.2;
      const dy = (y - 12.2) / 10.6;
      const bite = hash(x, y, 11) > 0.82 && dx * dx + dy * dy > 0.55;
      if (dx * dx + dy * dy > 1 || bite) continue;
      let color = C.leaf;
      if (y < 10 && x < 16) color = C.leafLt;
      else if (y > 16 || x > 22) color = C.leafDk;
      if (dx * dx + dy * dy > 0.78) color = C.leafDp;
      if (snowy && y < 14 && hash(x, y, 12) > 0.45) color = y < 8 ? C.snow : C.snowDk;
      target.px(x - ox, y - oy, color);
    }
  }
  for (let y = 18; y < 32; y++) {
    for (let x = 13; x <= 18; x++) {
      const edge = x === 13 || x === 18;
      target.px(x - ox, y - oy, edge || y > 28 ? C.trunkDk : y % 4 === 0 ? C.trunkLt : C.trunk);
    }
  }
}

function splitTree(snowy) {
  const full = canvas(32, 32);
  paintCanopy(full, 0, 0, snowy);
  outline(full, snowy ? C.snowDp : C.leafDp);
  // Trunk should keep a darker outline, already colored.
  const parts = [];
  for (const oy of [0, 16]) {
    for (const ox of [0, 16]) {
      const part = canvas(16, 16);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const i = ((y + oy) * 32 + (x + ox)) * 4;
          if (full.data[i + 3] === 0) continue;
          part.px(x, y, [full.data[i], full.data[i + 1], full.data[i + 2], 255]);
        }
      }
      parts.push(part);
    }
  }
  // parts order was oy outer, ox inner: tl, tr, bl, br? 
  // oy=0 ox=0 tl, oy=0 ox=16 tr, oy=16 ox=0 bl, oy=16 ox=16 br.
  return parts;
}

function paintCactus(top) {
  const c = canvas(16, 16);
  const green = hex('#3f9a44');
  const greenDk = hex('#246830');
  const greenLt = hex('#67c06a');
  if (top) {
    c.fill(6, 4, 4, 12, green);
    c.fill(2, 7, 4, 3, green);
    c.fill(10, 8, 4, 3, green);
    c.fill(6, 3, 4, 2, greenLt);
    c.px(6, 6, greenDk);
    c.px(9, 10, greenDk);
    c.px(3, 8, greenLt);
  } else {
    c.fill(6, 0, 4, 14, green);
    c.fill(5, 12, 6, 3, greenDk);
    c.px(6, 4, greenDk);
    c.px(9, 8, greenLt);
    c.px(7, 14, C.sandDk);
  }
  outline(c, C.grassDp);
  return c;
}

function paintFence(kind) {
  const c = canvas(16, 16);
  if (kind === 'h') {
    c.fill(0, 4, 16, 2, C.wood);
    c.fill(0, 9, 16, 2, C.woodDk);
    c.fill(2, 2, 2, 12, C.trunk);
    c.fill(12, 2, 2, 12, C.trunkDk);
  } else if (kind === 'v') {
    c.fill(4, 0, 2, 16, C.wood);
    c.fill(9, 0, 2, 16, C.woodDk);
    c.fill(2, 2, 12, 2, C.trunk);
    c.fill(2, 12, 12, 2, C.trunkDk);
  } else {
    c.fill(6, 1, 4, 14, C.trunk);
    c.fill(7, 1, 1, 14, C.trunkLt);
    c.fill(5, 13, 6, 2, C.trunkDk);
  }
  outline(c, C.woodDp);
  return c;
}

function paintBar(kind) {
  const c = canvas(16, 16);
  if (kind === 'v') {
    c.fill(6, 0, 4, 16, C.wood);
    c.fill(7, 0, 1, 16, C.woodLt ?? C.trunkLt);
    c.fill(6, 3, 4, 2, C.roofRedDk);
    c.fill(6, 10, 4, 2, C.roofRedDk);
  } else {
    const x0 = kind === 'l' ? 2 : 0;
    const x1 = kind === 'r' ? 14 : 16;
    c.fill(x0, 6, x1 - x0, 4, C.wood);
    c.fill(x0, 7, x1 - x0, 1, C.trunkLt);
    c.fill(kind === 'l' ? 3 : 10, 6, 3, 4, C.roofRedDk);
    if (kind === 'l') c.fill(1, 4, 3, 8, C.trunk);
    if (kind === 'r') c.fill(12, 4, 3, 8, C.trunkDk);
  }
  outline(c, C.woodDp);
  return c;
}

function paintSign(c) {
  c.fill(7, 7, 2, 8, C.trunk);
  c.fill(2, 2, 12, 7, C.wood);
  c.fill(3, 3, 10, 5, C.dirtLt);
  c.fill(4, 5, 8, 1, C.woodDk);
  outline(c, C.woodDp);
}

function paintShingles(c, hi, mid, dk, y0, y1) {
  for (let y = y0; y < y1; y++) {
    const row = Math.floor((y - y0) / 4);
    const offset = row % 2 === 0 ? 0 : 2;
    for (let x = 0; x < 16; x++) {
      const seam = (x + offset) % 4 === 0 || (y - y0) % 4 === 0;
      const shine = (x + offset) % 4 === 1 && (y - y0) % 4 === 1;
      c.px(x, y, seam ? dk : shine ? hi : mid);
    }
  }
}

function paintRoofTile(kind, hi, mid, dk) {
  const c = canvas(16, 16);
  c.fill(0, 0, 16, 16, mid);
  const eave = kind === 'eave' || kind === 'bl' || kind === 'br';
  const top = kind === 'top' || kind === 'tl' || kind === 'tr';
  paintShingles(c, hi, mid, dk, 0, eave ? 10 : 16);
  if (top) c.fill(0, 0, 16, 2, hi);
  if (eave) {
    c.fill(0, 10, 16, 2, dk);
    c.fill(0, 12, 16, 2, C.trim);
    c.fill(0, 14, 16, 2, dk);
  }
  if (kind === 'tl' || kind === 'left' || kind === 'bl') c.fill(0, 0, 2, 16, dk);
  if (kind === 'tr' || kind === 'right' || kind === 'br') c.fill(14, 0, 2, 16, dk);
  return c;
}

function paintWall(windowed) {
  const c = canvas(16, 16);
  c.fill(0, 0, 16, 16, C.wall);
  c.fill(0, 0, 16, 2, C.wallDk);
  c.fill(14, 2, 2, 11, C.wallDk);
  c.fill(0, 12, 16, 1, C.wallDk);
  c.fill(0, 13, 16, 3, C.wallDp);
  c.px(3, 5, C.wallDk);
  c.px(8, 8, C.wallDk);
  c.px(5, 10, C.trim);
  if (windowed) {
    c.fill(3, 3, 9, 8, C.frame);
    c.fill(4, 4, 7, 6, C.glass);
    c.fill(4, 6, 7, 1, C.frame);
    c.fill(7, 4, 1, 6, C.frame);
    c.px(4, 4, C.glassLt);
    c.px(5, 4, C.glassLt);
    c.fill(4, 8, 3, 2, C.glassDk);
  }
  return c;
}

function paintDoor(style) {
  const c = canvas(16, 16);
  c.fill(0, 0, 16, 16, C.wall);
  c.fill(0, 13, 16, 3, C.wallDp);
  c.fill(3, 1, 10, 13, C.frame);
  const leaf = style === 'center' ? C.roofPinkLt : style === 'mart' ? C.roofBlue : style === 'lab' ? C.roofGreen : C.wood;
  const leafDk = style === 'center' ? C.roofPinkDk : style === 'mart' ? C.roofBlueDk : style === 'lab' ? C.roofGreenDk : C.woodDk;
  c.fill(4, 2, 8, 11, leaf);
  c.fill(4, 7, 8, 1, leafDk);
  c.fill(7, 2, 1, 11, leafDk);
  c.px(10, 8, C.ember);
  if (style === 'center') {
    c.px(7, 4, C.roofPinkDk);
    c.px(8, 4, C.roofPinkDk);
    c.px(7, 5, C.roofPinkDk);
    c.px(8, 5, C.roofPinkDk);
    c.px(6, 5, C.roofPinkDk);
    c.px(9, 5, C.roofPinkDk);
  }
  return c;
}

function paintPlanks(c, base, alt, line) {
  c.fill(0, 0, 16, 16, base);
  for (let y = 0; y < 16; y += 4) {
    c.fill(0, y, 16, 3, (y / 4) % 2 === 0 ? base : alt);
    c.fill(0, y + 3, 16, 1, line);
    c.px(3 + (y % 8), y + 1, line);
    c.px(11, y + 2, line);
  }
}

function paintFloorTile(c, a, b) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) c.px(x, y, (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0 ? a : b);
}

function paintCaveWall(c) {
  c.fill(0, 0, 16, 16, C.caveDk);
  c.fill(1, 1, 6, 5, C.cave);
  c.fill(9, 2, 5, 4, C.rockDk);
  c.fill(2, 9, 7, 5, C.cave);
  c.fill(10, 10, 4, 4, C.caveDp);
  c.px(3, 3, C.rock);
  c.px(12, 12, C.rockDp);
}

function paintCaveFloor(c) {
  c.fill(0, 0, 16, 16, C.cave);
  for (let i = 0; i < 8; i++) c.px(Math.floor(hash(i, 2, 1) * 16), Math.floor(hash(i, 3, 1) * 16), C.caveDk);
  c.px(4, 11, C.rockDk);
  c.px(12, 5, C.caveDp);
}

function paintHole(c) {
  c.fill(0, 0, 16, 16, C.rockDk);
  c.fill(2, 3, 12, 12, C.caveDp);
  c.fill(4, 6, 8, 8, C.caveDp);
  c.px(6, 8, hex('#2a3348'));
  c.px(9, 10, hex('#1a2030'));
  outline(c, C.rockDp);
}

function paintCounter(c) {
  c.fill(0, 0, 16, 5, C.trim);
  c.fill(0, 5, 16, 1, C.wallDk);
  c.fill(0, 6, 16, 8, C.wood);
  c.fill(0, 14, 16, 2, C.woodDk);
  c.fill(2, 8, 3, 3, C.metal);
  c.px(3, 9, C.roofRed);
  c.px(11, 9, C.cap);
  c.px(12, 9, C.capDk);
}

function paintShelf(c) {
  c.fill(0, 2, 16, 13, C.woodDk);
  c.fill(1, 3, 14, 3, C.wood);
  c.fill(1, 8, 14, 3, C.wood);
  c.fill(2, 4, 3, 2, C.roofRed);
  c.fill(7, 4, 3, 2, C.roofBlue);
  c.fill(11, 4, 3, 2, C.ember);
  c.fill(3, 9, 4, 2, C.pot);
  c.fill(9, 9, 4, 2, C.shirt);
  outline(c, C.woodDp);
}

function paintTable(c) {
  c.fill(2, 6, 12, 2, C.wallDp);
  c.fill(1, 8, 14, 4, C.wood);
  c.fill(3, 12, 2, 3, C.trunk);
  c.fill(11, 12, 2, 3, C.trunkDk);
  c.px(4, 9, C.glass);
  outline(c, C.woodDp);
}

function paintBed(top) {
  const c = canvas(16, 16);
  if (top) {
    c.fill(2, 2, 12, 14, C.wood);
    c.fill(3, 3, 10, 6, C.shirt);
    c.fill(3, 4, 10, 2, C.shirtDk);
    c.fill(4, 10, 8, 4, C.cloth);
  } else {
    c.fill(2, 0, 12, 12, C.cloth);
    c.fill(3, 1, 10, 2, C.clothDk);
    c.fill(2, 12, 12, 3, C.woodDk);
  }
  outline(c, C.woodDp);
  return c;
}

function paintMachine(c) {
  c.fill(2, 2, 12, 13, C.metal);
  c.fill(3, 3, 10, 6, C.glassDk);
  c.fill(4, 4, 8, 4, C.glass);
  c.px(5, 5, C.glassLt);
  c.fill(5, 11, 2, 2, C.roofRed);
  c.fill(9, 11, 2, 2, C.cap);
  outline(c, C.metalDk);
}

function paintCrate(c) {
  c.fill(2, 3, 12, 11, C.wood);
  c.fill(2, 3, 12, 2, C.trunkLt);
  c.fill(2, 8, 12, 1, C.woodDk);
  c.fill(7, 3, 1, 11, C.woodDk);
  outline(c, C.woodDp);
}

function paintPlant(c) {
  c.fill(5, 9, 6, 5, C.dirtDp);
  c.fill(6, 10, 4, 3, C.dirt);
  c.fill(4, 4, 8, 6, C.leaf);
  c.fill(6, 3, 4, 3, C.leafLt);
  c.px(5, 6, C.leafDk);
  c.px(9, 5, C.flowerRed ?? C.roofRed);
  outline(c, C.leafDp);
}

function paintRug(c) {
  c.fill(0, 0, 16, 16, C.floorTile);
  c.fill(2, 2, 12, 12, C.roofRed);
  c.fill(4, 4, 8, 8, C.roofRedDk);
  c.fill(6, 6, 4, 4, C.ember);
}

function paintMat(c) {
  paintPlanks(c, C.wood, C.woodDk, C.woodDp);
  c.fill(2, 5, 12, 7, C.clothDk);
  c.fill(3, 6, 10, 5, C.cloth);
  c.fill(3, 8, 10, 1, C.ember);
}

function paintPier(c) {
  c.fill(0, 0, 16, 16, C.waterDk);
  for (let x = 0; x < 16; x += 4) c.fill(x, 2, 3, 12, C.wood);
  c.fill(0, 2, 16, 2, C.trunkLt);
  c.fill(0, 12, 16, 2, C.woodDk);
}

function paintPerson(dir, pose, pal) {
  const c = canvas(16, 32);
  const bob = pose === 'stand' ? 0 : -1;
  const run = pose.startsWith('run');
  const step = pose === 'walk1' || pose === 'run1' ? 1 : pose === 'walk2' || pose === 'run3' ? -1 : 0;
  const o = bob;
  const spread = step === 0 ? 0 : run ? 2 : 1;

  if (dir === 'down') {
    c.fill(3, 3 + o, 10, 5, pal.hair);
    c.fill(3, 5 + o, 10, 3, pal.cap);
    c.fill(2, 7 + o, 12, 2, pal.capDk);
    c.fill(4, 5 + o, 3, 1, pal.capLt);
    c.fill(4, 9 + o, 8, 6, pal.skin);
    c.fill(4, 9 + o, 8, 2, pal.hair);
    c.px(4, 11 + o, pal.hair);
    c.px(11, 11 + o, pal.hair);
    c.px(3, 11 + o, pal.skinDk);
    c.px(12, 11 + o, pal.skinDk);
    c.fill(5, 11 + o, 2, 2, pal.eye);
    c.fill(9, 11 + o, 2, 2, pal.eye);
    c.px(5, 11 + o, C.shoe);
    c.px(9, 11 + o, C.shoe);
    c.fill(7, 14 + o, 2, 1, pal.mouth);
    c.px(5, 13 + o, pal.skinDk);
    c.px(10, 13 + o, pal.skinDk);
    c.fill(3, 16 + o, 10, 6, pal.jacket);
    c.fill(6, 17 + o, 4, 4, pal.shirt);
    c.fill(6, 17 + o, 1, 4, pal.jacketDk);
    c.fill(9, 17 + o, 1, 4, pal.jacketDk);
    c.fill(2, 17 + o + (step < 0 ? 1 : 0), 2, 4, pal.jacket);
    c.fill(12, 17 + o + (step > 0 ? 1 : 0), 2, 4, pal.jacketDk);
    c.px(2, 21 + o, pal.skin);
    c.px(13, 21 + o, pal.skinDk);
    const lx = 4 - spread;
    const rx = 9 + spread;
    c.fill(lx, 21 + o, 3, 5, pal.pants);
    c.fill(rx, 21 + o, 3, 5, pal.pantsDk);
    c.fill(lx, 26 + o + (step > 0 ? 1 : 0), 3, 2, pal.shoe);
    c.fill(rx, 26 + o + (step < 0 ? 1 : 0), 3, 2, pal.shoeDk);
  } else if (dir === 'up') {
    c.fill(3, 3 + o, 10, 8, pal.hair);
    c.fill(4, 4 + o, 8, 2, pal.cap);
    c.fill(5, 3 + o, 4, 1, pal.capLt);
    c.fill(3, 7 + o, 10, 2, pal.capDk);
    c.px(5, 6 + o, pal.hairLt);
    c.px(10, 6 + o, pal.hairLt);
    c.px(6, 9 + o, pal.hairLt);
    c.fill(3, 16 + o, 10, 6, pal.jacket);
    c.fill(7, 17 + o, 2, 4, pal.jacketDk);
    c.fill(4, 16 + o, 8, 1, pal.capDk);
    c.fill(2, 17 + o + (step > 0 ? 1 : 0), 2, 4, pal.jacketDk);
    c.fill(12, 17 + o + (step < 0 ? 1 : 0), 2, 4, pal.jacket);
    c.px(2, 21 + o, pal.skinDk);
    c.px(13, 21 + o, pal.skin);
    const lx = 4 - spread;
    const rx = 9 + spread;
    c.fill(lx, 21 + o, 3, 5, pal.pantsDk);
    c.fill(rx, 21 + o, 3, 5, pal.pants);
    c.fill(lx, 26 + o + (step < 0 ? 1 : 0), 3, 2, pal.shoeDk);
    c.fill(rx, 26 + o + (step > 0 ? 1 : 0), 3, 2, pal.shoe);
  } else {
    const lean = run ? -1 : 0;
    c.fill(6 + lean, 4 + o, 6, 7, pal.skin);
    c.fill(8 + lean, 3 + o, 5, 5, pal.hair);
    c.fill(11 + lean, 6 + o, 2, 5, pal.hair);
    c.fill(6 + lean, 5 + o, 7, 2, pal.cap);
    c.fill(3 + lean, 7 + o, 5, 2, pal.capDk);
    c.px(7 + lean, 5 + o, pal.capLt);
    c.px(5 + lean, 10 + o, pal.skinDk);
    c.fill(7 + lean, 10 + o, 2, 2, pal.eye);
    c.px(7 + lean, 10 + o, C.shoe);
    c.px(5 + lean, 13 + o, pal.mouth);
    c.fill(6 + lean, 15 + o, 6, 7, pal.jacket);
    c.fill(6 + lean, 16 + o, 2, 4, pal.shirt);
    c.fill(5 + lean, 16 + o + (step < 0 ? 1 : 0), 2, 4, pal.jacketDk);
    c.px(5 + lean, 20 + o, pal.skin);
    const front = step === 0 ? 0 : step * (run ? 2 : 1);
    c.fill(8 + lean, 22 + o, 2, 4, pal.pants);
    c.fill(7 + lean - Math.max(front, 0), 26 + o, 3, 2, pal.shoe);
    c.fill(9 + lean + Math.max(front, 0), 22 + o, 2, 4, pal.pantsDk);
    c.fill(9 + lean + Math.max(front, 0), 26 + o + (front > 0 ? 0 : 1), 3, 2, pal.shoeDk);
  }
  outline(c, C.outline);
  return c;
}

const PLAYER = {
  hair: C.hair,
  hairLt: C.hairLt,
  cap: C.cap,
  capDk: C.capDk,
  capLt: C.capLt,
  skin: C.skin,
  skinDk: C.skinDk,
  jacket: C.jacket,
  jacketDk: C.jacketDk,
  shirt: C.shirt,
  shirtDk: C.shirtDk,
  pants: C.pants,
  pantsDk: C.pantsDk,
  shoe: C.shoe,
  shoeDk: C.shoeDk,
  eye: C.eye,
  mouth: C.mouth,
};

const VILLAGER = {
  hair: C.npcHair,
  hairLt: C.npcHairLt,
  cap: C.npcHair,
  capDk: C.npcHairLt,
  capLt: C.npcHairLt,
  skin: hex('#f3c096'),
  skinDk: hex('#d9a47c'),
  jacket: C.npcJacket,
  jacketDk: C.npcJacketDk,
  shirt: C.npcShirt,
  shirtDk: C.npcShirtDk,
  pants: C.npcPants,
  pantsDk: C.npcPantsDk,
  shoe: C.npcShoe,
  shoeDk: C.npcShoeDk,
  eye: C.eye,
  mouth: C.mouth,
};

function sheetFor(pal) {
  const poses = ['stand', 'walk1', 'walk2', 'run1', 'run2', 'run3'];
  const dirs = ['down', 'up', 'left', 'right'];
  const frames = new Map();
  for (const dir of ['down', 'up', 'left']) {
    for (const pose of poses) frames.set(`${dir}_${pose}`, paintPerson(dir, pose, pal));
  }
  for (const pose of poses) frames.set(`right_${pose}`, mirror(frames.get(`left_${pose}`)));
  const sheet = canvas(poses.length * 16, dirs.length * 32);
  dirs.forEach((dir, row) => {
    poses.forEach((pose, col) => sheet.blit(frames.get(`${dir}_${pose}`), col * 16, row * 32));
  });
  return sheet;
}

function paintItem() {
  const c = canvas(16, 16);
  c.fill(4, 5, 8, 7, C.cloth);
  c.fill(5, 3, 6, 3, C.clothDk);
  c.fill(7, 6, 2, 2, C.ember);
  c.fill(6, 11, 4, 2, C.woodDk);
  c.px(8, 4, C.trim);
  outline(c, C.woodDp);
  return c;
}

function paintIcon(player) {
  const icon = canvas(64, 64);
  icon.fill(0, 0, 64, 64, hex('#1a4e86'));
  for (let y = 0; y < 28; y++) {
    const band = y < 10 ? hex('#3d86c8') : y < 18 ? hex('#69b4e4') : hex('#8ecff2');
    icon.fill(0, y, 64, 1, band);
  }
  icon.fill(0, 40, 64, 24, C.grassDk);
  icon.fill(0, 40, 64, 4, C.grass);
  for (let x = 4; x < 60; x += 7) icon.px(x, 44, C.grassLt);
  // 2x player stand, cropped into the badge
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 16; x++) {
      const i = (y * player.w + x) * 4;
      if (player.data[i + 3] === 0) continue;
      const color = [player.data[i], player.data[i + 1], player.data[i + 2], 255];
      icon.fill(16 + x * 2, 8 + y * 2, 2, 2, color);
    }
  }
  return icon;
}

export function createArt() {
  const tiles = [];
  const meta = [];
  const ids = {};

  function add(name, painter, props = {}, anim = null) {
    let tile = canvas(16, 16);
    if (typeof painter === 'function') {
      const returned = painter(tile);
      if (returned?.data) tile = returned;
    } else if (painter?.data) {
      tile = painter;
    } else {
      throw new Error(`Tile "${name}" has no pixels`);
    }
    const id = tiles.length;
    tiles.push(tile);
    meta.push({ id, name, props, anim });
    ids[name] = id;
    return id;
  }

  add('grass', (c) => paintGrass(c, 1));
  add('grass_b', (c) => paintGrass(c, 2));
  add('grass_c', (c) => paintGrass(c, 3));

  const flowers = [
    ['red', C.roofRed],
    ['yellow', C.ember],
    ['white', C.trim],
    ['blue', C.roofBlueLt],
  ];
  for (const [name, color] of flowers) {
    const a = add(`flower_${name}`, (c) => paintFlower(c, color, 0));
    const b = add(`flower_${name}_2`, (c) => paintFlower(c, color, 1));
    meta[a].anim = [
      { duration: 520, tileid: a },
      { duration: 520, tileid: b },
    ];
  }

  const tallKinds = [
    ['tall', C.grassLt, C.grass, C.grassDp],
    ['tall_snow', C.snow, C.snowDk, C.ice],
    ['tall_sand', C.sandLt, C.sand, C.sandDk],
    ['tall_dune', C.grassLt, hex('#8aaa48'), hex('#5e7a28')],
    ['tall_scrub', hex('#b7c07a'), hex('#8a9358'), hex('#5d6840')],
  ];
  for (const [name, tip, mid, dark] of tallKinds) {
    const ids3 = [0, 1, 2].map((frame) => add(`${name}${frame === 0 ? '' : `_${frame + 1}`}`, (c) => paintTall(c, tip, mid, dark, frame), { encounter: true }));
    meta[ids3[0]].anim = [
      { duration: 280, tileid: ids3[0] },
      { duration: 280, tileid: ids3[1] },
      { duration: 280, tileid: ids3[2] },
      { duration: 280, tileid: ids3[1] },
    ];
  }

  for (let mask = 0; mask < 16; mask++) add(`path_${mask}`, (c) => paintPath(c, mask));

  const waters = [0, 1, 2, 3].map((frame) => add(`water_${frame}`, (c) => paintWater(c, frame), { solid: true }));
  meta[waters[0]].anim = waters.map((id, i) => ({ duration: 240, tileid: waters[i] }));

  const shores = {
    shore_n: { n: true },
    shore_e: { e: true },
    shore_s: { s: true },
    shore_w: { w: true },
    shore_ne: { n: true, e: true },
    shore_nw: { n: true, w: true },
    shore_se: { s: true, e: true },
    shore_sw: { s: true, w: true },
  };
  for (const [name, land] of Object.entries(shores)) add(name, (c) => paintShore(c, land));

  add('sand', (c) => paintSand(c, 1));
  add('sand_b', (c) => paintSand(c, 2));
  add('gravel', (c) => paintGravel(c, 0));
  add('gravel_b', (c) => paintGravel(c, 1));
  add('snow', (c) => paintSnow(c, 1));
  add('snow_b', (c) => paintSnow(c, 2));
  add('ice', (c) => paintIce(c));
  add('cliff', (c) => paintCliff(c, false), { solid: true });
  add('cliff_b', (c) => paintCliff(c, true), { solid: true });
  add('boulder', (c) => paintBoulder(c), { solid: true });

  const tree = splitTree(false);
  ['tree_tl', 'tree_tr', 'tree_bl', 'tree_br'].forEach((name, i) => add(name, tree[i], { solid: true }));
  const stree = splitTree(true);
  ['stree_tl', 'stree_tr', 'stree_bl', 'stree_br'].forEach((name, i) => add(name, stree[i], { solid: true }));
  add('cactus_top', paintCactus(true), { solid: true });
  add('cactus_bot', paintCactus(false), { solid: true });

  add('fence_h', paintFence('h'), { solid: true });
  add('fence_v', paintFence('v'), { solid: true });
  add('fence_post', paintFence('post'), { solid: true });
  add('bar_l', paintBar('l'), { solid: true });
  add('bar_r', paintBar('r'), { solid: true });
  add('bar_v', paintBar('v'), { solid: true });
  add('sign', (c) => paintSign(c), { solid: true });

  const roofs = {
    house: [C.roofRedLt, C.roofRed, C.roofRedDk],
    mart: [C.roofBlueLt, C.roofBlue, C.roofBlueDk],
    center: [C.roofPinkLt, C.roofPink, C.roofPinkDk],
    lab: [C.roofGreenLt, C.roofGreen, C.roofGreenDk],
  };
  for (const [style, [hi, mid, dk]] of Object.entries(roofs)) {
    for (const kind of ['tl', 'top', 'tr', 'left', 'mid', 'right', 'bl', 'eave', 'br']) {
      add(`roof_${style}_${kind}`, paintRoofTile(kind, hi, mid, dk), { solid: true });
    }
  }

  add('wall', (c) => paintWall(false), { solid: true });
  add('wall_window', (c) => paintWall(true), { solid: true });
  for (const style of ['house', 'mart', 'center', 'lab']) add(`door_${style}`, paintDoor(style));
  add('door_shut', paintDoor('house'), { solid: true });

  add('floor_wood', (c) => paintPlanks(c, C.wood, hex('#d4a86a'), C.woodDp));
  add('floor_tile', (c) => paintFloorTile(c, C.floorTile, C.floorTileDk));
  add('floor_mart', (c) => paintFloorTile(c, C.floorMart, C.floorMartDk));
  add('floor_lab', (c) => paintFloorTile(c, C.floorLab, C.floorLabDk));
  add('floor_cave', (c) => paintCaveFloor(c));
  add('wall_cave', (c) => paintCaveWall(c), { solid: true });
  add('cave_hole', (c) => paintHole(c));
  add('counter', (c) => paintCounter(c), { solid: true });
  add('shelf', (c) => paintShelf(c), { solid: true });
  add('table', (c) => paintTable(c), { solid: true });
  add('bed_top', paintBed(true), { solid: true });
  add('bed_bot', paintBed(false), { solid: true });
  add('machine', (c) => paintMachine(c), { solid: true });
  add('crate', (c) => paintCrate(c), { solid: true });
  add('plant', (c) => paintPlant(c), { solid: true });
  add('rug', (c) => paintRug(c));
  add('mat', (c) => paintMat(c));
  add('pier', (c) => paintPier(c));

  const columns = 16;
  const player = sheetFor(PLAYER);
  const npc = sheetFor(VILLAGER);
  const item = paintItem();
  const icon = paintIcon(framesStand(player));

  return { tiles, meta, ids, columns, player, npc, item, icon };
}

function framesStand(sheet) {
  // down/stand is the top-left 16x32 of the sheet, but paintIcon samples player.w as if it's the frame.
  // Pass a 16x32 view instead.
  const frame = canvas(16, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 16; x++) {
      const i = (y * sheet.w + x) * 4;
      if (sheet.data[i + 3] === 0) continue;
      frame.px(x, y, [sheet.data[i], sheet.data[i + 1], sheet.data[i + 2], 255]);
    }
  }
  return frame;
}

export function gidOf(art, name) {
  const id = art.ids[name];
  if (id === undefined) throw new Error(`Unknown tile "${name}"`);
  return id + 1;
}
