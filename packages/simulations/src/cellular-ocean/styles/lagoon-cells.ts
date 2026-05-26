import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const lagoonCellsStyle: SimStyle = {
  id: 'lagoon-cells',
  name: 'Lagoon Cells',
  description: 'Aqua membranes drifting through a dark tidal microscope field.',
  background: 0x021018,
  palette: [0x021018, 0x063d52, 0x0ec8c1, 0xa6fff2, 0xffffff],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands'],
  uniforms: { glowStrength: 0.78, threshold: 0.28, contourSpacing: 0.16, distortion: 0.14 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Membrane Glow', min: 0, max: 1, step: 0.01, default: 0.78 },
    { key: 'threshold', label: 'Cell Threshold', min: 0.1, max: 0.8, step: 0.01, default: 0.28 },
  ],
};
