import {
  resolveRenderBackendProfileSelection,
  type RenderBackendProfileSelection,
  type RenderQuality,
} from '@hooksjam/pixi-lab-core';

const VALID_RENDER_QUALITIES: readonly RenderQuality[] = ['basic', 'enhanced', 'raw'];

export function isRenderQuality(value: unknown): value is RenderQuality {
  return typeof value === 'string' && VALID_RENDER_QUALITIES.includes(value as RenderQuality);
}

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
  const fallbackModes: readonly RenderQuality[] = ['basic'];
  const supported = supportedModes && supportedModes.length > 0 ? supportedModes : fallbackModes;
  return resolveRenderBackendProfileSelection(isRenderQuality(requested) ? requested : undefined, supported);
}
