import type { RuntimeMap } from '../sim/types';

export interface WildEncounter {
  species: string;
  level: number;
}

/**
 * Tall grass is flagged on the map, but this skeleton never starts a battle.
 * Replace the body when encounters are added. `map.encounter` is 1 on those tiles.
 */
export function checkWildEncounter(_map: RuntimeMap, _x: number, _y: number): WildEncounter | null {
  return null;
}
