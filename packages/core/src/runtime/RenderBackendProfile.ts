import type { RenderProfile, RenderQuality, RendererBackend } from '../types.js';

const RENDERER_BACKENDS: readonly RendererBackend[] = ['pixi', 'webgl2', 'three', 'webgpu'];
const RENDER_PROFILES: readonly RenderProfile[] = ['preview', 'standard', 'high'];

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

export interface RenderBackendProfileQueryRequest {
  readonly backend?: unknown;
  readonly profile?: unknown;
  readonly quality?: unknown;
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

export function toRenderBackendProfileCandidate(quality: RenderQuality): RenderBackendProfileCandidate {
  return LEGACY_QUALITY_CANDIDATES[quality];
}

export function isRendererBackend(value: unknown): value is RendererBackend {
  return typeof value === 'string' && RENDERER_BACKENDS.includes(value as RendererBackend);
}

export function isRenderProfile(value: unknown): value is RenderProfile {
  return typeof value === 'string' && RENDER_PROFILES.includes(value as RenderProfile);
}

export function mapQualityModesToBackendProfiles(
  qualityModes: readonly RenderQuality[],
): RenderBackendProfileCandidate[] {
  return qualityModes.map(toRenderBackendProfileCandidate);
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

  const requestedQuality = typeof request.quality === 'string' ? request.quality : undefined;

  return resolveRenderBackendProfileSelection(
    requestedQuality && requestedQuality in LEGACY_QUALITY_CANDIDATES
      ? (requestedQuality as RenderQuality)
      : undefined,
    supportedQualityModes,
    fallbackQuality,
  );
}
