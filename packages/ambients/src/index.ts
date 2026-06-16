import type { AmbientDefinition, LabExperience } from '@hooksjam/pixi-lab-core';
import { dayRhythmFieldDefinition } from './day-rhythm-field/day-rhythm-field.definition.js';
import { homeWeatherGlassDefinition } from './home-weather-glass/home-weather-glass.definition.js';
import { sleepAquariumDefinition } from './sleep-aquarium/sleep-aquarium.definition.js';
import { musicDreamFieldDefinition } from './music-dream-field/music-dream-field.definition.js';
import { housePulseMapDefinition } from './house-pulse-map/house-pulse-map.definition.js';
import { taskGardenDefinition } from './task-garden/task-garden.definition.js';
import { familyOrbitDefinition } from './family-orbit/family-orbit.definition.js';
import { memoryDriftDefinition } from './memory-drift/memory-drift.definition.js';
import { snowfallDefinition } from './snowfall/snowfall.definition.js';
import { embersDefinition } from './embers/embers.definition.js';
import { firefliesDefinition } from './fireflies/fireflies.definition.js';
import { confettiDefinition } from './confetti/confetti.definition.js';
import { rainStreaksDefinition } from './rain-streaks/rain-streaks.definition.js';
import { leavesPollenDefinition } from './leaves-pollen/leaves-pollen.definition.js';

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
export { musicDreamFieldDefinition } from './music-dream-field/music-dream-field.definition.js';
export {
  MusicDreamFieldModel,
  type MusicDreamFieldModelOptions,
  type MusicDreamFieldSnapshot,
  type MusicDreamFieldStats,
} from './music-dream-field/MusicDreamFieldModel.js';
export { MusicDreamFieldScene, musicDreamFieldStyles } from './music-dream-field/MusicDreamFieldScene.js';
export { housePulseMapDefinition } from './house-pulse-map/house-pulse-map.definition.js';
export {
  HousePulseMapModel,
  type HousePulseMapModelOptions,
  type HousePulseMapSnapshot,
  type HousePulseMapStats,
} from './house-pulse-map/HousePulseMapModel.js';
export { HousePulseMapScene, housePulseMapStyles } from './house-pulse-map/HousePulseMapScene.js';
export { taskGardenDefinition } from './task-garden/task-garden.definition.js';
export {
  TaskGardenModel,
  type TaskGardenModelOptions,
  type TaskGardenSnapshot,
  type TaskGardenStats,
} from './task-garden/TaskGardenModel.js';
export { TaskGardenScene, taskGardenStyles } from './task-garden/TaskGardenScene.js';
export { familyOrbitDefinition } from './family-orbit/family-orbit.definition.js';
export {
  FamilyOrbitModel,
  type FamilyOrbitModelOptions,
  type FamilyOrbitSnapshot,
  type FamilyOrbitStats,
} from './family-orbit/FamilyOrbitModel.js';
export { FamilyOrbitScene, familyOrbitStyles } from './family-orbit/FamilyOrbitScene.js';
export { memoryDriftDefinition } from './memory-drift/memory-drift.definition.js';
export {
  MemoryDriftModel,
  type MemoryDriftModelOptions,
  type MemoryDriftSnapshot,
  type MemoryDriftStats,
} from './memory-drift/MemoryDriftModel.js';
export { MemoryDriftScene, memoryDriftStyles } from './memory-drift/MemoryDriftScene.js';
export { snowfallDefinition } from './snowfall/snowfall.definition.js';
export { SnowfallModel, type SnowfallModelOptions, type SnowfallSnapshot, type SnowfallStats } from './snowfall/SnowfallModel.js';
export { SnowfallScene, snowfallStyles, snowfallStyleManifest } from './snowfall/SnowfallScene.js';
export { embersDefinition } from './embers/embers.definition.js';
export { EmbersModel, type EmbersModelOptions, type EmbersSnapshot, type EmbersStats } from './embers/EmbersModel.js';
export { EmbersScene, embersStyles, embersStyleManifest } from './embers/EmbersScene.js';
export { firefliesDefinition } from './fireflies/fireflies.definition.js';
export { FirefliesModel, type FirefliesModelOptions, type FirefliesSnapshot, type FirefliesStats } from './fireflies/FirefliesModel.js';
export { FirefliesScene, firefliesStyles, firefliesStyleManifest } from './fireflies/FirefliesScene.js';
export { confettiDefinition } from './confetti/confetti.definition.js';
export { ConfettiModel, type ConfettiModelOptions, type ConfettiSnapshot, type ConfettiStats } from './confetti/ConfettiModel.js';
export { ConfettiScene, confettiStyles, confettiStyleManifest } from './confetti/ConfettiScene.js';
export { rainStreaksDefinition } from './rain-streaks/rain-streaks.definition.js';
export { RainStreaksModel, type RainStreaksModelOptions, type RainStreaksSnapshot, type RainStreaksStats } from './rain-streaks/RainStreaksModel.js';
export { RainStreaksScene, rainStreaksStyles, rainStreaksStyleManifest } from './rain-streaks/RainStreaksScene.js';
export { leavesPollenDefinition } from './leaves-pollen/leaves-pollen.definition.js';
export { LeavesPollenModel, type LeavesPollenModelOptions, type LeavesPollenSnapshot, type LeavesPollenStats } from './leaves-pollen/LeavesPollenModel.js';
export { LeavesPollenScene, leavesPollenStyles, leavesPollenStyleManifest } from './leaves-pollen/LeavesPollenScene.js';

export const AMBIENT_REGISTRY: readonly LabExperience[] = [
  dayRhythmFieldDefinition,
  homeWeatherGlassDefinition,
  sleepAquariumDefinition,
  musicDreamFieldDefinition,
  housePulseMapDefinition,
  taskGardenDefinition,
  familyOrbitDefinition,
  memoryDriftDefinition,
  snowfallDefinition,
  embersDefinition,
  firefliesDefinition,
  confettiDefinition,
  rainStreaksDefinition,
  leavesPollenDefinition,
] as const;

export function getAmbient(id: string): AmbientDefinition | undefined {
  const experience = AMBIENT_REGISTRY.find((ambient) => ambient.id === id);
  return experience?.kind === 'ambient' ? experience : undefined;
}
