import type { SimStyleManifest } from '@hooksjam/pixi-lab-core';
import { bloodMoonStyle } from './styles/blood-moon.js';
import { blackHoleLensStyle } from './styles/black-hole-lens.js';
import { iceRingStyle } from './styles/ice-ring.js';
import { inkPaperStyle } from './styles/ink-paper.js';
import { radioactiveAuroraStyle } from './styles/radioactive-aurora.js';
import { realisticStyle } from './styles/realistic.js';
import { solarDebrisStyle } from './styles/solar-debris.js';

export const orbitalShrapnelStyleManifest: SimStyleManifest = {
  defaultStyleId: 'realistic',
  capabilities: {
    renderLayers: ['particles', 'trails', 'glow', 'debug'],
    passes: ['trailFeedback', 'paletteMap', 'edgeGlow', 'bloom', 'shockwave', 'chromaticAberration', 'distortion'],
    qualities: ['raw'],
  },
  styles: [
    realisticStyle,
    iceRingStyle,
    solarDebrisStyle,
    blackHoleLensStyle,
    inkPaperStyle,
    radioactiveAuroraStyle,
    bloodMoonStyle,
    { id: 'kuiper-dust', name: 'Kuiper Dust', description: 'Dim amber dust and cold blue orbital ice.', palette: [0x93c5fd, 0xfef3c7, 0xf59e0b, 0x64748b], background: 0x020617, passes: ['trailFeedback', 'paletteMap', 'bloom'], uniforms: {} },
    { id: 'ion-storm', name: 'Ion Storm', description: 'Electric cyan and violet debris in a charged plasma field.', palette: [0x22d3ee, 0x8b5cf6, 0xf0abfc, 0xffffff], background: 0x05051a, passes: ['trailFeedback', 'paletteMap', 'bloom'], uniforms: {} },
    { id: 'rust-belt', name: 'Rust Belt', description: 'Oxidized copper fragments and dusty red orbital trails.', palette: [0x7c2d12, 0xea580c, 0xfbbf24, 0x14b8a6], background: 0x090503, passes: ['trailFeedback', 'paletteMap', 'bloom'], uniforms: {} },
  ],
};
