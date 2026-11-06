import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canvas, packTiles, scaleNearest } from './lib/canvas.mjs';
import { encodePng } from './lib/png.mjs';
import { createArt } from './lib/art.mjs';
import { GAME_CONFIG, buildMaps, tiledDocument } from './lib/world.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const art = createArt();
const sheet = packTiles(art.tiles, art.columns);
const maps = buildMaps(art);

fs.mkdirSync(path.join(root, 'public/tilesets'), { recursive: true });
fs.mkdirSync(path.join(root, 'public/sprites'), { recursive: true });
fs.mkdirSync(path.join(root, 'public/icons'), { recursive: true });
fs.mkdirSync(path.join(root, 'public/data/maps'), { recursive: true });
fs.mkdirSync(path.join(root, 'public/data/dialogue'), { recursive: true });

fs.writeFileSync(path.join(root, 'public/tilesets/overworld.png'), encodePng(sheet.w, sheet.h, sheet.data));
fs.writeFileSync(path.join(root, 'public/sprites/player.png'), encodePng(art.player.w, art.player.h, art.player.data));
fs.writeFileSync(path.join(root, 'public/sprites/npc.png'), encodePng(art.npc.w, art.npc.h, art.npc.data));
fs.writeFileSync(path.join(root, 'public/sprites/item.png'), encodePng(art.item.w, art.item.h, art.item.data));

const icon192 = scaleNearest(art.icon, 3);
const icon512 = scaleNearest(art.icon, 8);
fs.writeFileSync(path.join(root, 'public/icons/icon-192.png'), encodePng(icon192.w, icon192.h, icon192.data));
fs.writeFileSync(path.join(root, 'public/icons/icon-512.png'), encodePng(icon512.w, icon512.h, icon512.data));
const favicon = downsample(art.icon, 2);
fs.writeFileSync(path.join(root, 'public/favicon.png'), encodePng(favicon.w, favicon.h, favicon.data));

const tilesetTiles = [];
for (const entry of art.meta) {
  const properties = Object.entries(entry.props).map(([name, value]) => ({
    name,
    type: typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'int' : 'string',
    value,
  }));
  if (!properties.length && !entry.anim) continue;
  const tile = { id: entry.id };
  if (properties.length) tile.properties = properties;
  if (entry.anim) tile.animation = entry.anim;
  tilesetTiles.push(tile);
}

const tsj = {
  columns: art.columns,
  image: 'overworld.png',
  imageheight: sheet.h,
  imagewidth: sheet.w,
  margin: 0,
  name: 'overworld',
  spacing: 0,
  tilecount: art.tiles.length,
  tileheight: 16,
  tilewidth: 16,
  type: 'tileset',
  version: '1.10',
  tiledversion: '1.10.2',
  tiles: tilesetTiles,
};
fs.writeFileSync(path.join(root, 'public/tilesets/overworld.tsj'), JSON.stringify(tsj, null, 2));

for (const map of Object.values(maps)) {
  fs.writeFileSync(path.join(root, 'public/data/maps', `${map.id}.json`), JSON.stringify(tiledDocument(map)));
}

fs.writeFileSync(path.join(root, 'public/data/config.json'), JSON.stringify(GAME_CONFIG, null, 2) + '\n');

validate(art, maps);

const previews = path.join(root, 'tmp-preview');
fs.mkdirSync(previews, { recursive: true });
const town = renderMap(maps.town, art, GAME_CONFIG.start.x, GAME_CONFIG.start.y);
fs.writeFileSync(path.join(previews, 'town.png'), encodePng(town.w, town.h, town.data));
const beach = renderMap(maps.route_beach, art, 12, 13);
fs.writeFileSync(path.join(previews, 'beach.png'), encodePng(beach.w, beach.h, beach.data));
const interior = renderMap(maps.poke_center, art, 7, 7);
fs.writeFileSync(path.join(previews, 'center.png'), encodePng(interior.w, interior.h, interior.data));
const actor = scaleNearest(art.player, 4);
fs.writeFileSync(path.join(previews, 'player.png'), encodePng(actor.w, actor.h, actor.data));
const tilesPreview = scaleNearest(sheet, 2);
fs.writeFileSync(path.join(previews, 'tiles.png'), encodePng(tilesPreview.w, tilesPreview.h, tilesPreview.data));

