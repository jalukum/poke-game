import { describe, expect, it } from 'vitest';
import { evolutionTarget, expForLevel, grantExp, levelFromExp, makeMon, type SpeciesDef } from '../src/sim/growth';
import creatures from '../public/data/creatures.json';

const roster = creatures as unknown as Record<string, SpeciesDef>;
const izzy = roster.isabelle_1_base;

describe('growth and evolution', () => {
  it('evolves Izzy at 16 and Bellisse at 32', () => {
    expect(evolutionTarget(izzy, 15)).toBeNull();
    expect(evolutionTarget(izzy, 16)).toBe('isabelle_2_evo1');
    const bell = roster.isabelle_2_evo1;
    expect(evolutionTarget(bell, 31)).toBeNull();
    expect(evolutionTarget(bell, 32)).toBe('isabelle_3_evo2');
    const done = roster.isabelle_3_evo2;
    expect(evolutionTarget(done, 50)).toBeNull();
  });

  it('levels from the exp curve and builds a fresh Jakamon', () => {
    expect(levelFromExp(0)).toBe(1);
    expect(levelFromExp(expForLevel(16))).toBe(16);
    const gained = grantExp({ uid: 1, species: 'milo', level: 5, exp: expForLevel(5), hp: 20, status: '', moves: [] }, 500);
    expect(gained.levels).toBeGreaterThan(0);
    expect(gained.mon.level).toBeGreaterThan(5);
    const mon = makeMon('isabelle_1_base', izzy, 5, 3, () => 20);
    expect(mon.moves.length).toBeGreaterThanOrEqual(2);
    expect(mon.hp).toBeGreaterThan(10);
    expect(mon.species).toBe('isabelle_1_base');
  });
});
