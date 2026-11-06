import type { Dir } from '../sim/types';
import { isDir } from '../sim/types';
import { parseTiledMap, parseTilesetMeta, type TiledMapFile, type TiledTilesetFile, type TilesetMeta } from './tiled';
import type { RuntimeMap } from '../sim/types';

export interface GameConfig {
  title: string;
  playerName: string;
  textSpeed: number;
  showDebug: boolean;
  start: { map: string; x: number; y: number; facing: Dir };
  defaultFlags: Record<string, boolean>;
  maps: string[];
  dialogue: string[];
}

export interface NpcDef {
  id: string;
  map: string;
  x: number;
  y: number;
  sprite: string;
  facing: Dir;
  dialogue: string;
}

export interface ItemDef {
  name: string;
  description: string;
}

export class TileSheet {
  constructor(
    readonly image: HTMLImageElement,
    readonly columns: number,
    readonly meta: TilesetMeta,
  ) {}

  frame(localId: number, timeMs: number): number {
    const anim = this.meta.animations.get(localId);
    if (!anim || anim.length === 0) return localId;
    const total = anim.reduce((sum, step) => sum + step.duration, 0);
    let t = timeMs % total;
    for (const step of anim) {
      if (t < step.duration) return step.tileid;
      t -= step.duration;
    }
    return localId;
  }

  draw(ctx: CanvasRenderingContext2D, gid: number, dx: number, dy: number, timeMs: number): void {
    const raw = gid & 0x1fffffff;
    if (raw <= 0) return;
    const frame = this.frame(raw - 1, timeMs);
    const sx = (frame % this.columns) * 16;
    const sy = Math.floor(frame / this.columns) * 16;
    ctx.drawImage(this.image, sx, sy, 16, 16, dx, dy, 16, 16);
  }
}

export interface Content {
  config: GameConfig;
  maps: Record<string, RuntimeMap>;
  tiles: TileSheet;
  dialogue: Record<string, string[]>;
  npcs: NpcDef[];
  items: Record<string, ItemDef>;
  player: HTMLImageElement;
  npc: HTMLImageElement;
  item: HTMLImageElement;
  flagNames: string[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url} (${response.status})`);
  return (await response.json()) as T;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${url}`));
    image.src = url;
  });
}

function readConfig(raw: Partial<GameConfig>): GameConfig {
  const facing = raw.start?.facing;
  if (!raw.title || !raw.start || !raw.maps || !isDir(facing)) {
    throw new Error('public/data/config.json is missing title, start, or maps.');
  }
  const flags: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw.defaultFlags ?? {})) {
    if (typeof value === 'boolean') flags[key] = value;
  }
  return {
    title: raw.title,
    playerName: raw.playerName || 'HERO',
    textSpeed: raw.textSpeed && raw.textSpeed > 0 ? raw.textSpeed : 2,
    showDebug: raw.showDebug !== false,
    start: { map: raw.start.map, x: raw.start.x, y: raw.start.y, facing },
    defaultFlags: flags,
    maps: raw.maps,
    dialogue: raw.dialogue ?? [],
  };
}

function readNpcs(raw: unknown): NpcDef[] {
  if (!Array.isArray(raw)) return [];
  const npcs: NpcDef[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const npc = entry as Partial<NpcDef>;
    if (!npc.id || !npc.map || !npc.dialogue || !isDir(npc.facing)) continue;
    if (typeof npc.x !== 'number' || typeof npc.y !== 'number') continue;
    npcs.push({
      id: npc.id,
      map: npc.map,
      x: npc.x,
      y: npc.y,
      sprite: npc.sprite || 'npc',
      facing: npc.facing,
      dialogue: npc.dialogue,
    });
  }
  return npcs;
}

export async function loadGameContent(base: string): Promise<Content> {
  const config = readConfig(await fetchJson<Partial<GameConfig>>(`${base}data/config.json`));
  const tilesetJson = await fetchJson<TiledTilesetFile>(`${base}tilesets/overworld.tsj`);
  const meta = parseTilesetMeta(tilesetJson);
  const [image, player, npc, item, npcJson, itemJson] = await Promise.all([
    loadImage(`${base}tilesets/overworld.png`),
    loadImage(`${base}sprites/player.png`),
    loadImage(`${base}sprites/npc.png`),
    loadImage(`${base}sprites/item.png`),
    fetchJson<unknown>(`${base}data/npcs.json`),
    fetchJson<Record<string, ItemDef>>(`${base}data/items.json`),
  ]);
  const maps: Record<string, RuntimeMap> = {};
  await Promise.all(
    config.maps.map(async (id) => {
      const file = await fetchJson<TiledMapFile>(`${base}data/maps/${id}.json`);
      maps[id] = parseTiledMap(id, file, meta);
    }),
  );
  const dialogue: Record<string, string[]> = {};
  for (const name of config.dialogue) {
    const file = await fetchJson<Record<string, string[]>>(`${base}data/dialogue/${name}.json`);
    Object.assign(dialogue, file);
  }
  const flagNames = new Set(Object.keys(config.defaultFlags));
  for (const map of Object.values(maps)) {
    for (const gate of map.gates) flagNames.add(gate.flag);
    for (const spot of map.items) flagNames.add(spot.flag);
  }
  return {
    config,
    maps,
    tiles: new TileSheet(image, tilesetJson.columns, meta),
    dialogue,
    npcs: readNpcs(npcJson),
    items: itemJson,
    player,
    npc,
    item,
    flagNames: [...flagNames].sort(),
  };
}
