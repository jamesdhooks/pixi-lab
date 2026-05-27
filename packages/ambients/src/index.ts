import type { AmbientDefinition } from '@hooksjam/pixi-lab-core';
import { dayRhythmFieldDefinition } from './day-rhythm-field/day-rhythm-field.definition.js';
import { homeWeatherGlassDefinition } from './home-weather-glass/home-weather-glass.definition.js';
import { sleepAquariumDefinition } from './sleep-aquarium/sleep-aquarium.definition.js';

export { dayRhythmFieldDefinition } from './day-rhythm-field/day-rhythm-field.definition.js';
export { DayRhythmFieldModel, type DayRhythmFieldModelOptions, type DayRhythmFieldStats } from './day-rhythm-field/DayRhythmFieldModel.js';
export { DayRhythmFieldScene, dayRhythmFieldStyles } from './day-rhythm-field/DayRhythmFieldScene.js';
export { homeWeatherGlassDefinition } from './home-weather-glass/home-weather-glass.definition.js';
export {
  HomeWeatherGlassModel,
  type HomeWeatherGlassModelOptions,
  type HomeWeatherGlassSnapshot,
  type HomeWeatherGlassStats,
} from './home-weather-glass/HomeWeatherGlassModel.js';
export { HomeWeatherGlassScene, homeWeatherGlassStyles } from './home-weather-glass/HomeWeatherGlassScene.js';
export { sleepAquariumDefinition } from './sleep-aquarium/sleep-aquarium.definition.js';
export {
  SleepAquariumModel,
  type SleepAquariumModelOptions,
  type SleepAquariumSnapshot,
  type SleepAquariumStats,
} from './sleep-aquarium/SleepAquariumModel.js';
export { SleepAquariumScene, sleepAquariumStyles } from './sleep-aquarium/SleepAquariumScene.js';

export const AMBIENT_REGISTRY: readonly AmbientDefinition[] = [
  dayRhythmFieldDefinition,
  homeWeatherGlassDefinition,
  sleepAquariumDefinition,
] as const;

export function getAmbient(id: string): AmbientDefinition | undefined {
  return AMBIENT_REGISTRY.find((ambient) => ambient.id === id);
}
