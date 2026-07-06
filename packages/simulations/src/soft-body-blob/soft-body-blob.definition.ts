import { createEngineConfigurations, type SimulationDefinition } from '@hooksjam/pixi-lab-core';
import { SOFT_BODY_BLOB_DEFAULTS, SOFT_BODY_BLOB_SETTINGS_FIELDS } from './soft-body-blob.config.js';
import { ViscousSoftBodyBlobScene } from './ViscousSoftBodyBlobScene.js';

const softBodyBlobStyleManifest: SimulationDefinition['styleManifest'] = {
  defaultStyleId: 'candy-cytoplasm',
  capabilities: { renderLayers: ['primitive', 'body'], passes: ['paletteMap', 'primitive', 'body', 'bloom'], qualities: ['raw'] },
  styles: [
    { id: 'candy-cytoplasm', name: 'Candy Cytoplasm', description: 'Pink blob membranes with bright cyan interiors.', palette: [0xff6fae, 0x7df9ff, 0xffd166, 0xb8ff6a], background: 0x100817, passes: ['paletteMap'], uniforms: {} },
    { id: 'lagoon-gel', name: 'Lagoon Gel', description: 'Aquatic teal bodies with pale foam highlights.', palette: [0x20e3c2, 0xd7fff7, 0x4aa3ff, 0xb5f44a], background: 0x031412, passes: ['paletteMap'], uniforms: {} },
    { id: 'mango-amoeba', name: 'Mango Amoeba', description: 'Warm orange skins with soft peach centers.', palette: [0xff9d2e, 0xffd8a8, 0xff5a3d, 0xffe85c], background: 0x160b03, passes: ['paletteMap'], uniforms: {} },
    { id: 'plasma-bruise', name: 'Plasma Bruise', description: 'Deep violet blobs with magenta-blue contrast.', palette: [0xce5cff, 0x66d9ff, 0xff4faf, 0xa7fffb], background: 0x0b0618, passes: ['paletteMap'], uniforms: {} },
    { id: 'chlorophyll-gel', name: 'Chlorophyll Gel', description: 'Leafy green amoebas with sunlight yellow interiors.', palette: [0x16a34a, 0x86efac, 0xfef08a, 0x0f766e], background: 0x04110a, passes: ['paletteMap'], uniforms: {} },
    { id: 'blood-orange', name: 'Blood Orange', description: 'Red-orange membranes with citrus pulp highlights.', palette: [0xb91c1c, 0xff5a1f, 0xffc857, 0xfff7ad], background: 0x130403, passes: ['paletteMap'], uniforms: {} },
    { id: 'ink-jelly', name: 'Ink Jelly', description: 'Dark ink blobs with blue glass and pale rim light.', palette: [0x0f172a, 0x1d4ed8, 0x93c5fd, 0xf8fafc], background: 0x020617, passes: ['paletteMap'], uniforms: {} },
    { id: 'orchid-cells', name: 'Orchid Cells', description: 'Orchid purple, rose, and cream cellular blobs.', palette: [0x7e22ce, 0xc084fc, 0xf472b6, 0xfff1f2], background: 0x0d0617, passes: ['paletteMap'], uniforms: {} },
    { id: 'slime-lab', name: 'Slime Lab', description: 'Radioactive lab slime with sterile white speculars.', palette: [0x84cc16, 0xd9f99d, 0x22d3ee, 0xffffff], background: 0x061006, passes: ['paletteMap'], uniforms: {} },
    { id: 'milk-tea', name: 'Milk Tea', description: 'Soft caramel, cream, and tapioca-brown blobs.', palette: [0x92400e, 0xd97706, 0xfcd9a6, 0xfffbeb], background: 0x120a04, passes: ['paletteMap'], uniforms: {} },
  ],
};

export const softBodyBlobDefinition: SimulationDefinition = {
  id: 'soft-body-blob',
  kind: 'simulation',
  name: 'Soft-Body Blobs',
  short: 'Viscous amoeba bodies fall into a squishy pile.',
  long: 'A raw WebGL soft-body stress scene built from boundary particles, filled interior particles, area preservation, viscosity, plastic flow, and fitted amoeba skin rendering.',
  tags: ['simulation', 'physics', 'soft-body', 'raw-webgl'],
  icon: '●',
  paletteHint: 'neon',
  capabilities: {
    tutorial: false,
    interactive: true,
    gestures: true,
    reset: true,
    debugOverlay: true,
    engineConfigurations: createEngineConfigurations(['raw'], { rawBackend: 'webgl2' }),
    demo: true,
    settings: true,
  },
  settingsFields: SOFT_BODY_BLOB_SETTINGS_FIELDS,
  configDefaults: SOFT_BODY_BLOB_DEFAULTS,
  modes: [
    { id: 'draw', label: 'Draw', icon: '⬡', description: 'Draw a closed-ish shape that becomes a soft body.' },
    { id: 'build', label: 'Build', icon: '◆', description: 'Place fixed obstacle points or drag fixed obstacle lines.' },
    { id: 'interact', label: 'Interact', icon: '✋', description: 'Drag blob particles around directly.' },
  ],
  styleManifest: softBodyBlobStyleManifest,
  directorEvents: [],
  advancedPhysics: {
    renderer: 'raw-webgl2',
    engine: 'viscous-amoeba-particles',
    portability: 'reusable-core',
    supportedShapes: ['soft-body', 'circle'],
    reusableFor: ['blob piles', 'viscous connected particle bodies', 'filled soft-body collision stress tests', 'closed-body skin rendering'],
    caveats: ['This topology is specialized for closed soft bodies; chains can reuse the Verlet/contact pieces, but not the area/skin constraints directly.'],
  },
  factory: () => new ViscousSoftBodyBlobScene(),
  previewFactory: () => new ViscousSoftBodyBlobScene(true),
};
