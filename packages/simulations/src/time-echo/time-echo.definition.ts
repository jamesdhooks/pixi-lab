import type { SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { TIME_ECHO_DEFAULTS, TIME_ECHO_SETTINGS_FIELDS } from './time-echo.config.js';
import { TimeEchoDemoAI } from './TimeEchoDemoAI.js';
import { TimeEchoPreviewScene } from './TimeEchoPreviewScene.js';
import { TimeEchoScene, timeEchoStyleManifest } from './TimeEchoScene.js';

export const timeEchoDefinition: SimulationDefinition = {
  id: 'time-echo',
  kind: 'simulation',
  name: 'Time Echo Particles',
  short: 'Particles tug against delayed ghost copies of themselves, forming temporal knots and shockwave echoes.',
  long: 'A deterministic particle-history simulation where every point stores a bounded ring buffer of prior positions. Current particles are pulled toward delayed echoes, while taps create time anchors, holds freeze local history, and swipes shear the timeline through shared trail/particle rendering layers.',
  tags: ['simulation', 'particles', 'time', 'trails'],
  icon: '⏳',
  paletteHint: 'spectral',
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
  settingsFields: TIME_ECHO_SETTINGS_FIELDS,
  configDefaults: TIME_ECHO_DEFAULTS,
  styleManifest: timeEchoStyleManifest,
  gestureMap: {
    tap: 'place a temporary time anchor that pulls echoes together',
    drag: 'shear particles and their histories into a spiral timeline',
    hold: 'freeze nearby particles so echoes overtake the present',
    fast_swipe: 'launch a repulsive temporal pulse across the field',
  },
  directorEvents: [
    { id: 'temporal-pulse', label: 'Temporal Pulse', minIntervalMs: 7000, maxIntervalMs: 15000, intensity: 0.45 },
    { id: 'history-shear', label: 'History Shear', minIntervalMs: 8000, maxIntervalMs: 16000, intensity: 0.38 },
    { id: 'echo-freeze', label: 'Echo Freeze', minIntervalMs: 9000, maxIntervalMs: 18000, intensity: 0.34 },
  ],
  stagnationPolicy: {
    stagnant: false,
    reason: 'Recover when particle motion, echo separation, or visible temporal trails collapse.',
    severity: 0,
  },
  defaultSeed: 880421,
  factory: () => new TimeEchoScene(),
  previewFactory: () => new TimeEchoPreviewScene(),
  demoAiFactory: () => new TimeEchoDemoAI(),
  tutorialPages: [
    { icon: '👻', title: 'Echoes Follow', body: 'Particles chase delayed ghost copies from their own bounded history buffers.' },
    { icon: '🧊', title: 'Freeze Time', body: 'Hold to slow a local patch so old echoes flow through the present.' },
    { icon: '🌀', title: 'Shear the Timeline', body: 'Drag or fast-swipe to twist histories into luminous loops.' },
  ],
};