console.log(`tiles ${art.tiles.length} (${sheet.w}x${sheet.h}), maps ${Object.keys(maps).length}`);

function crop(src, x, y, w, h) {
  const out = canvas(w, h);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const i = ((y + yy) * src.w + (x + xx)) * 4;
      if (src.data[i + 3] === 0) continue;
      out.px(xx, yy, [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]]);
    }
  }
  return out;
}

function downsample(src, factor) {
  const out = canvas(Math.floor(src.w / factor), Math.floor(src.h / factor));
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const i = (y * factor * src.w + x * factor) * 4;
      if (src.data[i + 3] === 0) continue;
      out.px(x, y, [src.data[i], src.data[i + 1], src.data[i + 2], 255]);
    }
  }
  return out;
}

function isSolidGid(gid) {
  if (!gid) return false;
  return Boolean(art.meta[gid - 1]?.props.solid);
}

function blocked(map, x, y) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true;
  const i = y * map.w + x;
  if (isSolidGid(map.ground[i]) || isSolidGid(map.objects[i]) || isSolidGid(map.fringe[i]) || isSolidGid(map.overhead[i])) return true;
  if (map.signs.some((s) => s.x === x && s.y === y)) return true;
  return false;
}

function validate(artRef, all) {
  const ids = new Set(Object.keys(all));
  const start = all[GAME_CONFIG.start.map];
  if (blocked(start, GAME_CONFIG.start.x, GAME_CONFIG.start.y)) {
    throw new Error(`Start tile ${GAME_CONFIG.start.x},${GAME_CONFIG.start.y} is blocked`);
  }
  for (const map of Object.values(all)) {
    for (const warp of map.warps) {
      if (!ids.has(warp.map)) throw new Error(`${map.id} warp targets missing map ${warp.map}`);
      const dest = all[warp.map];
      if (warp.tx < 0 || warp.ty < 0 || warp.tx >= dest.w || warp.ty >= dest.h) {
        throw new Error(`${map.id} warp lands out of bounds in ${warp.map}`);
      }
      if (blocked(dest, warp.tx, warp.ty)) throw new Error(`${map.id} warp lands on solid ${warp.map} ${warp.tx},${warp.ty}`);
      if (dest.warps.some((w) => w.x === warp.tx && w.y === warp.ty)) {
        throw new Error(`${map.id} warp lands on another warp in ${warp.map}`);
      }
    }
    for (const conn of map.connections) {
      if (!ids.has(conn.map)) throw new Error(`${map.id} connection missing ${conn.map}`);
    }
    for (const gate of map.gates) {
      if (gate.tiles.length !== gate.w * gate.h) throw new Error(`${map.id} gate tile count`);
    }
  }
  void artRef;
}

function renderMap(map, artRef, px, py) {
  const view = canvas(240, 160);
  const camX = Math.max(0, Math.min(map.w * 16 - 240, px * 16 + 8 - 120));
  const camY = Math.max(0, Math.min(map.h * 16 - 160, py * 16 + 8 - 80));
  const drawLayer = (layer) => {
    const x0 = Math.max(0, Math.floor(camX / 16));
    const y0 = Math.max(0, Math.floor(camY / 16));
    const x1 = Math.min(map.w, Math.ceil((camX + 240) / 16));
    const y1 = Math.min(map.h, Math.ceil((camY + 160) / 16));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const gid = layer[y * map.w + x];
        if (!gid) continue;
        view.blit(artRef.tiles[gid - 1], x * 16 - camX, y * 16 - camY);
      }
    }
  };
  drawLayer(map.ground);
  drawLayer(map.objects);
  for (const gate of map.gates) {
    if (GAME_CONFIG.defaultFlags[gate.flag]) continue;
    gate.tiles.forEach((gid, i) => {
      const tx = gate.x + (i % gate.w);
      const ty = gate.y + Math.floor(i / gate.w);
      view.blit(artRef.tiles[gid - 1], tx * 16 - camX, ty * 16 - camY);
    });
  }
  view.blit(crop(artRef.player, 0, 0, 16, 32), px * 16 - camX, py * 16 - camY - 16);
  drawLayer(map.fringe);
  drawLayer(map.overhead);
  return scaleNearest(view, 3);
}
