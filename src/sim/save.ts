import type { Dir } from './types';
import { isDir } from './types';

/** Bump this when the stored shape changes, and teach `normalizeSave` how to migrate. */
export const SAVE_VERSION = 1;

export const SLOT_COUNT = 3;

export interface InventoryEntry {
  id: string;
  qty: number;
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

export function normalizeSave(raw: unknown): LoadResult {
  if (!isRecord(raw)) return { ok: false, reason: 'corrupt' };
  if (typeof raw.version !== 'number') return { ok: false, reason: 'corrupt' };
  if (raw.version > SAVE_VERSION || raw.version < 1) return { ok: false, reason: 'version' };
  if (raw.version !== SAVE_VERSION) {
    // Older saves would be migrated here. None exist yet.
    return { ok: false, reason: 'version' };
  }
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

  return {
    ok: true,
    save: {
      version: SAVE_VERSION,
      playerName: raw.playerName,
      playTimeMs: raw.playTimeMs,
      mapId: raw.mapId,
      x: raw.x,
      y: raw.y,
      facing: raw.facing,
      flags,
      inventory,
      locationName: raw.locationName,
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
