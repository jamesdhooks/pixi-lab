import type { AmbientDefinition } from '@hooksjam/pixi-lab-core';
import { dayRhythmFieldDefinition } from './day-rhythm-field/day-rhythm-field.definition.js';

export { dayRhythmFieldDefinition } from './day-rhythm-field/day-rhythm-field.definition.js';
export { DayRhythmFieldModel, type DayRhythmFieldModelOptions, type DayRhythmFieldStats } from './day-rhythm-field/DayRhythmFieldModel.js';
export { DayRhythmFieldScene, dayRhythmFieldStyles } from './day-rhythm-field/DayRhythmFieldScene.js';

export const AMBIENT_REGISTRY: readonly AmbientDefinition[] = [
  dayRhythmFieldDefinition,
] as const;

export function getAmbient(id: string): AmbientDefinition | undefined {
  return AMBIENT_REGISTRY.find((ambient) => ambient.id === id);
}
