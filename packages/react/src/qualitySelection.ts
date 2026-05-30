import type { RenderQuality } from '@hooksjam/pixi-lab-core';

const VALID_RENDER_QUALITIES: readonly RenderQuality[] = ['basic', 'enhanced', 'raw'];

export function isRenderQuality(value: unknown): value is RenderQuality {
  return typeof value === 'string' && VALID_RENDER_QUALITIES.includes(value as RenderQuality);
}

export function sanitizeRenderQuality(
  requested: unknown,
  supportedModes: readonly RenderQuality[] | undefined,
): RenderQuality {
  const fallbackModes: readonly RenderQuality[] = ['basic'];
  const supported = supportedModes && supportedModes.length > 0 ? supportedModes : fallbackModes;
  if (isRenderQuality(requested) && supported.includes(requested)) return requested;
  return supported.includes('basic') ? 'basic' : supported[0] ?? 'basic';
}
