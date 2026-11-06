import type { MoveDef } from '../sim/battle';
import type { SpeciesDef } from '../sim/growth';
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
  role?: 'nurse' | 'clerk' | 'pc' | 'professor' | 'sol';
  trainer?: string;
  sight?: number;
}

export interface TrainerDef {
  name: string;
  intro: string[];
  lose: string[];
  prize: number;
  flag?: string;
  rival?: boolean;
  party: { species: string; level: number }[];
}

export interface EncounterTable {
  rate: number;
  min: number;
  max: number;
  table: { species: string; weight: number }[];
}

export interface MonArt {
  idle1: HTMLImageElement;
  idle2: HTMLImageElement;
  attack: HTMLImageElement;
  hurt: HTMLImageElement;
  back: HTMLImageElement;
}

export interface ItemDef {
  name: string;
  description: string;
  price?: number;
  sell?: number;
  kind?: 'ball' | 'heal' | 'status' | 'revive' | 'rope' | 'repel';
  power?: number;
  mart?: boolean;
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
  creatures: Record<string, SpeciesDef>;
  moves: Record<string, MoveDef>;
  chart: Record<string, Record<string, number>>;
  encounters: Record<string, EncounterTable>;
  trainers: Record<string, TrainerDef>;
  monArt: Record<string, MonArt>;
  playerSheets: Record<string, HTMLImageElement>;
  worldMap: HTMLImageElement;
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
    if (!npc.id || !npc.map || !isDir(npc.facing)) continue;
    if (typeof npc.x !== 'number' || typeof npc.y !== 'number') continue;
    npcs.push({
      id: npc.id,
      map: npc.map,
      x: npc.x,
      y: npc.y,
      sprite: npc.sprite || 'npc',
      facing: npc.facing,
      dialogue: npc.dialogue || '',
      role: npc.role,
      trainer: npc.trainer,
      sight: npc.sight,
    });
  }
  return npcs;
}

export async function loadGameContent(base: string): Promise<Content> {
  const config = readConfig(await fetchJson<Partial<GameConfig>>(`${base}data/config.json`));
  const tilesetJson = await fetchJson<TiledTilesetFile>(`${base}tilesets/overworld.tsj`);
  const meta = parseTilesetMeta(tilesetJson);
  const [image, player, playerCap, playerRibbon, npc, item, worldMap, npcJson, itemJson, creatures, moves, typeFile, encounters, trainers] = await Promise.all([
    loadImage(`${base}tilesets/overworld.png`),
    loadImage(`${base}sprites/player.png`),
    loadImage(`${base}sprites/player_cap.png`),
    loadImage(`${base}sprites/player_ribbon.png`),
    loadImage(`${base}sprites/npc.png`),
    loadImage(`${base}sprites/item.png`),
    loadImage(`${base}sprites/worldmap.png`),
    fetchJson<unknown>(`${base}data/npcs.json`),
    fetchJson<Record<string, ItemDef>>(`${base}data/items.json`),
    fetchJson<Record<string, SpeciesDef>>(`${base}data/creatures.json`),
    fetchJson<Record<string, MoveDef>>(`${base}data/moves.json`),
    fetchJson<{ chart: Record<string, Record<string, number>> }>(`${base}data/types.json`),
    fetchJson<Record<string, EncounterTable>>(`${base}data/encounters.json`),
    fetchJson<Record<string, TrainerDef>>(`${base}data/trainers.json`),
  ]);
  const monArt: Record<string, MonArt> = {};
  await Promise.all(
    Object.keys(creatures).map(async (id) => {
      const folder = creatures[id]?.folder ?? id;
      const root = `${base}sprites/jakamon/${folder}/`;
      const [idle1, idle2, attack, hurt, back] = await Promise.all([
        loadImage(`${root}idle1.png`),
        loadImage(`${root}idle2.png`),
        loadImage(`${root}attack.png`),
        loadImage(`${root}hurt.png`),
        loadImage(`${root}back.png`),
      ]);
      monArt[id] = { idle1, idle2, attack, hurt, back };
    }),
  );
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
    creatures,
    moves,
    chart: typeFile.chart,
    encounters,
    trainers,
    monArt,
    playerSheets: { fluff: player, cap: playerCap, ribbon: playerRibbon },
    worldMap,
    player,
    npc,
    item,
    flagNames: [...flagNames].sort(),
  };
}
