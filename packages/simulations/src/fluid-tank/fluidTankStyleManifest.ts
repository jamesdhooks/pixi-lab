import type { SimStyleManifest } from '@hooksjam/pixi-lab-core';
import { auroraBorealisStyle } from './styles/aurora-borealis.js';
import { boundedCyanStyle } from './styles/bounded-cyan.js';
import { deepOceanStyle } from './styles/deep-ocean.js';
import { forestMossStyle } from './styles/forest-moss.js';
import { lavaLampStyle } from './styles/lava-lamp.js';
import { nebulaOilStyle } from './styles/nebula-oil.js';
import { thermalBloomStyle } from './styles/thermal-bloom.js';

export const fluidTankStyleManifest: SimStyleManifest = {
  defaultStyleId: 'bounded-cyan',
  capabilities: {
    renderLayers: ['fluid'],
    passes: ['gpuFluid', 'paletteMap', 'trailFeedback', 'normalLighting', 'bloom', 'colorGrade', 'composite'],
    qualities: ['raw'],
  },
  styles: [
    boundedCyanStyle,
    {
      id: 'webgl-fluid-glow',
      name: 'WebGL Fluid Glow',
      description: 'High-energy dye with surface shading, bloom, and sunray-style light shafts.',
      background: 0x02030a,
      palette: [0x38f8ff, 0x6867ff, 0xff4fd8, 0xfff0a6],
      passes: ['gpuFluid', 'normalLighting', 'bloom', 'colorGrade', 'composite'],
      uniforms: {
        exposure: 1.16,
        paletteStrength: 0.7,
        edgeDarkening: 0.14,
        shadingStrength: 1,
        bloomStrength: 0.8,
        bloomThreshold: 0.6,
        sunraysStrength: 1,
      },
      uniformSchema: [
        { key: 'exposure', label: 'Exposure', min: 0.72, max: 1.55, step: 0.01, default: 1.16 },
        { key: 'paletteStrength', label: 'Palette Strength', min: 0, max: 1, step: 0.01, default: 0.7 },
        { key: 'edgeDarkening', label: 'Edge Darkening', min: 0, max: 1, step: 0.01, default: 0.14 },
        { key: 'shadingStrength', label: 'Surface Shading', min: 0, max: 1, step: 0.01, default: 1 },
        { key: 'bloomStrength', label: 'Bloom', min: 0, max: 1.8, step: 0.01, default: 0.8 },
        { key: 'bloomThreshold', label: 'Bloom Threshold', min: 0.08, max: 1.4, step: 0.01, default: 0.6 },
        { key: 'sunraysStrength', label: 'Sun Rays', min: 0, max: 1, step: 0.01, default: 1 },
      ],
    },
    nebulaOilStyle,
    thermalBloomStyle,
    auroraBorealisStyle,
    deepOceanStyle,
    lavaLampStyle,
    forestMossStyle,
    {
      id: 'ink-wash',
      name: 'Ink Wash',
      description: 'Black India ink blooms through warm paper dye.',
      background: 0x050505,
      palette: [0x030303, 0x1f2937, 0x6b7280, 0xf8fafc],
      passes: ['gpuFluid'],
      uniforms: { exposure: 0.9, paletteStrength: 0.9, edgeDarkening: 0.35 },
      uniformSchema: [],
    },
    {
      id: 'candy-diffusion',
      name: 'Candy Diffusion',
      description: 'Pink, lemon, and aqua dye streams with soft confection contrast.',
      background: 0x120816,
      palette: [0xfb7185, 0xf9a8d4, 0xfef08a, 0x67e8f9],
      passes: ['gpuFluid'],
      uniforms: { exposure: 1.05, paletteStrength: 0.86, edgeDarkening: 0.2 },
      uniformSchema: [],
    },
    {
      id: 'copper-patina',
      name: 'Copper Patina',
      description: 'Molten copper dye oxidizing into turquoise edges.',
      background: 0x100704,
      palette: [0x78350f, 0xea580c, 0xfacc15, 0x14b8a6],
      passes: ['gpuFluid'],
      uniforms: { exposure: 0.98, paletteStrength: 0.88, edgeDarkening: 0.28 },
      uniformSchema: [],
    },
    {
      id: '__random__',
      name: 'Random',
      description: 'Picks a random fluid palette each time.',
      background: 0x020206,
      palette: [0x66fff1, 0x0a7dff, 0xff5de4, 0xfff2a0],
      passes: ['gpuFluid'],
      uniforms: {
        exposure: 1.08,
        paletteStrength: 0.82,
        edgeDarkening: 0.24,
      },
      uniformSchema: [],
    },
  ],
};
