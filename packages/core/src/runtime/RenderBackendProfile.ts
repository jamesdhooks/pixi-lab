import type { EngineConfiguration, RenderProfile, RenderQuality, RendererBackend } from '../types.js';

const RENDERER_BACKENDS: readonly RendererBackend[] = ['pixi', 'webgl2', 'three', 'webgpu'];
const RENDER_PROFILES: readonly RenderProfile[] = ['preview', 'standard', 'high'];

export const DEFAULT_RENDER_QUALITY_MODES: readonly RenderQuality[] = ['basic', 'enhanced'];
export const LEGACY_RENDER_QUALITY_STORAGE_KEY = 'pixi-lab:quality';
export const RENDER_SELECTION_STORAGE_KEY = 'pixi-lab:renderSelection';

export interface RenderBackendProfileCandidate {
  readonly quality: RenderQuality;
  readonly backend: RendererBackend;
  readonly profile: RenderProfile;
  readonly legacyLabel: string;
}

export interface RenderBackendProfileGroup {
  readonly backend: RendererBackend;
  readonly candidates: readonly RenderBackendProfileCandidate[];
}

export interface RenderBackendProfileSelection {
  readonly backend: RendererBackend;
  readonly profile: RenderProfile;
  readonly legacyQuality: RenderQuality;
}

export interface RenderBackendProfileSelectionLabel {
  readonly backendLabel: string;
  readonly profileLabel: string;
  readonly summary: string;
}

export interface RenderBackendProfileQueryRequest {
  readonly backend?: unknown;
  readonly profile?: unknown;
  readonly quality?: unknown;
}

export interface RenderBackendProfileRouteParams {
  readonly backend?: RendererBackend;
  readonly profile?: RenderProfile;
  readonly quality?: RenderQuality;
}

export interface RenderBackendProfileStorageSnapshot {
  readonly backend?: RendererBackend;
  readonly profile?: RenderProfile;
  readonly quality?: RenderQuality;
}

export interface SerializeRenderBackendProfileRouteOptions {
  /**
   * Keep the legacy `quality` param alongside backend/profile params for
   * compatibility links. Public/demo default routes can leave this disabled and
   * continue serializing only `quality` elsewhere.
   */
  readonly includeLegacyQuality?: boolean;
}

const LEGACY_QUALITY_CANDIDATES: Record<RenderQuality, RenderBackendProfileCandidate> = {
  basic: {
    quality: 'basic',
    backend: 'pixi',
    profile: 'standard',
    legacyLabel: 'Basic',
  },
  enhanced: {
    quality: 'enhanced',
    backend: 'pixi',
    profile: 'high',
    legacyLabel: 'Enhanced',
  },
  raw: {
    quality: 'raw',
    backend: 'webgl2',
    profile: 'high',
    legacyLabel: 'Raw',
  },
};

const RENDERER_BACKEND_LABELS: Record<RendererBackend, string> = {
  pixi: 'PixiJS',
  webgl2: 'WebGL2',
  three: 'Three.js',
  webgpu: 'WebGPU',
};

const RENDER_PROFILE_LABELS: Record<RenderProfile, string> = {
  preview: 'Preview',
  standard: 'Standard',
  high: 'High',
};

export function toRenderBackendProfileCandidate(quality: RenderQuality): RenderBackendProfileCandidate {
  return LEGACY_QUALITY_CANDIDATES[quality];
}

export function isRendererBackend(value: unknown): value is RendererBackend {
  return typeof value === 'string' && RENDERER_BACKENDS.includes(value as RendererBackend);
}

export function isRenderProfile(value: unknown): value is RenderProfile {
  return typeof value === 'string' && RENDER_PROFILES.includes(value as RenderProfile);
}

export function isRenderQuality(value: unknown): value is RenderQuality {
  return typeof value === 'string' && value in LEGACY_QUALITY_CANDIDATES;
}

export function mapQualityModesToBackendProfiles(
  qualityModes: readonly RenderQuality[],
): RenderBackendProfileCandidate[] {
  return qualityModes.map(toRenderBackendProfileCandidate);
}

export interface CreateEngineConfigurationsOptions {
  readonly rawBackend?: RendererBackend;
}

export function toEngineConfiguration(
  quality: RenderQuality,
  options: CreateEngineConfigurationsOptions = {},
): EngineConfiguration {
  const candidate = toRenderBackendProfileCandidate(quality);
  const backend = quality === 'raw' && options.rawBackend ? options.rawBackend : candidate.backend;
  const label = formatRenderBackendProfileSelection({
    backend,
    profile: candidate.profile,
    legacyQuality: quality,
  });

  return {
    id: quality,
    backend,
    profile: candidate.profile,
    label: `${label.summary} · ${candidate.legacyLabel}`,
    legacyQuality: quality,
  };
}

export function createEngineConfigurations(
  qualityModes: readonly RenderQuality[],
  options: CreateEngineConfigurationsOptions = {},
): EngineConfiguration[] {
  return qualityModes.map((quality) => toEngineConfiguration(quality, options));
}

export function getSupportedEngineConfigurations(
  capabilities: {
    readonly engineConfigurations?: readonly EngineConfiguration[];
    readonly qualityModes?: readonly RenderQuality[];
  } | undefined,
): readonly EngineConfiguration[] {
  if (capabilities?.engineConfigurations && capabilities.engineConfigurations.length > 0) {
    return capabilities.engineConfigurations;
  }

  return getSupportedRenderQualityModes(capabilities).map((quality) => toEngineConfiguration(quality));
}

