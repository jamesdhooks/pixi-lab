import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const deepCurrentStyle: SimStyle = {
  id: 'deep-current',
  name: 'Deep Current',
  description: 'Cold green currents drifting below an abyssal blue surface.',
  background: 0x00070a,
  palette: [0x00070a, 0x062333, 0x0b6a78, 0x35ffba, 0xd6fff0],
  passes: ['paletteMap', 'edgeGlow', 'trailFeedback', 'chromaticAberration', 'distortion'],
  uniforms: { glowStrength: 0.7, chromaShift: 0.18, distortionStrength: 0.38 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.4, step: 0.02, default: 0.7 },
    { key: 'chromaShift', label: 'Chroma Shift', min: 0, max: 0.6, step: 0.02, default: 0.18 },
    { key: 'distortionStrength', label: 'Distortion', min: 0, max: 1, step: 0.02, default: 0.38 },
  ],
};
