export type Dir = 'up' | 'down' | 'left' | 'right';

export const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];

export const DX: Record<Dir, number> = { up: 0, down: 0, left: -1, right: 1 };
export const DY: Record<Dir, number> = { up: -1, down: 1, left: 0, right: 0 };

export function isDir(value: unknown): value is Dir {
  return value === 'up' || value === 'down' || value === 'left' || value === 'right';
}

export function opposite(dir: Dir): Dir {
  switch (dir) {
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}

export interface Warp {
  x: number;
  y: number;
  map: string;
  tx: number;
  ty: number;
  facing: Dir;
}

export interface Connection {
  side: Dir;
  map: string;
  offset: number;
}

export interface Gate {
  x: number;
  y: number;
  w: number;
  h: number;
  flag: string;
  /** Row-major tile GIDs, length w*h. */
  tiles: number[];
}

export interface Sign {
  x: number;
  y: number;
  dialogue: string;
}

export interface ItemSpot {
  x: number;
  y: number;
  itemId: string;
  flag: string;
}

export interface RuntimeMap {
  id: string;
  name: string;
  showName: boolean;
  interior: boolean;
  width: number;
  height: number;
  ground: Uint16Array;
  objects: Uint16Array;
  fringe: Uint16Array;
  overhead: Uint16Array;
  solid: Uint8Array;
  encounter: Uint8Array;
  warps: Warp[];
  connections: Connection[];
  gates: Gate[];
  signs: Sign[];
  items: ItemSpot[];
}

export interface MoveContext {
  flags: Record<string, boolean>;
  /** Extra solid tiles (NPCs). */
  occupants: { x: number; y: number }[];
  maps: Record<string, RuntimeMap>;
}
