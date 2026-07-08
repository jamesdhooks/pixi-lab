import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const CHAIN_RAIN_SETTINGS_FIELDS: SettingsField[] = [
  {
    key: 'renderStyle',
    label: 'Style',
    section: 'Rendering',
    type: 'select',
    options: [
      { label: 'Basic', value: 'basic' },
      { label: 'Enhanced', value: 'enhanced' },
    ],
    default: 'enhanced',
  },
  { key: 'maxNodes', label: 'Max Nodes', section: 'Physics', type: 'number', min: 2048, max: 131072, step: 1, numericScale: 'powerOfTwo', default: 32768, visibleQualities: ['raw'], advanced: true },
  { key: 'nodeRadius', label: 'Node Radius', section: 'Physics', type: 'number', min: 2, max: 12, step: 0.25, default: 5, visibleQualities: ['raw'] },
  { key: 'chainLength', label: 'Chain Length', section: 'Input Mode', type: 'number', min: 3, max: 96, step: 1, default: 16, visibleQualities: ['raw'], visibleModes: ['draw'] },
  { key: 'interactionRadius', label: 'Interaction Radius', section: 'Input Mode', type: 'number', min: 16, max: 240, step: 2, default: 56, visibleQualities: ['raw'], visibleModes: ['interact'] },
  { key: 'gravity', label: 'Gravity', section: 'Physics', type: 'number', min: 0, max: 3000, step: 25, default: 1250, visibleQualities: ['raw'] },
  { key: 'friction', label: 'Friction', section: 'Physics', type: 'number', min: 0, max: 1, step: 0.01, default: 0.35, visibleQualities: ['raw'] },
  { key: 'solverPasses', label: 'Collision Passes', section: 'Physics', type: 'number', min: 1, max: 8, step: 1, default: 3, visibleQualities: ['raw'] },
  { key: 'substeps', label: 'Substeps', section: 'Physics', type: 'number', min: 1, max: 5, step: 1, default: 2, visibleQualities: ['raw'] },
  { key: 'constraintPasses', label: 'Link Passes', section: 'Physics', type: 'number', min: 1, max: 8, step: 1, default: 2, visibleQualities: ['raw'] },
  { key: 'constraintStiffness', label: 'Stiffness', section: 'Physics', type: 'number', min: 0.1, max: 1, step: 0.01, default: 0.92, visibleQualities: ['raw'] },
  { key: 'collisionSoftness', label: 'Softness', section: 'Physics', type: 'number', min: 0.05, max: 1.5, step: 0.01, default: 0.82, visibleQualities: ['raw'], advanced: true },
];

export const CHAIN_RAIN_DEFAULTS: Record<string, unknown> = {
  renderStyle: 'enhanced',
  maxNodes: 32768,
  nodeRadius: 5,
  chainLength: 16,
  interactionRadius: 56,
  gravity: 1250,
  friction: 0.35,
  solverPasses: 3,
  substeps: 2,
  constraintPasses: 2,
  constraintStiffness: 0.92,
  collisionSoftness: 0.82,
};
