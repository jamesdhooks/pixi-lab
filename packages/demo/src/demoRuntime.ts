import {
  formatRenderBackendProfileSelection,
  getSupportedRenderQualityModes,
  isDefaultRenderBackendProfileSelection,
  isRenderQuality,
  LEGACY_RENDER_QUALITY_STORAGE_KEY,
  RENDER_SELECTION_STORAGE_KEY,
  resolveRenderBackendProfileQuerySelection,
  serializeRenderBackendProfileStorage,
  serializeRenderBackendProfileRoute,
  type LabExperience,
  type RenderBackendProfileSelection,
  type RenderQuality,
} from '@hooksjam/pixi-lab-core';

export function parseQueryQuality(value: string | null): RenderQuality | undefined {
  return isRenderQuality(value) ? value : undefined;
}

export function findQueryExperience(value: string | null, experiences: readonly LabExperience[]): LabExperience | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return undefined;
  return experiences.find((experience) => experience.id.toLowerCase() === normalized);
}

export function queryRenderSelectionForExperience(
  experience: LabExperience,
  params: Pick<URLSearchParams, 'get'>,
): RenderBackendProfileSelection | undefined {
  const backend = params.get('backend');
  const profile = params.get('profile');
  const requestedQuality = parseQueryQuality(params.get('quality'));

  if (!backend && !profile && !requestedQuality) return undefined;

  const supported = getSupportedRenderQualityModes(experience.capabilities);
  return resolveRenderBackendProfileQuerySelection(
    { backend, profile, quality: requestedQuality },
    supported,
  );
}

export function queryQualityForExperience(
  experience: LabExperience,
  params: Pick<URLSearchParams, 'get'>,
): RenderQuality | undefined {
  return queryRenderSelectionForExperience(experience, params)?.legacyQuality;
}

export function writeCompatibilityRenderSelection(
  selection: RenderBackendProfileSelection,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(LEGACY_RENDER_QUALITY_STORAGE_KEY, selection.legacyQuality);
  storage.setItem(
    RENDER_SELECTION_STORAGE_KEY,
    JSON.stringify(serializeRenderBackendProfileStorage(selection)),
  );
}

export function applyCompatibilityRouteRenderSelection(
  experience: LabExperience,
  params: Pick<URLSearchParams, 'get'>,
  storage: Pick<Storage, 'setItem'> = localStorage,
): RenderBackendProfileSelection | undefined {
  const selection = queryRenderSelectionForExperience(experience, params);
  if (!selection) return undefined;

  writeCompatibilityRenderSelection(selection, storage);
  return selection;
}

export interface ExperienceRuntimeViewModel {
  readonly label: string;
  readonly backendProfileRoute: string | null;
}

export function shouldExposeExperienceBackendProfileRoute(selection: RenderBackendProfileSelection): boolean {
  return !isDefaultRenderBackendProfileSelection(selection);
}

export function buildExperienceBackendProfileRoute(
  experience: LabExperience,
  selection: RenderBackendProfileSelection,
): string {
  const params = new URLSearchParams({ experience: experience.id });

  if (shouldExposeExperienceBackendProfileRoute(selection)) {
    const routeParams = serializeRenderBackendProfileRoute(selection);
    const backend = routeParams.backend ?? selection.backend;
    const profile = routeParams.profile ?? selection.profile;

    if (backend) params.set('backend', backend);
    if (profile) params.set('profile', profile);
  }

  return `?${params.toString()}`;
}

export function buildExperienceRuntimeViewModel(
  experience: LabExperience,
  selection: RenderBackendProfileSelection,
): ExperienceRuntimeViewModel {
  return {
    label: formatRenderBackendProfileSelection(selection).summary,
    backendProfileRoute: shouldExposeExperienceBackendProfileRoute(selection)
      ? buildExperienceBackendProfileRoute(experience, selection)
      : null,
  };
}
