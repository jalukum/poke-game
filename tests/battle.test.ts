import { describe, expect, it } from 'vitest';
import { catchOdds, catchShakes, computeDamage, effectiveness, emptyStages, stageMultiplier, type BattleMon, type MoveDef } from '../src/sim/battle';
import types from '../public/data/types.json';

const chart = types.chart as Record<string, Record<string, number>>;

function mon(over: Partial<BattleMon> = {}): BattleMon {
  return {
    species: 'milo',
    name: 'Milo',
    type: 'Gust',
    level: 20,
    hp: 50,
    maxHp: 50,
    stats: { hp: 50, atk: 40, def: 40, spa: 40, spd: 40, spe: 40 },
    stages: emptyStages(),
    moves: [],
    status: '',
    ...over,
  };
}

const strike: MoveDef = { name: 'Herd Rush', type: 'Gust', category: 'strike', power: 80, accuracy: 100, pp: 10 };

describe('battle math', () => {
  it('reads the type chart', () => {
    expect(effectiveness(chart, 'Sun', 'Leaf')).toBe(2);
    expect(effectiveness(chart, 'Tide', 'Sun')).toBe(2);
    expect(effectiveness(chart, 'Leaf', 'Sun')).toBe(0.5);
  });

  it('deals more damage with higher attack and with STAB', () => {
    const rng = () => 0.5;
    const weak = computeDamage({ attacker: mon(), defender: mon({ type: 'Stone' }), move: strike, chart, rng });
    const strong = computeDamage({
      attacker: mon({ stats: { hp: 50, atk: 80, def: 40, spa: 40, spd: 40, spe: 40 } }),
      defender: mon({ type: 'Stone' }),
      move: strike,
      chart,
      rng,
    });
    const stab = computeDamage({ attacker: mon(), defender: mon({ type: 'Stone' }), move: strike, chart, rng });
    const off = computeDamage({
      attacker: mon({ type: 'Stone' }),
      defender: mon({ type: 'Stone' }),
      move: strike,
      chart,
      rng,
    });
    expect(strong.damage).toBeGreaterThan(weak.damage);
    expect(stab.damage).toBeGreaterThan(off.damage);
    expect(stab.text.join(' ')).toMatch(/super effective|not very effective|critical|used/i);
  });

  it('can miss and can crit', () => {
    const miss = computeDamage({
      attacker: mon(),
      defender: mon(),
      move: { ...strike, accuracy: 50 },
      chart,
      rng: () => 0.99,
    });
    expect(miss.miss).toBe(true);
    expect(miss.damage).toBe(0);
    let rolls = 0;
    const crit = computeDamage({
      attacker: mon(),
      defender: mon({ type: 'Stone' }),
      move: strike,
      chart,
      rng: () => {
        rolls += 1;
        return rolls === 1 ? 0.01 : 0.5;
      },
    });
    expect(crit.crit).toBe(true);
  });

  it('raises a stage and then the multiplier', () => {
    expect(stageMultiplier(0)).toBe(1);
    expect(stageMultiplier(1)).toBeGreaterThan(1);
    expect(stageMultiplier(-1)).toBeLessThan(1);
  });
});

describe('catching', () => {
  it('is easier at low HP and with a stronger ball', () => {
    const full = catchOdds(100, 100, 120, 1);
    const hurt = catchOdds(100, 10, 120, 1);
    const better = catchOdds(100, 10, 120, 2);
    expect(hurt).toBeGreaterThan(full);
    expect(better).toBeGreaterThan(hurt);
  });

  it('four shakes means a catch and a failed roll stops early', () => {
    expect(catchShakes(0.95, () => 0)).toBe(4);
    expect(catchShakes(0.2, () => 0.99)).toBe(0);
    const shakes = catchShakes(0.5, () => 0.2);
    expect(shakes).toBeGreaterThanOrEqual(0);
    expect(shakes).toBeLessThanOrEqual(4);
  });
});
