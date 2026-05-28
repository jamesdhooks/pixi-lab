import type { SimStyle } from '@hooksjam/pixi-lab-core';

export const rainbowTilesStyle: SimStyle = {
  id: 'rainbow-tiles',
  name: 'Rainbow Tiles',
  description: 'Spectral hotel-pool bands refracted over a saturated midnight tile floor.',
  background: 0x060716,
  palette: [0x050616, 0x322066, 0x0569c9, 0x00e5ff, 0xfff266, 0xff5fa8, 0xffffff],
  passes: ['paletteMap', 'edgeGlow', 'bloom', 'contourBands', 'chromaticAberration'],
  uniforms: { glowStrength: 0.96, bloomStrength: 0.48, contourStrength: 0.64, chromaStrength: 0.58 },
  uniformSchema: [
    { key: 'glowStrength', label: 'Glow', min: 0, max: 1.5, step: 0.02, default: 0.96 },
    { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1, step: 0.02, default: 0.48 },
    { key: 'contourStrength', label: 'Contours', min: 0, max: 1, step: 0.02, default: 0.64 },
    { key: 'chromaStrength', label: 'Chroma', min: 0, max: 1.2, step: 0.02, default: 0.58 },
  ],
};
