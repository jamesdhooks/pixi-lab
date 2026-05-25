import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const biolumOceanStyle: SimStyle = {
  id: 'biolum-ocean',
  name: 'Biolum Ocean',
  description: 'Deep-sea bioluminescence — teal on absolute black.',
  background: 0x000a08,
  palette: [0x001a14, 0x006655, 0x00c4a7, 0x80ffe8],
  passes: ['primitive', 'fieldVisualize', 'paletteMap', 'contourBands', 'bloom', 'composite'],
  uniforms: {
    glowStrength: 0.38,
    contourIntensity: 0.35,
    trailFade: 0.85,
  },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow Strength', min: 0, max: 1, step: 0.01, default: 0.38 },
    { key: 'contourIntensity', label: 'Contour Intensity', min: 0, max: 1, step: 0.01, default: 0.35 },
  ],
};
