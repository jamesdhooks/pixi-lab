import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { PLASMA_BRANCH_DEFAULTS, PLASMA_BRANCH_SETTINGS_FIELDS } from './plasma-branch.config.js';
import { PlasmaBranchDemoAI } from './PlasmaBranchDemoAI.js';
import { PlasmaBranchPreviewScene } from './PlasmaBranchPreviewScene.js';
import { PlasmaBranchScene, plasmaBranchStyleManifest } from './PlasmaBranchScene.js';

export const plasmaBranchDefinition: SimulationDefinition = {
  id: 'plasma-branch',
  kind: 'simulation',
  name: 'Plasma Branch Terrarium',
  short: 'Branching ion arcs crawl across charged fields and leave glowing scar trails.',
  long: 'A deterministic charged-field terrarium where tap and drag input continuously injects plasma branches through a bounded scar trail field rendered with shared simulation layers.',
  tags: ['simulation', 'plasma', 'field', 'trails'],
  icon: '⚡',
  paletteHint: 'electric',
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
    demo: true,
    settings: true,
  },
  settingsFields: PLASMA_BRANCH_SETTINGS_FIELDS,
  configDefaults: PLASMA_BRANCH_DEFAULTS,
  styleManifest: plasmaBranchStyleManifest,
  gestureMap: {
    tap: 'add plasma at the pointer',
    drag: 'continuously add plasma branches',
  },
  directorEvents: [
    { id: 'charge-buildup', label: 'Ambient Charge Build-up', minIntervalMs: 5000, maxIntervalMs: 12000, intensity: 0.38 },
    { id: 'branch-fork', label: 'Branch Fork', minIntervalMs: 7000, maxIntervalMs: 15000, intensity: 0.34 },
    { id: 'scar-glow', label: 'Scar Glow Pulse', minIntervalMs: 8000, maxIntervalMs: 16000, intensity: 0.28 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when charge drains away or no active discharge branches remain.',
    severity: 0,
  },
  defaultSeed: 552901,
  factory: () => new PlasmaBranchScene(),
  previewFactory: () => new PlasmaBranchPreviewScene(),
  demoAiFactory: () => new PlasmaBranchDemoAI(),
  tutorialPages: [
    { icon: '⚡', title: 'Add Plasma', body: 'Tap or drag to inject branching plasma into the charged field.' },
    { icon: '🧬', title: 'Branch Growth', body: 'Plasma arcs chase charge and leave fading scar trails.' },
  ],
};
