import type { Connection, Dir, Gate, ItemSpot, RuntimeMap, Sign, Warp } from '../sim/types';
import { isDir } from '../sim/types';

const GID_MASK = 0x1fffffff;

export interface TilesetMeta {
  columns: number;
  solid: Set<number>;
  encounter: Set<number>;
  animations: Map<number, { tileid: number; duration: number }[]>;
}

interface TiledProperty {
  name: string;
  type?: string;
  value: unknown;
}

interface TiledLayer {
  name: string;
  type: string;
  data?: number[] | string;
  objects?: TiledObject[];
}

interface TiledObject {
  name?: string;
  type?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  properties?: TiledProperty[];
}

export interface TiledMapFile {
  width: number;
  height: number;
  properties?: TiledProperty[];
  layers: TiledLayer[];
}

export interface TiledTilesetFile {
  columns: number;
  tiles?: {
    id: number;
    properties?: TiledProperty[];
    animation?: { tileid: number; duration: number }[];
  }[];
}

function propBag(list: TiledProperty[] | undefined): Record<string, unknown> {
  const bag: Record<string, unknown> = {};
  for (const prop of list ?? []) bag[prop.name] = prop.value;
  return bag;
}

function asDir(value: unknown, fallback: Dir): Dir {
  return isDir(value) ? value : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function parseTilesetMeta(json: TiledTilesetFile): TilesetMeta {
  const solid = new Set<number>();
  const encounter = new Set<number>();
  const animations = new Map<number, { tileid: number; duration: number }[]>();
  for (const tile of json.tiles ?? []) {
    const bag = propBag(tile.properties);
    if (bag.solid === true) solid.add(tile.id);
    if (bag.encounter === true) encounter.add(tile.id);
    if (tile.animation && tile.animation.length > 0) animations.set(tile.id, tile.animation);
  }
  return { columns: json.columns, solid, encounter, animations };
}

function layerData(mapId: string, layer: TiledLayer, count: number): Uint16Array {
  if (!Array.isArray(layer.data)) {
    throw new Error(`Map "${mapId}" layer "${layer.name}" is compressed. Re-save the map as uncompressed Tiled JSON.`);
  }
  if (layer.data.length !== count) {
    throw new Error(`Map "${mapId}" layer "${layer.name}" has ${layer.data.length} tiles, expected ${count}.`);
  }
  const out = new Uint16Array(count);
  for (let i = 0; i < count; i++) out[i] = layer.data[i] & GID_MASK;
  return out;
}

export function parseTiledMap(id: string, json: TiledMapFile, meta: TilesetMeta): RuntimeMap {
  const width = json.width;
  const height = json.height;
  const count = width * height;
  const found = new Map<string, TiledLayer>();
  let events: TiledObject[] = [];
  for (const layer of json.layers) {
    if (layer.type === 'tilelayer') found.set(layer.name, layer);
    if (layer.type === 'objectgroup' && layer.name === 'events') events = layer.objects ?? [];
  }
  const take = (name: string) => {
    const layer = found.get(name);
    return layer ? layerData(id, layer, count) : new Uint16Array(count);
  };
  const ground = take('ground');
  const fringe = take('fringe');
  const objects = take('objects');
  const overhead = take('overhead');
  const solid = new Uint8Array(count);
  const encounter = new Uint8Array(count);
  const mark = (layer: Uint16Array) => {
    for (let i = 0; i < count; i++) {
      const gid = layer[i];
      if (!gid) continue;
      const local = gid - 1;
      if (meta.solid.has(local)) solid[i] = 1;
      if (meta.encounter.has(local)) encounter[i] = 1;
    }
  };
  mark(ground);
  mark(fringe);
  mark(objects);
  mark(overhead);

  const warps: Warp[] = [];
  const connections: Connection[] = [];
  const gates: Gate[] = [];
  const signs: Sign[] = [];
  const items: ItemSpot[] = [];

  for (const obj of events) {
    const kind = (obj.type || obj.name || '').toLowerCase();
    const bag = propBag(obj.properties);
    const x = Math.round(obj.x / 16);
    const y = Math.round(obj.y / 16);
    if (kind === 'warp') {
      warps.push({
        x,
        y,
        map: asString(bag.map),
        tx: asNumber(bag.x, 0),
        ty: asNumber(bag.y, 0),
        facing: asDir(bag.facing, 'down'),
      });
    } else if (kind === 'connection') {
      const side = asDir(bag.side, 'up');
      connections.push({ side, map: asString(bag.map), offset: asNumber(bag.offset, 0) });
    } else if (kind === 'gate') {
      const w = Math.max(1, Math.round((obj.width || 16) / 16));
      const h = Math.max(1, Math.round((obj.height || 16) / 16));
      const tiles = asString(bag.tiles)
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isFinite(n));
      gates.push({ x, y, w, h, flag: asString(bag.flag), tiles });
    } else if (kind === 'sign') {
      signs.push({ x, y, dialogue: asString(bag.dialogue) });
    } else if (kind === 'item') {
      items.push({ x, y, itemId: asString(bag.item), flag: asString(bag.flag, `item:${id}:${x}:${y}`) });
    }
  }

  const mapBag = propBag(json.properties);
  return {
    id,
    name: asString(mapBag.name, id),
    showName: asBool(mapBag.showName, true),
    interior: asBool(mapBag.interior, false),
    width,
    height,
    ground,
    fringe,
    objects,
    overhead,
    solid,
    encounter,
    warps,
    connections,
    gates,
    signs,
    items,
  };
}
