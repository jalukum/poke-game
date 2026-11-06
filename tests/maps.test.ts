import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTiledMap, parseTilesetMeta, type TiledMapFile, type TiledTilesetFile } from '../src/content/tiled';
import type { GameConfig } from '../src/content/load';

const config = JSON.parse(readFileSync('public/data/config.json', 'utf8')) as GameConfig;
const tileset = parseTilesetMeta(JSON.parse(readFileSync('public/tilesets/overworld.tsj', 'utf8')) as TiledTilesetFile);

function load(id: string) {
  const json = JSON.parse(readFileSync(`public/data/maps/${id}.json`, 'utf8')) as TiledMapFile;
  return parseTiledMap(id, json, tileset);
}

describe('shipped maps', () => {
  const maps = Object.fromEntries(config.maps.map((id) => [id, load(id)]));

  it('loads every map listed in the config', () => {
    expect(config.maps.length).toBeGreaterThanOrEqual(10);
    for (const id of config.maps) expect(maps[id]?.id).toBe(id);
  });

  it('starts the player on an open town tile', () => {
    const town = maps[config.start.map];
    expect(town).toBeTruthy();
    const { x, y } = config.start;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(town.width);
    expect(y).toBeLessThan(town.height);
    expect(town.solid[y * town.width + x]).toBe(0);
    expect(town.signs.some((sign) => sign.x === x && sign.y === y)).toBe(false);
    expect(town.warps.some((warp) => warp.x === x && warp.y === y)).toBe(false);
  });

  it('sends every warp to a free tile that is not itself a warp', () => {
    for (const map of Object.values(maps)) {
      for (const warp of map.warps) {
        const dest = maps[warp.map];
        expect(dest, `${map.id} -> ${warp.map}`).toBeTruthy();
        expect(warp.tx).toBeGreaterThanOrEqual(0);
        expect(warp.ty).toBeGreaterThanOrEqual(0);
        expect(warp.tx).toBeLessThan(dest.width);
        expect(warp.ty).toBeLessThan(dest.height);
        expect(dest.solid[warp.ty * dest.width + warp.tx]).toBe(0);
        expect(dest.warps.some((other) => other.x === warp.tx && other.y === warp.ty)).toBe(false);
      }
    }
  });

  it('connects routes in a loop around town and gates them with flags', () => {
    expect(maps.town.connections.map((c) => c.map).sort()).toEqual([
      'route_beach',
      'route_forest',
      'route_mountain',
      'route_snow',
    ]);
    expect(maps.town.warps.map((warp) => warp.map).sort()).toEqual(['lab', 'player_house', 'poke_center', 'poke_mart']);
    const flags = new Set<string>();
    for (const map of Object.values(maps)) {
      for (const gate of map.gates) {
        expect(gate.flag.length).toBeGreaterThan(0);
        expect(gate.tiles.length).toBe(gate.w * gate.h);
        flags.add(gate.flag);
      }
      for (const connection of map.connections) expect(maps[connection.map]).toBeTruthy();
    }
    expect(flags.has('dungeon1_cleared')).toBe(true);
    expect(flags.has('dungeon4_cleared')).toBe(true);
    for (const id of ['route_forest', 'route_beach', 'route_mountain', 'route_desert', 'route_snow']) {
      expect(maps[id].encounter.some((cell) => cell === 1)).toBe(true);
    }
  });
});
