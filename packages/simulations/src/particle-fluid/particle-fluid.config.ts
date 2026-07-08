import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const PARTICLE_FLUID_SETTINGS_FIELDS: SettingsField[] = [
  {
    key: 'maxParticles',
    label: 'Particle Budget',
    section: 'Simulation',
    description: 'Maximum live particle count. Higher powers of two produce denser fluid but cost more CPU simulation and GPU upload work.',
    type: 'number',
    min: 1024,
    max: 1048576,
    step: 1,
    numericScale: 'powerOfTwo',
    default: 262144,
  },
  { key: 'fieldCellSize', label: 'Fluid Scale', section: 'Simulation', description: 'Source-style fluid texture divisor. 4 matches the original Medium quality; 2 is Ultra High.', type: 'number', min: 2, max: 6, step: 1, default: 4 },
  { key: 'simulationScale', label: 'Tank Scale', section: 'Simulation', description: 'Scales the simulation domain. Higher values make the tank feel larger and currents broader/slower on screen.', type: 'number', min: 0.5, max: 2.5, step: 0.05, default: 1 },
  { key: 'solverIterations', label: 'Solver Iterations', section: 'Simulation', type: 'number', min: 1, max: 50, step: 1, default: 18 },
  { key: 'cellSize', label: 'Cell Size', section: 'Simulation', description: 'Source grid cell scale used by advection, pressure projection, and particle flow scaling.', type: 'number', min: 8, max: 64, step: 1, default: 32, advanced: true },
  { key: 'velocityDecay', label: 'Velocity Decay', section: 'Simulation', description: 'Source MouseForce damping constant. Lower values make currents fade faster.', type: 'number', min: 0.94, max: 1, step: 0.0005, default: 0.999, advanced: true },
  { key: 'particleDrag', label: 'Particle Drag', section: 'Simulation', description: 'Source particle velocity coupling. 1 tracks the flow field exactly.', type: 'number', min: 0.05, max: 1, step: 0.01, default: 1, advanced: true },
  { key: 'forceRadius', label: 'Force Radius', section: 'Input', description: 'Source mouse-force radius in simulation space.', type: 'number', min: 0.004, max: 0.06, step: 0.001, default: 0.015, advanced: true },
  { key: 'forceTaper', label: 'Force Taper', section: 'Input', description: 'Source line-segment taper. 0.6 matches the reference shader.', type: 'number', min: 0, max: 1, step: 0.01, default: 0.6, advanced: true },
  { key: 'forceStrength', label: 'Force Strength', section: 'Input', description: 'Multiplier on the source mouse target velocity. 1 matches the reference.', type: 'number', min: 0.1, max: 3, step: 0.05, default: 1, advanced: true },
  { key: 'pointSize', label: 'Point Size', section: 'Rendering', description: 'Source particle point size is 1.', type: 'number', min: 1, max: 4, step: 0.25, default: 1 },
  { key: 'colorSpeedScale', label: 'Color Speed Scale', section: 'Rendering', description: 'Source motion-color speed scale. 4 matches the reference shader.', type: 'number', min: 0.5, max: 12, step: 0.25, default: 4, advanced: true },
];

export const PARTICLE_FLUID_DEFAULTS: Record<string, unknown> = {
  maxParticles: 262144,
  fieldCellSize: 4,
  simulationScale: 1,
  solverIterations: 18,
  cellSize: 32,
  velocityDecay: 0.999,
  particleDrag: 1,
  forceRadius: 0.015,
  forceTaper: 0.6,
  forceStrength: 1,
  pointSize: 1,
  colorSpeedScale: 4,
};
