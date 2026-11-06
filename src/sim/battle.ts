export type TypeName = 'Sun' | 'Leaf' | 'Tide' | 'Stone' | 'Gust' | 'Spark' | 'Shade' | 'Bloom';
export type Category = 'strike' | 'wave';
export type StatusName = '' | 'sap' | 'daze';

export interface MoveDef {
  name: string;
  type: TypeName;
  category: Category;
  power: number;
  accuracy: number;
  pp: number;
  effect?: 'heal' | 'atk+' | 'def+' | 'spe+' | 'sap' | 'daze';
}

export interface StatBlock {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface Stages {
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface BattleMon {
  species: string;
  name: string;
  type: TypeName;
  level: number;
  hp: number;
  maxHp: number;
  stats: StatBlock;
  stages: Stages;
  moves: { id: string; pp: number }[];
  status: StatusName;
}

export interface DamageResult {
  miss: boolean;
  damage: number;
  effectiveness: number;
  crit: boolean;
  text: string[];
}

export function stageMultiplier(stage: number): number {
  const clamped = Math.max(-2, Math.min(2, stage));
  if (clamped >= 0) return (2 + clamped) / 2;
  return 2 / (2 - clamped);
}

export function effectiveness(chart: Record<string, Record<string, number>>, moveType: string, defendType: string): number {
  return chart[moveType]?.[defendType] ?? 1;
}

export interface DamageInput {
  attacker: BattleMon;
  defender: BattleMon;
  move: MoveDef;
  chart: Record<string, Record<string, number>>;
  rng: () => number;
}

/** Gen-3-shaped damage: level, power, attack/defense, STAB, type, crit, and a small roll. */
export function computeDamage(input: DamageInput): DamageResult {
  const { attacker, defender, move, chart, rng } = input;
  const text: string[] = [`${attacker.name} used ${move.name}!`];
  if (move.accuracy < 100 && rng() * 100 >= move.accuracy) {
    text.push('It missed!');
    return { miss: true, damage: 0, effectiveness: 1, crit: false, text };
  }
  if (move.power <= 0) {
    return { miss: false, damage: 0, effectiveness: 1, crit: false, text };
  }
  const crit = rng() < 1 / 16;
  const atkStage = move.category === 'strike' ? attacker.stages.atk : attacker.stages.spa;
  const defStage = move.category === 'strike' ? defender.stages.def : defender.stages.spd;
  const attack = (move.category === 'strike' ? attacker.stats.atk : attacker.stats.spa) * stageMultiplier(atkStage);
  const defense = (move.category === 'strike' ? defender.stats.def : defender.stats.spd) * stageMultiplier(defStage);
  const stab = move.type === attacker.type ? 1.5 : 1;
  const effect = effectiveness(chart, move.type, defender.type);
  const roll = 0.85 + rng() * 0.15;
  const base = Math.floor((((2 * attacker.level) / 5 + 2) * move.power * attack) / Math.max(1, defense) / 50) + 2;
  const damage = effect === 0 ? 0 : Math.max(1, Math.floor(base * stab * effect * (crit ? 1.5 : 1) * roll));
  if (crit) text.push('A critical hit!');
  if (effect === 0) text.push("It doesn't affect the foe.");
  else if (effect > 1) text.push("It's super effective!");
  else if (effect < 1) text.push("It's not very effective.");
  return { miss: false, damage, effectiveness: effect, crit, text };
}

export function applyStages(stages: Stages, effect: MoveDef['effect']): Stages {
  const next = { ...stages };
  if (effect === 'atk+') next.atk = Math.min(2, next.atk + 1);
  if (effect === 'def+') next.def = Math.min(2, next.def + 1);
  if (effect === 'spe+') next.spe = Math.min(2, next.spe + 1);
  return next;
}

export function emptyStages(): Stages {
  return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

/** Chance a single throw sticks, before the four shake checks. 0..1. */
export function catchOdds(maxHp: number, hp: number, catchRate: number, ballPower: number): number {
  const safeHp = Math.max(1, hp);
  const a = ((3 * maxHp - 2 * safeHp) * catchRate * ballPower) / (3 * maxHp);
  return Math.max(0.02, Math.min(0.95, a / 200));
}

/** Returns 0-3 for a break, or 4 when the Jakamon is caught. */
export function catchShakes(odds: number, rng: () => number): number {
  const per = Math.pow(Math.min(0.99, Math.max(0.01, odds)), 0.25);
  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    if (rng() < per) shakes += 1;
    else break;
  }
  return shakes;
}

export function runChance(playerSpe: number, foeSpe: number, rng: () => number): boolean {
  const bonus = playerSpe >= foeSpe ? 0.25 : -0.1;
  return rng() < Math.max(0.2, Math.min(0.95, 0.5 + bonus));
}
