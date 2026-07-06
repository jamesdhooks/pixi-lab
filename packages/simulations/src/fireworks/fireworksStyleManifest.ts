import type { SimStyleManifest } from '@hooksjam/pixi-lab-core';
import { festivalNightStyle } from './styles/festival-night.js';
import { goldWillowStyle } from './styles/gold-willow.js';
import { neonSmokeStyle } from './styles/neon-smoke.js';

export const fireworksStyleManifest: SimStyleManifest = {
  defaultStyleId: 'festival-night',
  capabilities: {
    renderLayers: ['particles', 'trails', 'glow', 'debug'],
    passes: ['trailFeedback', 'edgeGlow', 'bloom', 'colorGrade', 'chromaticAberration'],
    qualities: ['raw'],
  },
  styles: [
    festivalNightStyle,
    goldWillowStyle,
    neonSmokeStyle,
    { id: 'peony-garden', name: 'Peony Garden', description: 'Soft floral bursts in rose, lavender, mint, and cream.', palette: [0xfb7185, 0xc084fc, 0x86efac, 0xfffbeb], background: 0x080612, passes: ['trailFeedback', 'bloom'], uniforms: {} },
    { id: 'dragon-finale', name: 'Dragon Finale', description: 'Red-gold festival shells with smoky ember trails.', palette: [0xdc2626, 0xf97316, 0xfacc15, 0xfff7ad], background: 0x0d0303, passes: ['trailFeedback', 'bloom'], uniforms: {} },
    { id: 'ice-comets', name: 'Ice Comets', description: 'Blue-white comet shells with cold cyan crackle.', palette: [0x38bdf8, 0x93c5fd, 0xe0f2fe, 0xffffff], background: 0x020617, passes: ['trailFeedback', 'bloom'], uniforms: {} },
    { id: 'acid-rain', name: 'Acid Rain', description: 'Toxic lime and electric aqua sparks over black sky.', palette: [0xbaff29, 0x22c55e, 0x22d3ee, 0xf0fdf4], background: 0x020803, passes: ['trailFeedback', 'bloom'], uniforms: {} },
    { id: 'rose-gold', name: 'Rose Gold', description: 'Champagne, rose, and pearl sparks for elegant finales.', palette: [0xf9a8d4, 0xfbcfe8, 0xfacc15, 0xfffbeb], background: 0x10070d, passes: ['trailFeedback', 'bloom'], uniforms: {} },
    { id: 'ultraviolet', name: 'Ultraviolet', description: 'Blacklight violet bursts with cyan and magenta fringes.', palette: [0x7e22ce, 0xc084fc, 0x22d3ee, 0xec4899], background: 0x05020d, passes: ['trailFeedback', 'bloom'], uniforms: {} },
    { id: 'paper-lanterns', name: 'Paper Lanterns', description: 'Warm lantern oranges and soft cream sparks.', palette: [0xb45309, 0xf97316, 0xfbbf24, 0xffedd5], background: 0x090502, passes: ['trailFeedback', 'bloom'], uniforms: {} },
  ],
};
