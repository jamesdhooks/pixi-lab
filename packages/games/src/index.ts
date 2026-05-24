/**
 * packages/games/src/index.ts
 *
 * Public API for @hooksjam/pixi-lab-games.
 */
import type { GameDefinition } from '@hooksjam/pixi-lab-core';
import { ballPitDefinition } from './ballpit/ballpit.definition';

export { ballPitDefinition } from './ballpit/ballpit.definition';

/** All registered games in this package */
export const GAME_REGISTRY: readonly GameDefinition[] = [ballPitDefinition] as const;

/** Look up a game definition by ID */
export function getGame(id: string): GameDefinition | undefined {
  return GAME_REGISTRY.find((g) => g.id === id);
}