export function getSupportedRenderQualityModes(
  capabilities: {
    readonly engineConfigurations?: readonly EngineConfiguration[];
    readonly qualityModes?: readonly RenderQuality[];
  } | undefined,
): readonly RenderQuality[] {
  if (capabilities?.engineConfigurations && capabilities.engineConfigurations.length > 0) {
    return capabilities.engineConfigurations.map((configuration) => configuration.legacyQuality);
  }

  return capabilities?.qualityModes && capabilities.qualityModes.length > 0
    ? capabilities.qualityModes
    : DEFAULT_RENDER_QUALITY_MODES;
}

export function groupBackendProfileCandidates(
  candidates: readonly RenderBackendProfileCandidate[],
): RenderBackendProfileGroup[] {
  const groups: RenderBackendProfileGroup[] = [];

  for (const candidate of candidates) {
    const existingGroup = groups.find((group) => group.backend === candidate.backend);
    if (existingGroup) {
      groups[groups.indexOf(existingGroup)] = {
        backend: existingGroup.backend,
        candidates: [...existingGroup.candidates, candidate],
      };
    } else {
      groups.push({ backend: candidate.backend, candidates: [candidate] });
    }
  }

  return groups;
}

export function groupQualityModesByBackend(
  qualityModes: readonly RenderQuality[],
): RenderBackendProfileGroup[] {
  return groupBackendProfileCandidates(mapQualityModesToBackendProfiles(qualityModes));
}

export function sanitizeLegacyRenderQuality(
  requestedQuality: RenderQuality | undefined,
  supportedQualityModes: readonly RenderQuality[],
  fallbackQuality: RenderQuality = 'basic',
): RenderQuality {
  if (requestedQuality && supportedQualityModes.includes(requestedQuality)) {
    return requestedQuality;
  }

  if (supportedQualityModes.includes(fallbackQuality)) {
    return fallbackQuality;
  }

  return supportedQualityModes[0] ?? fallbackQuality;
}

export function resolveRenderBackendProfileSelection(
  requestedQuality: RenderQuality | undefined,
  supportedQualityModes: readonly RenderQuality[],
  fallbackQuality: RenderQuality = 'basic',
): RenderBackendProfileSelection {
  const legacyQuality = sanitizeLegacyRenderQuality(
    requestedQuality,
    supportedQualityModes,
    fallbackQuality,
  );
  const candidate = toRenderBackendProfileCandidate(legacyQuality);

  return {
    backend: candidate.backend,
    profile: candidate.profile,
    legacyQuality,
  };
}

export function resolveRenderBackendProfileQuerySelection(
  request: RenderBackendProfileQueryRequest,
  supportedQualityModes: readonly RenderQuality[],
  fallbackQuality: RenderQuality = 'basic',
): RenderBackendProfileSelection {
  const requestedBackend = isRendererBackend(request.backend) ? request.backend : undefined;
  const requestedProfile = isRenderProfile(request.profile) ? request.profile : undefined;

  if (requestedBackend && requestedProfile) {
    const backendProfileMatch = mapQualityModesToBackendProfiles(supportedQualityModes).find(
      (candidate) => candidate.backend === requestedBackend && candidate.profile === requestedProfile,
    );

    if (backendProfileMatch) {
      return {
        backend: backendProfileMatch.backend,
        profile: backendProfileMatch.profile,
        legacyQuality: backendProfileMatch.quality,
      };
    }
  }

  const requestedQuality = isRenderQuality(request.quality) ? request.quality : undefined;

  return resolveRenderBackendProfileSelection(
    requestedQuality,
    supportedQualityModes,
    fallbackQuality,
  );
}

export function formatRenderBackendProfileSelection(
  selection: RenderBackendProfileSelection,
): RenderBackendProfileSelectionLabel {
  const backendLabel = RENDERER_BACKEND_LABELS[selection.backend];
  const profileLabel = RENDER_PROFILE_LABELS[selection.profile];

  return {
    backendLabel,
    profileLabel,
    summary: `${backendLabel} / ${profileLabel}`,
  };
}

export function isDefaultRenderBackendProfileSelection(
  selection: RenderBackendProfileSelection,
): boolean {
  return selection.backend === 'pixi' && selection.profile === 'standard';
}

export function serializeRenderBackendProfileRoute(
  selection: RenderBackendProfileSelection,
  options: SerializeRenderBackendProfileRouteOptions = {},
): RenderBackendProfileRouteParams {
  return {
    backend: selection.backend,
    profile: selection.profile,
    ...(options.includeLegacyQuality ? { quality: selection.legacyQuality } : {}),
  };
}

export function serializeRenderBackendProfileStorage(
  selection: RenderBackendProfileSelection,
): RenderBackendProfileStorageSnapshot {
  return {
    backend: selection.backend,
    profile: selection.profile,
    quality: selection.legacyQuality,
  };
}

export function parseRenderBackendProfileStorage(
  value: unknown,
): RenderBackendProfileStorageSnapshot | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return {
    ...(isRendererBackend(record.backend) ? { backend: record.backend } : {}),
    ...(isRenderProfile(record.profile) ? { profile: record.profile } : {}),
    ...(isRenderQuality(record.quality) ? { quality: record.quality } : {}),
  };
}

export function resolveRenderBackendProfileStorageSelection(
  storedSelection: RenderBackendProfileStorageSnapshot | undefined,
  supportedQualityModes: readonly RenderQuality[],
  fallbackQuality: RenderQuality = 'basic',
): RenderBackendProfileSelection {
  return resolveRenderBackendProfileQuerySelection(
    {
      backend: storedSelection?.backend,
      profile: storedSelection?.profile,
      quality: storedSelection?.quality,
    },
    supportedQualityModes,
    fallbackQuality,
  );
}

