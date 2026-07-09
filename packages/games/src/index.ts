/**
 * packages/games/src/index.ts
 *
 * Public API for @hooksjam/pixi-lab-games.
 */
import type { GameDefinition, LabExperience } from '@hooksjam/pixi-lab-core';
import { ballPitDefinition } from './ballpit/ballpit.definition';
import { colorPitArenaDefinition } from './color-pit-arena/color-pit-arena.definition';
import { pegboardDefinition } from './pegboard/pegboard.definition';

export { ballPitDefinition } from './ballpit/ballpit.definition';
export { colorPitArenaDefinition } from './color-pit-arena/color-pit-arena.definition';
export { pegboardDefinition } from './pegboard/pegboard.definition';

/** All registered experiences shipped by the games package. */
export const GAME_REGISTRY: readonly LabExperience[] = [ballPitDefinition, pegboardDefinition, colorPitArenaDefinition] as const;

/** Look up a game definition by ID */
export function getGame(id: string): GameDefinition | undefined {
  const experience = GAME_REGISTRY.find((g) => g.id === id);
  return experience?.kind === 'game' ? experience : undefined;
}
