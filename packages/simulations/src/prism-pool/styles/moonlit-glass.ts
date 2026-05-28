import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const moonlitGlassStyle: SimStyle = {
  id: 'moonlit-glass',
  name: 'Moonlit Glass',
  description: 'Low-light indigo pool water with silver ripples and quiet lunar caustics.',
  background: 0x02030b,
  palette: [0x02030b, 0x0b1230, 0x1d2f68, 0x6e8ed8, 0xc9e5ff, 0xf8fbff],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'distortion', 'normalLighting'],
  uniforms: { glowStrength: 0.54, bloomStrength: 0.22, contourStrength: 0.34, distortionStrength: 0.46 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.2, step: 0.02, default: 0.54 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.22 },
    { key: 'contourStrength', label: 'Contours', min: 0, max: 1, step: 0.02, default: 0.34 },
    { key: 'distortionStrength', label: 'Distortion', min: 0, max: 1.2, step: 0.02, default: 0.46 },
  ],
};
