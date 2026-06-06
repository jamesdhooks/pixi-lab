import {
  getSupportedRenderQualityModes,
  isRenderQuality,
  parseRenderBackendProfileStorage,
  resolveRenderBackendProfileSelection,
  resolveRenderBackendProfileStorageSelection,
  type ExperienceCapabilities,
  type RenderBackendProfileSelection,
  type RenderQuality,
} from '@hooksjam/pixi-lab-core';

export { isRenderQuality } from '@hooksjam/pixi-lab-core';

type EngineConfigurationSupport = ExperienceCapabilities | readonly RenderQuality[] | undefined;

function isRenderQualityArray(value: EngineConfigurationSupport): value is readonly RenderQuality[] {
  return Array.isArray(value);
}

function getSupportedModes(support: EngineConfigurationSupport): readonly RenderQuality[] {
  if (isRenderQualityArray(support)) return support;
  return getSupportedRenderQualityModes(support as ExperienceCapabilities | undefined);
}

export function sanitizeRenderQuality(
  requested: unknown,
  support: EngineConfigurationSupport,
): RenderQuality {
  return resolveRenderSelection(requested, support).legacyQuality;
}

export function resolveRenderSelection(
  requested: unknown,
  support: EngineConfigurationSupport,
): RenderBackendProfileSelection {
  const supported = getSupportedModes(support);
  return resolveRenderBackendProfileSelection(isRenderQuality(requested) ? requested : undefined, supported);
}

export function resolveStoredRenderSelection(
  storedSelection: unknown,
  storedQuality: string | null,
  support: EngineConfigurationSupport,
): RenderBackendProfileSelection {
  const parsedSelection = parseRenderBackendProfileStorage(storedSelection);
  if (parsedSelection) {
    const supported = getSupportedModes(support);
    return resolveRenderBackendProfileStorageSelection(parsedSelection, supported);
  }

  return resolveRenderSelection(storedQuality, support);
}

