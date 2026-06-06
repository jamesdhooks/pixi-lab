import {
  getSupportedEngineConfigurations,
  isRenderQuality,
  parseRenderBackendProfileStorage,
  resolveEngineConfigurationQuerySelection,
  resolveEngineConfigurationStorageSelection,
  type ExperienceCapabilities,
  type RenderBackendProfileSelection,
  type RenderQuality,
} from '@hooksjam/pixi-lab-core';

export { isRenderQuality } from '@hooksjam/pixi-lab-core';

type EngineConfigurationSupport = ExperienceCapabilities | readonly RenderQuality[] | undefined;

function isRenderQualityArray(value: EngineConfigurationSupport): value is readonly RenderQuality[] {
  return Array.isArray(value);
}

function getEngineConfigurationSupport(support: EngineConfigurationSupport) {
  return isRenderQualityArray(support)
    ? getSupportedEngineConfigurations({ qualityModes: support })
    : getSupportedEngineConfigurations(support as ExperienceCapabilities | undefined);
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

