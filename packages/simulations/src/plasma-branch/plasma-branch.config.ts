import type { SettingsField } from '@hooksjam/pixi-lab-core';

export const PLASMA_BRANCH_SETTINGS_FIELDS: SettingsField[] = [
  { key: 'maxBranches', label: 'Max Branches', type: 'number', min: 80, max: 420, step: 20, default: 220 },
  { key: 'fieldColumns', label: 'Charge Field Columns', type: 'number', min: 32, max: 128, step: 8, default: 72 },
  { key: 'chargeDecay', label: 'Charge Persistence', type: 'number', min: 0.94, max: 0.995, step: 0.002, default: 0.982 },
  { key: 'branchEnergy', label: 'Discharge Energy', type: 'number', min: 0.4, max: 1.6, step: 0.05, default: 0.95 },
];

export const PLASMA_BRANCH_DEFAULTS: Record<string, unknown> = {
  maxBranches: 220,
  fieldColumns: 72,
  chargeDecay: 0.982,
  branchEnergy: 0.95,
  style: 'lightning-garden',
  debug: false,
  screensaverMs: 60_000,
};
