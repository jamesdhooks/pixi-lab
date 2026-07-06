import type { LabExperience } from '../LabExperience.js';
import type { SettingsField, SettingsValue } from '../types.js';

export const SIMULATION_TIME_SCALE_SETTING_KEY = 'timeScale';

export const SIMULATION_TIME_SCALE_FIELD: SettingsField = {
  key: SIMULATION_TIME_SCALE_SETTING_KEY,
  label: 'Timescale',
  section: 'Simulation',
  type: 'number',
  min: 0,
  max: 2,
  step: 0.05,
  default: 1,
};

export function simulationTimeScaleFromSettings(settings: Record<string, unknown>): number {
  const value = settings[SIMULATION_TIME_SCALE_SETTING_KEY];
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : SIMULATION_TIME_SCALE_FIELD.default;
  return Math.max(0, Math.min(2, Number(numeric)));
}

export function withCommonSimulationSettings(definition: LabExperience): SettingsField[] {
  const fields = withConfigDefaults(definition.settingsFields ?? [], definition.configDefaults);
  if (definition.kind !== 'simulation') return fields;
  if (fields.some((field) => field.key === SIMULATION_TIME_SCALE_SETTING_KEY)) return fields;
  return [withConfigDefault(SIMULATION_TIME_SCALE_FIELD, definition.configDefaults), ...fields];
}

function withConfigDefaults(fields: readonly SettingsField[], configDefaults: Record<string, unknown> | undefined): SettingsField[] {
  return fields.map((field) => withConfigDefault(field, configDefaults));
}

function withConfigDefault(field: SettingsField, configDefaults: Record<string, unknown> | undefined): SettingsField {
  if (!configDefaults || !Object.prototype.hasOwnProperty.call(configDefaults, field.key)) return { ...field };
  return { ...field, default: sanitizeConfigDefault(field, configDefaults[field.key]) };
}

function sanitizeConfigDefault(field: SettingsField, value: unknown): SettingsValue {
  if (field.type === 'number') {
    const numeric = typeof value === 'number' && Number.isFinite(value) ? value : Number(field.default);
    return Math.max(field.min ?? -Infinity, Math.min(field.max ?? Infinity, Number.isFinite(numeric) ? numeric : 0));
  }
  if (field.type === 'boolean') return typeof value === 'boolean' ? value : Boolean(field.default);
  if (field.type === 'select') {
    const stringValue = typeof value === 'string' ? value : String(field.default ?? '');
    if (!field.options?.length || field.options.some((option) => option.value === stringValue)) return stringValue;
    return field.options[0]?.value ?? String(field.default ?? '');
  }
  return typeof value === 'string' ? value : String(field.default ?? '');
}
