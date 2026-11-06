import { DX, DY, type Dir } from './types';

/** Pixels per tile. One overworld step is exactly this many pixels. */
export const TILE_SIZE = 16;
/** Frames a fresh direction press spends turning before the first step. */
export const TURN_DELAY = 6;
export const WALK_SPEED = 1;
export const RUN_SPEED = 2;
export const BUMP_TIME = 12;

export type CellKind = 'free' | 'blocked' | 'exit';

export type Pose = 'stand' | 'walk1' | 'walk2' | 'run1' | 'run2' | 'run3';

export interface ActorState {
  x: number;
  y: number;
  facing: Dir;
  moving: boolean;
  moveDir: Dir;
  /** Pixels already moved toward moveDir this step (0–15). */
  progress: number;
  running: boolean;
  /** Frames left before a turn becomes a step. */
  turnTimer: number;
  /** Frames left in a wall bump. Counts down to 0. */
  bumpTimer: number;
}

export interface MoveInput {
  dir: Dir | null;
  run: boolean;
}

export interface StepResult {
  state: ActorState;
  bumped: boolean;
  exited: boolean;
  arrived: { x: number; y: number } | null;
}

export function createActor(x: number, y: number, facing: Dir): ActorState {
  return {
    x,
    y,
    facing,
    moving: false,
    moveDir: facing,
    progress: 0,
    running: false,
    turnTimer: 0,
    bumpTimer: 0,
  };
}

/**
 * Advance one 60fps frame of grid movement.
 *
 * A tap on a new direction only turns. Holding past TURN_DELAY walks.
 * Walking takes 16 frames per tile; running takes 8. Speed is chosen
 * when the step starts and does not change mid-tile.
 */
export function stepActor(state: ActorState, input: MoveInput, cellAt: (x: number, y: number) => CellKind): StepResult {
  const s: ActorState = { ...state };
  let bumped = false;
  let exited = false;
  let arrived: { x: number; y: number } | null = null;

  if (s.bumpTimer > 0) {
    s.bumpTimer -= 1;
    return { state: s, bumped, exited, arrived };
  }

  if (!s.moving) {
    if (!input.dir) {
      s.turnTimer = 0;
      return { state: s, bumped, exited, arrived };
    }
    if (input.dir !== s.facing) {
      s.facing = input.dir;
      s.moveDir = input.dir;
      s.turnTimer = TURN_DELAY;
      return { state: s, bumped, exited, arrived };
    }
    if (s.turnTimer > 0) {
      s.turnTimer -= 1;
      if (s.turnTimer > 0) return { state: s, bumped, exited, arrived };
    }
    const started = beginStep(s, input.dir, input.run, cellAt);
    bumped = started === 'bump';
    exited = started === 'exit';
    if (!s.moving) return { state: s, bumped, exited, arrived };
  }

  const speed = s.running ? RUN_SPEED : WALK_SPEED;
  s.progress += speed;
  if (s.progress >= TILE_SIZE) {
    s.x += DX[s.moveDir];
    s.y += DY[s.moveDir];
    s.progress = 0;
    s.moving = false;
    s.running = false;
    arrived = { x: s.x, y: s.y };
  }
  return { state: s, bumped, exited, arrived };
}

function beginStep(
  s: ActorState,
  dir: Dir,
  run: boolean,
  cellAt: (x: number, y: number) => CellKind,
): 'move' | 'bump' | 'exit' {
  s.facing = dir;
  s.moveDir = dir;
  const nx = s.x + DX[dir];
  const ny = s.y + DY[dir];
  const cell = cellAt(nx, ny);
  if (cell === 'exit') return 'exit';
  if (cell === 'blocked') {
    s.bumpTimer = BUMP_TIME;
    s.moving = false;
    s.progress = 0;
    s.running = false;
    return 'bump';
  }
  s.moving = true;
  s.running = run;
  s.progress = 0;
  return 'move';
}

/** Pixel offset from the actor's tile origin. */
export function spriteOffset(actor: ActorState): { x: number; y: number } {
  if (actor.moving) {
    return { x: DX[actor.moveDir] * actor.progress, y: DY[actor.moveDir] * actor.progress };
  }
  const mag = bumpPixels(actor.bumpTimer);
  return { x: DX[actor.facing] * mag, y: DY[actor.facing] * mag };
}

export function bumpPixels(timer: number): number {
  if (timer <= 0) return 0;
  const elapsed = BUMP_TIME - timer;
  const peak = 3;
  const half = BUMP_TIME / 2;
  if (elapsed <= half) return Math.round((elapsed / half) * peak);
  return Math.round(((BUMP_TIME - elapsed) / half) * peak);
}

const WALK_POSES: Pose[] = ['walk1', 'stand', 'walk2', 'stand'];
const RUN_POSES: Pose[] = ['run1', 'run2', 'run3', 'run2'];

export function movementPose(actor: ActorState): { pose: Pose; bob: number } {
  if (!actor.moving) return { pose: 'stand', bob: 0 };
  const phase = Math.min(3, Math.floor(((actor.progress - 1) / TILE_SIZE) * 4));
  const pose = (actor.running ? RUN_POSES : WALK_POSES)[phase] ?? 'stand';
  const bob = pose === 'stand' ? 0 : -1;
  return { pose, bob };
}

export function tileInFront(actor: Pick<ActorState, 'x' | 'y' | 'facing'>): { x: number; y: number } {
  return { x: actor.x + DX[actor.facing], y: actor.y + DY[actor.facing] };
}
