import type { Dir } from './types';
import { isDir } from './types';

/** Bump this when the stored shape changes, and teach `normalizeSave` how to migrate. */
export const SAVE_VERSION = 2;

export const SLOT_COUNT = 3;

export interface InventoryEntry {
  id: string;
  qty: number;
}

export interface Appearance {
  style: 'fluff' | 'cap' | 'ribbon';
  hair: number;
  skin: number;
  outfit: number;
}

export interface SavedMon {
  uid: number;
  species: string;
  level: number;
  exp: number;
  hp: number;
  status: '' | 'sap' | 'daze';
  moves: { id: string; pp: number }[];
}

export interface SaveGame {
  version: number;
  playerName: string;
  playTimeMs: number;
  mapId: string;
  x: number;
  y: number;
  facing: Dir;
  flags: Record<string, boolean>;
  inventory: InventoryEntry[];
  locationName: string;
  money: number;
  appearance: Appearance;
  party: SavedMon[];
  box: SavedMon[];
  seen: string[];
  caught: string[];
  repel: number;
  nextUid: number;
  starter: string;
}

export function defaultAppearance(): Appearance {
  return { style: 'fluff', hair: 0, skin: 0, outfit: 0 };
}

export type LoadResult = { ok: true; save: SaveGame } | { ok: false; reason: 'empty' | 'corrupt' | 'version' };

export function saveKey(slot: number): string {
  return `pokegame.save.slot.${slot}`;
}

export function formatPlayTime(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const totalMin = Math.floor(safe / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readMons(value: unknown): SavedMon[] | null {
  if (!Array.isArray(value)) return [];
  const mons: SavedMon[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.species !== 'string' || typeof entry.level !== 'number') return null;
    if (!Array.isArray(entry.moves)) return null;
    const moves: { id: string; pp: number }[] = [];
    for (const move of entry.moves) {
      if (!isRecord(move) || typeof move.id !== 'string' || typeof move.pp !== 'number') return null;
      moves.push({ id: move.id, pp: move.pp });
    }
    const status = entry.status === 'sap' || entry.status === 'daze' ? entry.status : '';
    mons.push({
      uid: typeof entry.uid === 'number' ? entry.uid : mons.length + 1,
      species: entry.species,
      level: entry.level,
      exp: typeof entry.exp === 'number' ? entry.exp : 0,
      hp: typeof entry.hp === 'number' ? entry.hp : 1,
      status,
      moves,
    });
  }
  return mons;
}

function readAppearance(value: unknown): Appearance {
  if (!isRecord(value)) return defaultAppearance();
  const style = value.style === 'cap' || value.style === 'ribbon' || value.style === 'fluff' ? value.style : 'fluff';
  return {
    style,
    hair: typeof value.hair === 'number' ? value.hair : 0,
    skin: typeof value.skin === 'number' ? value.skin : 0,
    outfit: typeof value.outfit === 'number' ? value.outfit : 0,
  };
}

/** Version 1 shells had no party. They become version 2 with an empty team. */
export function migrateSave(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw.version !== 1) return raw;
  return {
    ...raw,
    version: 2,
    money: 0,
    appearance: defaultAppearance(),
    party: [],
    box: [],
    seen: [],
    caught: [],
    repel: 0,
    nextUid: 1,
    starter: '',
  };
}

export function normalizeSave(input: unknown): LoadResult {
  if (!isRecord(input)) return { ok: false, reason: 'corrupt' };
  let raw: Record<string, unknown> = input;
  if (typeof raw.version !== 'number') return { ok: false, reason: 'corrupt' };
  if (raw.version > SAVE_VERSION || raw.version < 1) return { ok: false, reason: 'version' };
  if (raw.version < SAVE_VERSION) raw = migrateSave(raw);
  if (raw.version !== SAVE_VERSION) return { ok: false, reason: 'version' };
  if (typeof raw.playerName !== 'string' || raw.playerName.length === 0) return { ok: false, reason: 'corrupt' };
  if (typeof raw.playTimeMs !== 'number' || raw.playTimeMs < 0) return { ok: false, reason: 'corrupt' };
  if (typeof raw.mapId !== 'string' || raw.mapId.length === 0) return { ok: false, reason: 'corrupt' };
  if (typeof raw.x !== 'number' || typeof raw.y !== 'number') return { ok: false, reason: 'corrupt' };
  if (!isDir(raw.facing)) return { ok: false, reason: 'corrupt' };
  if (!isRecord(raw.flags)) return { ok: false, reason: 'corrupt' };
  if (typeof raw.locationName !== 'string') return { ok: false, reason: 'corrupt' };
  if (!Array.isArray(raw.inventory)) return { ok: false, reason: 'corrupt' };

  const flags: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(raw.flags)) {
    if (typeof value === 'boolean') flags[key] = value;
  }
  const inventory: InventoryEntry[] = [];
  for (const entry of raw.inventory) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.qty !== 'number') {
      return { ok: false, reason: 'corrupt' };
    }
    if (entry.qty > 0) inventory.push({ id: entry.id, qty: Math.floor(entry.qty) });
  }

  const party = readMons(raw.party);
  const box = readMons(raw.box);
  if (!party || !box) return { ok: false, reason: 'corrupt' };
  const seen = Array.isArray(raw.seen) ? raw.seen.filter((id): id is string => typeof id === 'string') : [];
  const caught = Array.isArray(raw.caught) ? raw.caught.filter((id): id is string => typeof id === 'string') : [];

  return {
    ok: true,
    save: {
      version: SAVE_VERSION,
      playerName: raw.playerName as string,
      playTimeMs: raw.playTimeMs as number,
      mapId: raw.mapId as string,
      x: raw.x as number,
      y: raw.y as number,
      facing: raw.facing,
      flags,
      inventory,
      locationName: raw.locationName as string,
      money: typeof raw.money === 'number' ? raw.money : 0,
      appearance: readAppearance(raw.appearance),
      party,
      box,
      seen,
      caught,
      repel: typeof raw.repel === 'number' ? raw.repel : 0,
      nextUid: typeof raw.nextUid === 'number' ? raw.nextUid : 1,
      starter: typeof raw.starter === 'string' ? raw.starter : '',
    },
  };
}

export function loadSave(storage: Storage, slot: number): LoadResult {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT) return { ok: false, reason: 'empty' };
  const raw = storage.getItem(saveKey(slot));
  if (!raw) return { ok: false, reason: 'empty' };
  try {
    return normalizeSave(JSON.parse(raw));
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
}

export function writeSave(storage: Storage, slot: number, save: SaveGame): void {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT) {
    throw new Error(`Save slot out of range: ${slot}`);
  }
  const payload: SaveGame = { ...save, version: SAVE_VERSION, inventory: save.inventory.map((e) => ({ ...e })) };
  storage.setItem(saveKey(slot), JSON.stringify(payload));
}

export function listSaves(storage: Storage): Array<SaveGame | null> {
  const slots: Array<SaveGame | null> = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const loaded = loadSave(storage, i);
    slots.push(loaded.ok ? loaded.save : null);
  }
  return slots;
}

export interface MemoryStorage extends Storage {
  dump(): Record<string, string>;
}

export function memoryStorage(initial: Record<string, string> = {}): MemoryStorage {
  const map = new Map(Object.entries(initial));
  const storage: MemoryStorage = {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    dump() {
      return Object.fromEntries(map);
    },
  };
  return storage;
}
