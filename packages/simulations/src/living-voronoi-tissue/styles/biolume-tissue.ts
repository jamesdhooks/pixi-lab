import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const biolumeTissueStyle: SimStyle = {
  id: 'biolume-tissue',
  name: 'Biolume Tissue',
  description: 'Dark petri-glass tissue with cyan membranes, violet territory gradients, and warm mitosis pulses.',
  background: 0x030611,
  palette: [0x030611, 0x0a1534, 0x163d68, 0x00e6ff, 0x9d5cff, 0xfff0a8],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands'],
  uniforms: { glowStrength: 1.05, bloomStrength: 0.48, contourStrength: 0.38, distortionStrength: 0.18 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Membrane Glow', min: 0, max: 1.6, step: 0.02, default: 1.05 },
    { key: 'bloomStrength', label: 'Biolume Bloom', min: 0, max: 1, step: 0.02, default: 0.48 },
    { key: 'contourStrength', label: 'Cell Contours', min: 0, max: 1, step: 0.02, default: 0.38 },
    { key: 'distortionStrength', label: 'Tissue Drift', min: 0, max: 1, step: 0.02, default: 0.18 },
  ],
};
