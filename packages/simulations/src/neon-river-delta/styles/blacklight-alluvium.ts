import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const blacklightAlluviumStyle: SimStyle = {
  id: 'blacklight-alluvium',
  name: 'Blacklight Alluvium',
  description: 'Deep indigo landforms with ultraviolet water and pale alluvial fans.',
  background: 0x02020d,
  palette: [0x02020d, 0x111047, 0x4d22a8, 0x9f68ff, 0x31ffe6, 0xf8ffff],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'distortion'],
  uniforms: { glowStrength: 1.02, bloomStrength: 0.46, contourStrength: 0.36, distortionStrength: 0.42 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.5, step: 0.02, default: 1.02 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.46 },
    { key: 'contourStrength', label: 'Contours', min: 0, max: 1, step: 0.02, default: 0.36 },
    { key: 'distortionStrength', label: 'Distortion', min: 0, max: 1, step: 0.02, default: 0.42 },
  ],
};
