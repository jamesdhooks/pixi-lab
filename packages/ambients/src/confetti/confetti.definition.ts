import { createEngineConfigurations, DEFAULT_FOREGROUND_BEHAVIOR, type EffectDefinition } from '@hooksjam/pixi-lab-core';
import { CONFETTI_DEFAULTS } from './confetti.config.js';
import { ConfettiScene, confettiStyleManifest } from './ConfettiScene.js';

export const confettiDefinition: EffectDefinition = {
  id: 'confetti',
  kind: 'effect',
  renderModes: ['foregroundOverlay', 'fullscreen', 'previewTile'],
  name: 'Confetti',
  short: 'A deterministic celebration overlay for UI milestones and demo moments.',
  long: 'Confetti is a transparent foreground overlay for celebrations, task completions, and gallery demos. It reacts to optional tasks/calendar/presence data, falls back to synthetic pulses, and keeps live controls for passive display safety.',
  tags: ['effect', 'overlay', 'celebration', 'tasks', 'low-motion'],
  icon: '🎉',
  paletteHint: 'party-pop',
  capabilities: {
    reset: true,
    debugOverlay: true,
    styleExport: true,
    lowMotion: true,
    sleepMode: true,
    engineConfigurations: createEngineConfigurations(['basic', 'enhanced']),
    settings: true,
  },
  dataBindings: [
    { source: 'tasks', optional: true, fallback: 'synthetic' },
    { source: 'calendar', optional: true, fallback: 'synthetic' },
    { source: 'presence', optional: true, fallback: 'synthetic' },
    { source: 'synthetic', optional: false, fallback: 'idle' },
  ],
  behavior: {
    ...DEFAULT_FOREGROUND_BEHAVIOR,
    maxBrightness: CONFETTI_DEFAULTS.maxBrightness,
    maxParticleCount: CONFETTI_DEFAULTS.pieceCount,
  },
  configDefaults: { ...CONFETTI_DEFAULTS },
  styleManifest: confettiStyleManifest,
  settingsFields: [
    { key: 'pieceCount', label: 'Piece Count', description: 'Seeded particle budget for the foreground celebration overlay.', type: 'number', min: 24, max: 1000, step: 24, default: CONFETTI_DEFAULTS.pieceCount },
    { key: 'intensity', label: 'Intensity', description: 'Global visibility multiplier for confetti pieces.', type: 'number', min: 0.08, max: 1, step: 0.04, default: CONFETTI_DEFAULTS.intensity },
    { key: 'maxBrightness', label: 'Max Brightness', description: 'Caps confetti alpha so foreground UI remains readable.', type: 'number', min: 0.12, max: 0.75, step: 0.04, default: CONFETTI_DEFAULTS.maxBrightness },
    { key: 'burst', label: 'Burst', description: 'Manual celebration signal mixed with synthetic or task completion data.', type: 'number', min: 0, max: 1, step: 0.04, default: CONFETTI_DEFAULTS.burst },
    { key: 'gravity', label: 'Gravity', description: 'Controls falling speed for the overlay shower.', type: 'number', min: 0, max: 1, step: 0.04, default: CONFETTI_DEFAULTS.gravity },
    { key: 'spread', label: 'Spread', description: 'Controls horizontal drift and shower width.', type: 'number', min: 0, max: 1, step: 0.04, default: CONFETTI_DEFAULTS.spread },
    { key: 'sleepMode', label: 'Sleep Mode', description: 'Dims and thins confetti for overnight passive displays.', type: 'boolean', default: CONFETTI_DEFAULTS.sleepMode },
    { key: 'lowMotion', label: 'Low Motion', description: 'Reduces falling motion and visible pieces while preserving the celebration read.', type: 'boolean', default: CONFETTI_DEFAULTS.lowMotion },
  ],
  factory: () => new ConfettiScene(false),
  previewFactory: () => new ConfettiScene(true),
  defaultSeed: 20260705,
  tutorialPages: [
    { icon: '🎉', title: 'Celebration overlay', body: 'Confetti is designed for transparent foreground use and keeps brightness capped so UI remains readable.' },
    { icon: '✅', title: 'Data optional', body: 'Task completion, calendar events, and presence can increase celebration energy, while synthetic fallback data keeps the gallery demoable.' },
    { icon: '🌙', title: 'Passive controls', body: 'Piece budget, intensity, brightness, burst, gravity, spread, sleep mode, and low motion all apply while the scene runs.' },
  ],
};
