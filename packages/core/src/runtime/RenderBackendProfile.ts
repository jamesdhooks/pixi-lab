import type { RenderProfile, RenderQuality, RendererBackend } from '../types.js';

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
