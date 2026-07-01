import {
  getSupportedEngineConfigurations,
  createEngineConfigurations,
  isRenderQuality,
  parseRenderBackendProfileStorage,
  resolveEngineConfigurationQuerySelection,
  resolveEngineConfigurationStorageSelection,
  type EngineConfiguration,
  type ExperienceCapabilities,
  type RenderBackendProfileSelection,
  type RenderQuality,
} from '@hooksjam/pixi-lab-core';

export { isRenderQuality } from '@hooksjam/pixi-lab-core';

export type EngineConfigurationSupport =
  | ExperienceCapabilities
  | readonly EngineConfiguration[]
  | readonly RenderQuality[]
  | undefined;

function isEngineConfigurationArray(value: EngineConfigurationSupport): value is readonly EngineConfiguration[] {
  return Array.isArray(value) && !value.every(isRenderQuality);
}

function isLegacyQualityArray(value: EngineConfigurationSupport): value is readonly RenderQuality[] {
  return Array.isArray(value) && value.every(isRenderQuality);
}

function getEngineConfigurationSupport(support: EngineConfigurationSupport) {
  if (isLegacyQualityArray(support)) {
    return getSupportedEngineConfigurations({
      engineConfigurations: createEngineConfigurations(support as readonly RenderQuality[]),
    });
  }

  if (isEngineConfigurationArray(support)) {
    return getSupportedEngineConfigurations({ engineConfigurations: support });
  }

  return getSupportedEngineConfigurations(support as ExperienceCapabilities | undefined);
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
  return resolveEngineConfigurationQuerySelection(
    { quality: isRenderQuality(requested) ? requested : undefined },
    getEngineConfigurationSupport(support),
  );
}

export function resolveStoredRenderSelection(
  storedSelection: unknown,
  storedQuality: string | null,
  support: EngineConfigurationSupport,
): RenderBackendProfileSelection {
  const parsedSelection = parseRenderBackendProfileStorage(storedSelection);
  const fallbackQuality = isRenderQuality(storedQuality) ? storedQuality : undefined;
  if (parsedSelection) {
    return resolveEngineConfigurationStorageSelection(
      parsedSelection,
      getEngineConfigurationSupport(support),
      fallbackQuality,
    );
  }

  return resolveRenderSelection(storedQuality, support);
}
