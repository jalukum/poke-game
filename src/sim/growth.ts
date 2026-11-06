import type { StatBlock, StatusName } from './battle';

export interface SpeciesDef {
  name: string;
  folder: string;
  type: string;
  catchRate: number;
  baseExp: number;
  dex: string;
  legendary?: boolean;
  evolvesTo?: string;
  evolveLevel?: number;
  base: StatBlock;
  learn: [number, string][];
}

export interface MonInst {
  uid: number;
  species: string;
  level: number;
  exp: number;
  hp: number;
  status: StatusName;
  moves: { id: string; pp: number }[];
}

export function expForLevel(level: number): number {
  if (level <= 1) return 0;
  return (level - 1) * (level - 1) * 10;
}

export function levelFromExp(exp: number): number {
  let level = 1;
  while (level < 100 && expForLevel(level + 1) <= exp) level += 1;
  return level;
}

export function statAt(base: number, level: number, hp = false): number {
  if (hp) return Math.floor((2 * base * level) / 100) + level + 10;
  return Math.floor((2 * base * level) / 100) + 5;
}

export function statsFor(species: SpeciesDef, level: number): StatBlock {
  return {
    hp: statAt(species.base.hp, level, true),
    atk: statAt(species.base.atk, level),
    def: statAt(species.base.def, level),
    spa: statAt(species.base.spa, level),
    spd: statAt(species.base.spd, level),
    spe: statAt(species.base.spe, level),
  };
}

export function movesAt(species: SpeciesDef, level: number): string[] {
  const known = species.learn.filter(([lv]) => lv <= level).map(([, id]) => id);
  const unique: string[] = [];
  for (const id of known) if (!unique.includes(id)) unique.push(id);
  return unique.slice(-4);
}

export function makeMon(speciesId: string, species: SpeciesDef, level: number, uid: number, ppOf: (moveId: string) => number): MonInst {
  const stats = statsFor(species, level);
  return {
    uid,
    species: speciesId,
    level,
    exp: expForLevel(level),
    hp: stats.hp,
    status: '',
    moves: movesAt(species, level).map((id) => ({ id, pp: ppOf(id) })),
  };
}

export function evolutionTarget(species: SpeciesDef, level: number): string | null {
  if (species.evolvesTo && species.evolveLevel && level >= species.evolveLevel) return species.evolvesTo;
  return null;
}

export function grantExp(mon: MonInst, amount: number): { mon: MonInst; levels: number } {
  const before = mon.level;
  const exp = mon.exp + amount;
  const level = Math.min(100, levelFromExp(exp));
  return { mon: { ...mon, exp, level }, levels: level - before };
}

export function expYield(foe: SpeciesDef, foeLevel: number): number {
  return Math.max(8, Math.floor((foe.baseExp * foeLevel) / 6));
}

export function learnableNow(species: SpeciesDef, previousLevel: number, level: number): string[] {
  return species.learn.filter(([lv]) => lv > previousLevel && lv <= level).map(([, id]) => id);
}
