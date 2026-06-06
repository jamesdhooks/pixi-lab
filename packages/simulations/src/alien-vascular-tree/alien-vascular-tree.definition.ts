import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { ALIEN_VASCULAR_TREE_DEFAULTS, ALIEN_VASCULAR_TREE_SETTINGS_FIELDS } from './alien-vascular-tree.config.js';
import { AlienVascularTreeDemoAI } from './AlienVascularTreeDemoAI.js';
import { AlienVascularTreePreviewScene } from './AlienVascularTreePreviewScene.js';
import { AlienVascularTreeScene, alienVascularTreeStyleManifest } from './AlienVascularTreeScene.js';

export const alienVascularTreeDefinition: SimulationDefinition = {
  id: 'alien-vascular-tree',
  kind: 'simulation',
  name: 'Alien Vascular Tree',
  short: 'Procedural xeno-arteries branch toward light while nutrient pulses prune weak tips.',
  long: 'A deterministic vascular graph grows from root vessels toward a movable light source. Nutrient flow thickens successful branches, pruning removes starved tips, and the scene renders glowing branch arcs over scalar nutrient and pulse fields. Drag to move the light source, tap or hold to feed local tissue.',
  tags: ['simulation', 'branching', 'vascular', 'growth'],
  icon: '🫀',
  paletteHint: 'glowing xeno veins',
  capabilities: {
    tutorial: true,
    interactive: true,
    ambient: true,
    gestures: true,
    reset: true,
    directorMode: true,
    stagnationRecovery: true,
    debugOverlay: true,
    styleExport: true,
    proceduralTextures: true,
    renderTargetPool: true,
    qualityModes: ['basic', 'enhanced'],
    engineConfigurations: createEngineConfigurations(['basic', 'enhanced']),
    demo: true,
    settings: true,
  },
  settingsFields: ALIEN_VASCULAR_TREE_SETTINGS_FIELDS,
  configDefaults: ALIEN_VASCULAR_TREE_DEFAULTS,
  styleManifest: alienVascularTreeStyleManifest,
  gestureMap: {
    tap: 'inject a nutrient bead that reactivates nearby branch tips',
    hold: 'feed a larger tissue pocket for a local growth spurt',
    drag: 'move the light source and bend future branching toward it',
    fast_swipe: 'throw the light source across the canopy and seed a pulse trail',
  },
  directorEvents: [
    { id: 'growth-spurt', label: 'Growth Spurt', minIntervalMs: 7000, maxIntervalMs: 14000, intensity: 0.45 },
    { id: 'nutrient-flush', label: 'Nutrient Flush', minIntervalMs: 9000, maxIntervalMs: 17000, intensity: 0.5 },
    { id: 'canopy-prune', label: 'Canopy Prune', minIntervalMs: 15000, maxIntervalMs: 26000, intensity: 0.32 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when active branch tips, nutrient variance, or growth energy collapse.',
    severity: 0,
  },
  defaultSeed: 260617,
  factory: () => new AlienVascularTreeScene(),
  previewFactory: () => new AlienVascularTreePreviewScene(),
  demoAiFactory: () => new AlienVascularTreeDemoAI(),
  tutorialPages: [
    { icon: '🌱', title: 'Grow Toward Light', body: 'Drag to move the light source; new branches bias toward it while older vessels keep feeding the canopy.' },
    { icon: '🫧', title: 'Feed the Tissue', body: 'Tap or hold to add nutrient pulses. Starved tips prune away, but fresh nutrients reactivate nearby vessels.' },
  ],
};
