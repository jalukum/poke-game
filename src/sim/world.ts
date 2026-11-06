import { stepActor, type ActorState, type MoveInput } from './movement';
import { DX, DY, type Connection, type Dir, type MoveContext, type RuntimeMap, type Warp } from './types';

export type WorldEvent =
  | { type: 'bump' }
  | { type: 'step' }
  | { type: 'encounter'; x: number; y: number }
  | { type: 'warp'; warp: Warp }
  | { type: 'connection'; mapId: string; x: number; y: number; facing: Dir };

export function inBounds(map: RuntimeMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function idx(map: RuntimeMap, x: number, y: number): number {
  return y * map.width + x;
}

export function isBlocked(map: RuntimeMap, x: number, y: number, ctx: MoveContext): boolean {
  if (!inBounds(map, x, y)) return true;
  if (map.solid[idx(map, x, y)]) return true;
  for (const gate of map.gates) {
    if (x >= gate.x && y >= gate.y && x < gate.x + gate.w && y < gate.y + gate.h) {
      if (!ctx.flags[gate.flag]) return true;
    }
  }
  for (const sign of map.signs) {
    if (sign.x === x && sign.y === y) return true;
  }
  for (const item of map.items) {
    if (item.x === x && item.y === y && !ctx.flags[item.flag]) return true;
  }
  for (const occ of ctx.occupants) {
    if (occ.x === x && occ.y === y) return true;
  }
  return false;
}

function sideOf(map: RuntimeMap, x: number, y: number): Dir | null {
  if (y < 0) return 'up';
  if (y >= map.height) return 'down';
  if (x < 0) return 'left';
  if (x >= map.width) return 'right';
  return null;
}

export function probeCell(map: RuntimeMap, x: number, y: number, ctx: MoveContext): 'free' | 'blocked' | 'exit' {
  const side = sideOf(map, x, y);
  if (side) {
    return map.connections.some((c) => c.side === side) ? 'exit' : 'blocked';
  }
  return isBlocked(map, x, y, ctx) ? 'blocked' : 'free';
}

export function connectionOn(map: RuntimeMap, side: Dir): Connection | undefined {
  return map.connections.find((c) => c.side === side);
}

export function arrivalFor(
  map: RuntimeMap,
  from: { x: number; y: number },
  dir: Dir,
  maps: Record<string, RuntimeMap>,
): { mapId: string; x: number; y: number; facing: Dir } | null {
  const conn = connectionOn(map, dir);
  if (!conn) return null;
  const dest = maps[conn.map];
  if (!dest) return null;
  let x = from.x;
  let y = from.y;
  if (dir === 'up') {
    y = dest.height - 1;
    x = from.x + conn.offset;
  } else if (dir === 'down') {
    y = 0;
    x = from.x + conn.offset;
  } else if (dir === 'left') {
    x = dest.width - 1;
    y = from.y + conn.offset;
  } else {
    x = 0;
    y = from.y + conn.offset;
  }
  x = Math.max(0, Math.min(dest.width - 1, x));
  y = Math.max(0, Math.min(dest.height - 1, y));
  return { mapId: dest.id, x, y, facing: dir };
}

export function warpAt(map: RuntimeMap, x: number, y: number): Warp | undefined {
  return map.warps.find((w) => w.x === x && w.y === y);
}

export function isEncounterTile(map: RuntimeMap, x: number, y: number): boolean {
  if (!inBounds(map, x, y)) return false;
  return map.encounter[idx(map, x, y)] === 1;
}

export function updatePlayer(actor: ActorState, input: MoveInput, map: RuntimeMap, ctx: MoveContext): { actor: ActorState; events: WorldEvent[] } {
  const step = stepActor(actor, input, (x, y) => probeCell(map, x, y, ctx));
  const events: WorldEvent[] = [];
  if (step.bumped) events.push({ type: 'bump' });
  if (step.exited && input.dir) {
    const dest = arrivalFor(map, step.state, input.dir, ctx.maps);
    if (dest) events.push({ type: 'connection', ...dest });
  }
  if (step.arrived) {
    events.push({ type: 'step' });
    const warp = warpAt(map, step.arrived.x, step.arrived.y);
    if (warp) events.push({ type: 'warp', warp });
    else if (isEncounterTile(map, step.arrived.x, step.arrived.y)) {
      events.push({ type: 'encounter', x: step.arrived.x, y: step.arrived.y });
    }
  }
  return { actor: step.state, events };
}

export function blankMap(partial: Partial<RuntimeMap> & Pick<RuntimeMap, 'id' | 'width' | 'height'>): RuntimeMap {
  const n = partial.width * partial.height;
  return {
    name: partial.name ?? partial.id,
    showName: partial.showName ?? true,
    interior: partial.interior ?? false,
    ground: partial.ground ?? new Uint16Array(n),
    objects: partial.objects ?? new Uint16Array(n),
    fringe: partial.fringe ?? new Uint16Array(n),
    overhead: partial.overhead ?? new Uint16Array(n),
    solid: partial.solid ?? new Uint8Array(n),
    encounter: partial.encounter ?? new Uint8Array(n),
    warps: partial.warps ?? [],
    connections: partial.connections ?? [],
    gates: partial.gates ?? [],
    signs: partial.signs ?? [],
    items: partial.items ?? [],
    ...partial,
  };
}

export function stepDir(dir: Dir): { x: number; y: number } {
  return { x: DX[dir], y: DY[dir] };
}
