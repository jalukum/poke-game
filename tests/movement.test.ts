import { describe, expect, it } from 'vitest';
import {
  BUMP_TIME,
  TILE_SIZE,
  TURN_DELAY,
  bumpPixels,
  createActor,
  spriteOffset,
  stepActor,
  type CellKind,
  type MoveInput,
} from '../src/sim/movement';

const free = (): CellKind => 'free';
const hold = (dir: MoveInput['dir'], run = false): MoveInput => ({ dir, run });

function frames(state: ReturnType<typeof createActor>, n: number, input: MoveInput, cell: (x: number, y: number) => CellKind = free) {
  let bumped = 0;
  let exited = 0;
  let arrivals = 0;
  for (let i = 0; i < n; i++) {
    const step = stepActor(state, input, cell);
    state = step.state;
    if (step.bumped) bumped += 1;
    if (step.exited) exited += 1;
    if (step.arrived) arrivals += 1;
  }
  return { state, bumped, exited, arrivals };
}

describe('grid movement', () => {
  it('turns in place on a tap and does not leave the tile', () => {
    let state = createActor(4, 4, 'down');
    const tap = stepActor(state, hold('left'), free);
    state = tap.state;
    expect(state.facing).toBe('left');
    expect(state.moving).toBe(false);
    expect(state.x).toBe(4);
    expect(state.y).toBe(4);

    const after = frames(state, 12, hold(null));
    expect(after.state.x).toBe(4);
    expect(after.state.y).toBe(4);
    expect(after.state.facing).toBe('left');
    expect(after.state.moving).toBe(false);
    expect(after.arrivals).toBe(0);
  });

  it('waits through the turn delay before walking the new direction', () => {
    let state = createActor(4, 4, 'down');
    const waiting = frames(state, TURN_DELAY, hold('left'));
    expect(waiting.state.facing).toBe('left');
    expect(waiting.state.moving).toBe(false);
    expect(waiting.state.x).toBe(4);

    const started = stepActor(waiting.state, hold('left'), free);
    expect(started.state.moving).toBe(true);
    expect(started.state.progress).toBe(1);
    expect(started.state.x).toBe(4);
  });

  it('walks exactly one tile in 16 frames when already facing that way', () => {
    let state = createActor(2, 2, 'down');
    const walked = frames(state, TILE_SIZE, hold('down'));
    expect(walked.arrivals).toBe(1);
    expect(walked.state.x).toBe(2);
    expect(walked.state.y).toBe(3);
    expect(walked.state.progress).toBe(0);
    expect(walked.state.moving).toBe(false);
    expect(spriteOffset(walked.state)).toEqual({ x: 0, y: 0 });
  });

  it('stays aligned to the grid after several tiles', () => {
    let state = createActor(1, 1, 'right');
    const walked = frames(state, TILE_SIZE * 5, hold('right'));
    expect(walked.state.x).toBe(6);
    expect(walked.state.y).toBe(1);
    expect(walked.state.progress).toBe(0);
    expect(walked.arrivals).toBe(5);
  });

  it('runs a tile in 8 frames, twice walk speed', () => {
    let state = createActor(3, 3, 'up');
    const ran = frames(state, 8, hold('up', true));
    expect(ran.arrivals).toBe(1);
    expect(ran.state.y).toBe(2);
    expect(ran.state.x).toBe(3);
    expect(ran.state.moving).toBe(false);

    const three = frames(createActor(0, 10, 'left'), 8 * 3, hold('left', true));
    expect(three.state.x).toBe(-3);
    expect(three.state.progress).toBe(0);
  });

  it('does not change speed in the middle of a tile', () => {
    let state = createActor(0, 0, 'right');
    const first = stepActor(state, hold('right', false), free);
    state = first.state;
    expect(state.running).toBe(false);
    expect(state.progress).toBe(1);
    const mid = frames(state, 5, hold('right', true));
    expect(mid.state.running).toBe(false);
    expect(mid.state.progress).toBe(6);
    expect(mid.state.x).toBe(0);
  });

  it('bumps and stays put when the destination is blocked', () => {
    const wall = (x: number): CellKind => (x >= 3 ? 'blocked' : 'free');
    let state = createActor(2, 1, 'right');
    const hit = frames(state, BUMP_TIME + 4, hold('right'), wall);
    expect(hit.state.x).toBe(2);
    expect(hit.state.y).toBe(1);
    expect(hit.bumped).toBeGreaterThanOrEqual(1);
    expect(hit.arrivals).toBe(0);
    expect(hit.state.moving).toBe(false);
  });

  it('reports an exit without moving off the map', () => {
    const edge = (x: number): CellKind => (x > 4 ? 'exit' : 'free');
    const state = createActor(4, 2, 'right');
    const step = stepActor(state, hold('right'), edge);
    expect(step.exited).toBe(true);
    expect(step.bumped).toBe(false);
    expect(step.state.x).toBe(4);
    expect(step.state.moving).toBe(false);
    expect(step.state.facing).toBe('right');
  });

  it('lunge of a bump returns to the tile', () => {
    expect(bumpPixels(0)).toBe(0);
    expect(bumpPixels(BUMP_TIME)).toBe(0);
    expect(bumpPixels(BUMP_TIME / 2)).toBeGreaterThan(0);
    const actor = createActor(0, 0, 'down');
    actor.bumpTimer = BUMP_TIME / 2;
    expect(spriteOffset(actor).y).toBeGreaterThan(0);
    expect(spriteOffset(actor).x).toBe(0);
  });
});
