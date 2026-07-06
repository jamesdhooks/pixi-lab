import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const WATER_TANK_SETTINGS_FIELDS: SettingsField[] = [
  {
    key: 'renderStyle',
    label: 'Style',
    section: 'Rendering',
    type: 'select',
    options: [
      { label: 'Particles', value: 'particles' },
      { label: 'Surface', value: 'surface' },
      { label: 'Glass', value: 'glass' },
    ],
    default: 'glass',
  },
  { key: 'maxParticles', label: 'Max Particles', section: 'Physics', type: 'number', min: 500, max: 12000, step: 250, default: 6500 },
  { key: 'particleRadius', label: 'Particle Radius', section: 'Physics', type: 'number', min: 2.5, max: 10, step: 0.25, default: 4.8 },
  { key: 'gravity', label: 'Gravity', section: 'Physics', type: 'number', min: 100, max: 2600, step: 25, default: 1450 },
  { key: 'viscosity', label: 'Viscosity', section: 'Physics', type: 'number', min: 0, max: 0.65, step: 0.01, default: 0.18 },
  { key: 'pourRate', label: 'Pour Rate', section: 'Input Mode', type: 'number', min: 30, max: 1800, step: 30, default: 360, visibleModes: ['pour'] },
  { key: 'pourRadius', label: 'Pour Radius', section: 'Input Mode', type: 'number', min: 4, max: 90, step: 1, default: 22, visibleModes: ['pour'] },
  { key: 'buildRadius', label: 'Build Radius', section: 'Input Mode', type: 'number', min: 6, max: 48, step: 1, default: 18, visibleModes: ['build'] },
  { key: 'interactionRadius', label: 'Interaction Radius', section: 'Input Mode', type: 'number', min: 20, max: 220, step: 2, default: 76, visibleModes: ['interact'] },
  { key: 'interactionStrength', label: 'Interaction Strength', section: 'Input Mode', type: 'number', min: 2, max: 45, step: 1, default: 18, visibleModes: ['interact'] },
  { key: 'metaballBlend', label: 'Water Surface', section: 'Rendering', type: 'number', min: 0, max: 1, step: 0.01, default: 0.76 },
  { key: 'opacity', label: 'Water Opacity', section: 'Rendering', type: 'number', min: 0.05, max: 1, step: 0.01, default: 0.34 },
  { key: 'renderScale', label: 'Render Size', section: 'Rendering', type: 'number', min: 1, max: 4, step: 0.05, default: 2.1 },
  { key: 'substeps', label: 'Substeps', section: 'Physics', type: 'number', min: 1, max: 4, step: 1, default: 2 },
];

export const WATER_TANK_DEFAULTS: Record<string, unknown> = {
  renderStyle: 'glass',
  maxParticles: 6500,
  particleRadius: 4.8,
  gravity: 1450,
  viscosity: 0.18,
  pourRate: 360,
  pourRadius: 22,
  buildRadius: 18,
  interactionRadius: 76,
  interactionStrength: 18,
  metaballBlend: 0.76,
  opacity: 0.34,
  renderScale: 2.1,
  substeps: 2,
};
