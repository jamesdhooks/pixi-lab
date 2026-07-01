import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const laserPlateStyle: SimStyle = {
  id: 'laser-plate',
  name: 'Laser Plate',
  description: 'Bright cyan and magenta interference.',
  background: 0x02020a,
  palette: [0x00e5ff, 0x3b82f6, 0xff4fd8, 0xffffff],
  passes: ['primitive', 'fieldVisualize', 'paletteMap', 'edgeGlow', 'contourBands', 'bloom', 'composite'],
  uniforms: {
    glowStrength: 0.5,
    contourIntensity: 0.58,
    trailFade: 0.76,
  },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow Strength', min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: 'contourIntensity', label: 'Contour Intensity', min: 0, max: 1, step: 0.01, default: 0.58 },
  ],
};
