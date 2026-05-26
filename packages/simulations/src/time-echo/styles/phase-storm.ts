import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const phaseStormStyle: SimStyle = {
  id: 'phase-storm',
  name: 'Phase Storm',
  description: 'Magenta/cyan temporal shear with aggressive chromatic phase trails.',
  background: 0x07020f,
  palette: [0x07020f, 0x241064, 0xd91fff, 0x00f0ff, 0xf7ff68],
  passes: ['trailFeedback', 'paletteMap', 'distortion', 'chromaticAberration', 'bloom', 'shockwave'],
  uniforms: { glowStrength: 0.92, trailPersistence: 0.952, chromatic: 0.24, shockwaveStrength: 0.58 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Phase Glow', min: 0, max: 1, step: 0.01, default: 0.92 },
    { key: 'chromatic', label: 'Phase Split', min: 0, max: 0.4, step: 0.01, default: 0.24 },
  ],
};
