import { describe, expect, it } from 'vitest';
import {
  SAVE_VERSION,
  formatPlayTime,
  listSaves,
  loadSave,
  memoryStorage,
  normalizeSave,
  writeSave,
  type SaveGame,
} from '../src/sim/save';

function sample(over: Partial<SaveGame> = {}): SaveGame {
  return {
    version: SAVE_VERSION,
    playerName: 'HERO',
    playTimeMs: 125000,
    mapId: 'town',
    x: 20,
    y: 17,
    facing: 'down',
    flags: { running_shoes: true, dungeon1_cleared: false },
    inventory: [{ id: 'potion', qty: 1 }],
    locationName: 'WILLOW TOWN',
    money: 0,
    appearance: { style: 'fluff', hair: 0, skin: 0, outfit: 0 },
    party: [],
    box: [],
    seen: [],
    caught: [],
    repel: 0,
    nextUid: 1,
    starter: '',
    ...over,
  };
}

describe('save slots', () => {
  it('round-trips a versioned save and restores position', () => {
    const storage = memoryStorage();
    const save = sample();
    writeSave(storage, 1, save);
    const loaded = loadSave(storage, 1);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.save).toEqual(save);
    expect(loaded.save.version).toBe(SAVE_VERSION);
    expect(loaded.save.mapId).toBe('town');
    expect(loaded.save.x).toBe(20);
    expect(loaded.save.y).toBe(17);
    expect(loaded.save.facing).toBe('down');
  });

  it('keeps three slots independent', () => {
    const storage = memoryStorage();
    writeSave(storage, 0, sample({ playerName: 'ADA', x: 1 }));
    writeSave(storage, 2, sample({ playerName: 'BO', x: 9, mapId: 'route_forest' }));
    const slots = listSaves(storage);
    expect(slots[0]?.playerName).toBe('ADA');
    expect(slots[0]?.x).toBe(1);
    expect(slots[1]).toBeNull();
    expect(slots[2]?.mapId).toBe('route_forest');
    expect(slots[2]?.playerName).toBe('BO');
  });

  it('migrates a version 1 shell into a version 2 save', () => {
    const legacy = {
      version: 1,
      playerName: 'ADA',
      playTimeMs: 10,
      mapId: 'town',
      x: 3,
      y: 4,
      facing: 'up',
      flags: { running_shoes: true },
      inventory: [],
      locationName: 'WILLOW TOWN',
    };
    const loaded = normalizeSave(legacy);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.save.version).toBe(SAVE_VERSION);
    expect(loaded.save.playerName).toBe('ADA');
    expect(loaded.save.party).toEqual([]);
    expect(loaded.save.x).toBe(3);
  });

  it('rejects corrupt data, future versions, and empty slots', () => {
    const storage = memoryStorage();
    expect(loadSave(storage, 0)).toEqual({ ok: false, reason: 'empty' });
    storage.setItem('pokegame.save.slot.0', '{');
    expect(loadSave(storage, 0)).toEqual({ ok: false, reason: 'corrupt' });
    storage.setItem('pokegame.save.slot.0', JSON.stringify(sample({ version: 99 })));
    expect(loadSave(storage, 0)).toEqual({ ok: false, reason: 'version' });
    expect(normalizeSave(sample({ version: 0 }))).toEqual({ ok: false, reason: 'version' });
    expect(normalizeSave({ version: SAVE_VERSION })).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('refuses slots outside 0..2', () => {
    const storage = memoryStorage();
    expect(loadSave(storage, 3)).toEqual({ ok: false, reason: 'empty' });
    expect(() => writeSave(storage, -1, sample())).toThrow(/slot/i);
  });

  it('formats play time as hours and minutes', () => {
    expect(formatPlayTime(0)).toBe('0:00');
    expect(formatPlayTime(59_000)).toBe('0:00');
    expect(formatPlayTime(125_000)).toBe('0:02');
    expect(formatPlayTime(3_720_000)).toBe('1:02');
  });
});
