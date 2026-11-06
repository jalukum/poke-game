import { describe, expect, it } from 'vitest';
import { TILE_SIZE, createActor } from '../src/sim/movement';
import type { MoveContext, RuntimeMap } from '../src/sim/types';
import { blankMap, isBlocked, updatePlayer } from '../src/sim/world';

function solidBox(width: number, height: number, blocked: Array<[number, number]>): Uint8Array {
  const solid = new Uint8Array(width * height);
  for (const [x, y] of blocked) solid[y * width + x] = 1;
  return solid;
}

function ctx(flags: Record<string, boolean> = {}, occupants: { x: number; y: number }[] = [], maps: Record<string, RuntimeMap> = {}): MoveContext {
  return { flags, occupants, maps };
}

describe('collision, gates, warps, and connections', () => {
  it('blocks solid tiles, signs, items, and npcs', () => {
    const map = blankMap({
      id: 'room',
      width: 5,
      height: 5,
      solid: solidBox(5, 5, [[1, 1]]),
      signs: [{ x: 2, y: 1, dialogue: 'hi' }],
      items: [{ x: 3, y: 1, itemId: 'potion', flag: 'got_potion' }],
    });
    const open = ctx({}, [{ x: 4, y: 1 }]);
    expect(isBlocked(map, 0, 1, open)).toBe(false);
    expect(isBlocked(map, 1, 1, open)).toBe(true);
    expect(isBlocked(map, 2, 1, open)).toBe(true);
    expect(isBlocked(map, 3, 1, open)).toBe(true);
    expect(isBlocked(map, 4, 1, open)).toBe(true);
    expect(isBlocked(map, 3, 1, ctx({ got_potion: true }))).toBe(false);
    expect(isBlocked(map, -1, 0, open)).toBe(true);
  });

  it('keeps a closed gate shut and opens it with the flag', () => {
    const map = blankMap({
      id: 'town',
      width: 6,
      height: 4,
      gates: [{ x: 2, y: 1, w: 2, h: 1, flag: 'dungeon1_cleared', tiles: [1, 2] }],
    });
    const actor = createActor(2, 2, 'up');
    const closed = updatePlayer(actor, { dir: 'up', run: false }, map, ctx());
    let state = closed.actor;
    for (let i = 0; i < TILE_SIZE + 4; i++) {
      const step = updatePlayer(state, { dir: 'up', run: false }, map, ctx());
      state = step.actor;
    }
    expect(state.y).toBe(2);
    expect(state.x).toBe(2);

    let open = createActor(2, 2, 'up');
    const flags = { dungeon1_cleared: true };
    for (let i = 0; i < TILE_SIZE; i++) {
      open = updatePlayer(open, { dir: 'up', run: false }, map, ctx(flags)).actor;
    }
    expect(open.x).toBe(2);
    expect(open.y).toBe(1);
  });

  it('warps when a step finishes on a warp tile', () => {
    const map = blankMap({
      id: 'town',
      width: 4,
      height: 4,
      warps: [{ x: 1, y: 0, map: 'player_house', tx: 7, ty: 8, facing: 'up' }],
    });
    let actor = createActor(1, 1, 'up');
    let sawWarp = false;
    for (let i = 0; i < TILE_SIZE; i++) {
      const step = updatePlayer(actor, { dir: 'up', run: false }, map, ctx());
      actor = step.actor;
      if (step.events.some((e) => e.type === 'warp')) sawWarp = true;
    }
    expect(sawWarp).toBe(true);
    expect(actor.x).toBe(1);
    expect(actor.y).toBe(0);
  });

  it('fires an encounter event on tall grass and nowhere else', () => {
    const encounter = new Uint8Array(9);
    encounter[1] = 1;
    const map = blankMap({ id: 'route', width: 3, height: 3, encounter });
    let actor = createActor(0, 0, 'right');
    let kinds: string[] = [];
    for (let i = 0; i < TILE_SIZE; i++) {
      const step = updatePlayer(actor, { dir: 'right', run: false }, map, ctx());
      actor = step.actor;
      kinds = kinds.concat(step.events.map((e) => e.type));
    }
    expect(actor).toMatchObject({ x: 1, y: 0 });
    expect(kinds).toContain('encounter');
  });

  it('links map edges with offset and keeps the player on the source tile until the game swaps maps', () => {
    const town = blankMap({
      id: 'town',
      width: 8,
      height: 6,
      connections: [{ side: 'up', map: 'route_snow', offset: 2 }],
    });
    const snow = blankMap({ id: 'route_snow', width: 8, height: 6 });
    const maps = { town, route_snow: snow };
    const actor = createActor(3, 0, 'up');
    const step = updatePlayer(actor, { dir: 'up', run: false }, town, ctx({}, [], maps));
    expect(step.actor.x).toBe(3);
    expect(step.actor.y).toBe(0);
    expect(step.actor.moving).toBe(false);
    const link = step.events.find((e) => e.type === 'connection');
    expect(link).toEqual({ type: 'connection', mapId: 'route_snow', x: 5, y: 5, facing: 'up' });
  });

  it('bumps on a blocked edge that has no connection', () => {
    const map = blankMap({ id: 'room', width: 3, height: 3 });
    const actor = createActor(1, 0, 'up');
    const step = updatePlayer(actor, { dir: 'up', run: false }, map, ctx());
    expect(step.events.map((e) => e.type)).toContain('bump');
    expect(step.actor.y).toBe(0);
  });
});
