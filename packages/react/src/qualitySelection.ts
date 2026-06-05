import {
  getSupportedRenderQualityModes,
  isRenderQuality,
  resolveRenderBackendProfileSelection,
  type RenderBackendProfileSelection,
  type RenderQuality,
} from '@hooksjam/pixi-lab-core';

export { isRenderQuality } from '@hooksjam/pixi-lab-core';

export function sanitizeRenderQuality(
  requested: unknown,
  supportedModes: readonly RenderQuality[] | undefined,
): RenderQuality {
  return resolveRenderSelection(requested, supportedModes).legacyQuality;
}

export function resolveRenderSelection(
  requested: unknown,
  supportedModes: readonly RenderQuality[] | undefined,
): RenderBackendProfileSelection {
  const supported = getSupportedRenderQualityModes({ qualityModes: supportedModes });
  return resolveRenderBackendProfileSelection(isRenderQuality(requested) ? requested : undefined, supported);
}
