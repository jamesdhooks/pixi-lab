import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const SOFT_BODY_BLOB_SETTINGS_FIELDS: SettingsField[] = [
  {
    key: 'renderStyle',
    label: 'Style',
    section: 'Rendering',
    type: 'select',
    options: [
      { label: 'Basic', value: 'basic' },
      { label: 'Enhanced', value: 'enhanced' },
      { label: 'Metaball', value: 'metaball' },
    ],
    default: 'enhanced',
  },
  { key: 'blobSize', label: 'Blob Size', section: 'Physics', type: 'number', min: 18, max: 82, step: 1, default: 42, visibleQualities: ['raw'] },
  { key: 'nodeDensity', label: 'Node Density', section: 'Physics', type: 'number', min: 0.35, max: 2.5, step: 0.05, default: 1, visibleQualities: ['raw'] },
  { key: 'interactionRadius', label: 'Interaction Radius', section: 'Input Mode', type: 'number', min: 16, max: 280, step: 2, default: 72, visibleQualities: ['raw'], visibleModes: ['interact'] },
  { key: 'drawSmoothing', label: 'Draw Smoothing', section: 'Input Mode', type: 'number', min: 0, max: 1, step: 0.01, default: 0.45, visibleQualities: ['raw'], visibleModes: ['draw'] },
  { key: 'gravity', label: 'Gravity', section: 'Physics', type: 'number', min: 0, max: 2400, step: 25, default: 1250, visibleQualities: ['raw'] },
  { key: 'viscosity', label: 'Viscosity', section: 'Physics', type: 'number', min: 0, max: 1, step: 0.01, default: 0.64, visibleQualities: ['raw'] },
  { key: 'surfaceTension', label: 'Surface Tension', section: 'Physics', type: 'number', min: 0, max: 1, step: 0.01, default: 0.28, visibleQualities: ['raw'] },
  { key: 'plasticFlow', label: 'Plastic Flow', section: 'Physics', type: 'number', min: 0, max: 1, step: 0.01, default: 0.18, visibleQualities: ['raw'] },
  { key: 'skinSmoothing', label: 'Skin Smoothing', section: 'Rendering', type: 'number', min: 0, max: 0.85, step: 0.01, default: 0.46, visibleQualities: ['raw'], visibleRenderStyles: ['enhanced'] },
  { key: 'substeps', label: 'Substeps', section: 'Physics', type: 'number', min: 1, max: 5, step: 1, default: 2, visibleQualities: ['raw'] },
  { key: 'constraintPasses', label: 'Shape Passes', section: 'Physics', type: 'number', min: 2, max: 14, step: 1, default: 7, visibleQualities: ['raw'] },
  { key: 'squishiness', label: 'Squishiness', section: 'Physics', type: 'number', min: 0, max: 2, step: 0.01, default: 0.78, visibleQualities: ['raw'] },
];

export const SOFT_BODY_BLOB_DEFAULTS: Record<string, unknown> = {
  renderStyle: 'enhanced',
  blobSize: 42,
  nodeDensity: 1,
  interactionRadius: 72,
  drawSmoothing: 0.45,
  gravity: 1250,
  viscosity: 0.64,
  surfaceTension: 0.28,
  plasticFlow: 0.18,
  skinSmoothing: 0.46,
  substeps: 2,
  constraintPasses: 7,
  squishiness: 0.78,
};
