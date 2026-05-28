import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const powderPrismStyle: SimStyle = {
  id: 'powder-prism',
  name: 'Powder Prism',
  description: 'Bright festival powders tumble into saturated spectral dunes.',
  background: 0x070410,
  palette: [0x070410, 0x24104d, 0x2ee7ff, 0xff3dce, 0xffd166, 0xfffff7],
  passes: ['densityMetaball', 'paletteMap', 'edgeGlow', 'bloom', 'contourBands'],
  uniforms: { threshold: 0.38, glowStrength: 0.9, bloomStrength: 0.42, contourStrength: 0.58 },
  uniformSchema: [
    { key: 'threshold', label: 'Powder Threshold', min: 0.18, max: 0.72, step: 0.01, default: 0.38 },
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.4, step: 0.02, default: 0.9 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.42 },
    { key: 'contourStrength', label: 'Contour Bands', min: 0, max: 1, step: 0.02, default: 0.58 },
  ],
};
