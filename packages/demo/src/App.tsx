import { useState, useMemo, useRef, useLayoutEffect, useEffect, useCallback, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, PanelLeft, PanelBottom, PanelRight, Pin, PinOff, Play } from 'lucide-react';
import { GameLauncher, PreviewTile } from '@hooksjam/pixi-lab-react';
import { useViewport } from '@hooksjam/pixi-lab-react';
import { AMBIENT_REGISTRY } from '@hooksjam/pixi-lab-ambients';
import { GAME_REGISTRY } from '@hooksjam/pixi-lab-games';
import { SIMULATION_REGISTRY, fluidTankDefinition } from '@hooksjam/pixi-lab-simulations';
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
import { hasPassedDemoQa } from './demoQaStatus';

const ALL_EXPERIENCES: readonly LabExperience[] = [
  ...GAME_REGISTRY,
  ...SIMULATION_REGISTRY,
  ...AMBIENT_REGISTRY,
];
const APP_DEMO_INTERVAL_MS = 10_000;
const APP_DEMO_CROSSFADE_MS = 220;
const APP_DEMO_PRELOAD_MAX_PIXELS = 147_456;

type DemoStageSlot = 'a' | 'b';

type FilterKind = 'all' | 'overlays' | LabExperience['kind'];

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

const KIND_LABELS: Record<string, string> = {
  all: 'All',
  game: 'Games',
  simulation: 'Simulations',
  overlays: 'Overlays',
  toy: 'Toys',
};

const KIND_BADGE: Record<string, string> = {
  game:       'bg-blue-100   text-blue-600   dark:bg-blue-500/15   dark:text-blue-300',
  simulation: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  ambient:    'bg-teal-100   text-teal-600   dark:bg-teal-500/15   dark:text-teal-300',
  effect:     'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300',
  toy:        'bg-pink-100   text-pink-600   dark:bg-pink-500/15   dark:text-pink-300',
};

// [sizeRem, hexColor, cssLeft, cssTop, driftPx, durationSec, delaySec]
const LOGO_PARTICLES: Array<[number, string, string, string, number, number, number]> = [
  [0.55, '#a78bfa', '15%',   '30%',  10, 3.2, 0.0],
  [0.38, '#38bdf8', '85%',   '25%',   8, 2.8, 0.6],
  [0.60, '#818cf8', '18%',   '72%',  12, 3.5, 1.1],
  [0.32, '#f472b6', '82%',   '68%',   9, 2.6, 0.3],
  [0.44, '#34d399', '20%',   '15%',   7, 3.0, 1.7],
  [0.34, '#60a5fa', '80%',   '20%',   9, 2.9, 0.9],
  [0.28, '#c084fc', '22%',   '80%',   8, 3.3, 1.4],
  [0.42, '#fb923c', '78%',   '65%',   6, 3.6, 0.5],
];

export function App() {
  const { isMobile, isLandscape } = useViewport();
  const [active, setActive] = useState<LabExperience | null>(null);
  const [filter, setFilter] = useState<FilterKind>('all');
  const [dark, setDark] = useState(true);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselFilter, setCarouselFilter] = useState<FilterKind>('all');
  const [carouselSide, setCarouselSide] = useState<'bottom' | 'left' | 'right'>('bottom');
  const [carouselDocked, setCarouselDocked] = useState(false);
  const [renderSelection, setRenderSelection] = useState<RenderBackendProfileSelection | null>(null);
  const [appDemoActive, setAppDemoActive] = useState(false);
  const [appDemoIndex, setAppDemoIndex] = useState(0);
  const [appDemoFrontSlot, setAppDemoFrontSlot] = useState<DemoStageSlot>('a');
  const [appDemoPendingSlot, setAppDemoPendingSlot] = useState<DemoStageSlot | null>(null);
  const [appDemoCrossfading, setAppDemoCrossfading] = useState(false);
  const [appDemoStageA, setAppDemoStageA] = useState<LabExperience | null>(null);
  const [appDemoStageB, setAppDemoStageB] = useState<LabExperience | null>(null);
  const [appDemoStageReady, setAppDemoStageReady] = useState<Record<DemoStageSlot, boolean>>({
    a: false,
    b: false,
  });
  const [maxPixels] = useState(() => {
    try { return parseInt(localStorage.getItem('pixi-lab:maxPixels') ?? '0') || undefined; } catch { return undefined; }
  });
  const routeMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      fluidGallery: params.has('fluidGallery'),
      fluidEngine: params.has('fluidEngine'),
      fluidReference: params.has('fluidReference'),
      experience: findQueryExperience(params.get('experience'), ALL_EXPERIENCES),
      queryParams: params,
    };
  }, []);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const effectiveCarouselSide = isMobile && !isLandscape ? 'bottom' : carouselSide;

  // Persist maxPixels to localStorage
  useEffect(() => {
    try { localStorage.setItem('pixi-lab:maxPixels', String(maxPixels || '')); } catch {}
  }, [maxPixels]);

  useEffect(() => {
    setRenderSelection(null);
  }, [active?.id]);

  useEffect(() => {
    if (routeMode.fluidGallery) return;
    if (routeMode.fluidEngine || routeMode.fluidReference) {
      const fluidSelection = queryRenderSelectionForExperience(fluidTankDefinition, routeMode.queryParams);
      if (fluidSelection) {
        try { writeCompatibilityRenderSelection(fluidSelection); } catch { /* ignore */ }
      }
      setAppDemoActive(false);
      setCarouselOpen(false);
      setCarouselDocked(false);
      setActive(fluidTankDefinition);
      return;
    }
    if (routeMode.experience) {
      setAppDemoActive(false);
      setCarouselOpen(false);
      setCarouselDocked(false);
      setActive(routeMode.experience);
    }
  }, [routeMode]);


  const availableKinds = useMemo<FilterKind[]>(() => {
    const seen = new Set<LabExperience['kind']>();
    for (const e of ALL_EXPERIENCES) seen.add(e.kind);
    const kinds: FilterKind[] = ['all'];
    let overlaysAdded = false;
    for (const kind of Array.from(seen)) {
      if (kind === 'ambient' || kind === 'effect') {
        if (!overlaysAdded) { kinds.push('overlays'); overlaysAdded = true; }
      } else {
        kinds.push(kind);
      }
    }
    return kinds;
  }, []);

  const filtered = useMemo(
    () => {
      if (routeMode.fluidGallery) return [fluidTankDefinition];
      return filter === 'all'
        ? ALL_EXPERIENCES
        : filter === 'overlays'
          ? ALL_EXPERIENCES.filter((e) => e.kind === 'ambient' || e.kind === 'effect')
          : ALL_EXPERIENCES.filter((e) => e.kind === filter);
    },
    [filter, routeMode.fluidGallery],
  );

  const carouselItems = useMemo(
    () =>
      carouselFilter === 'all'
        ? ALL_EXPERIENCES
        : carouselFilter === 'overlays'
          ? ALL_EXPERIENCES.filter((e) => e.kind === 'ambient' || e.kind === 'effect')
          : ALL_EXPERIENCES.filter((e) => e.kind === carouselFilter),
    [carouselFilter],
  );

  const appDemoItems = useMemo(
    () => ALL_EXPERIENCES.filter((e) => e.capabilities.demo),
    [],
  );

  const appDemoPreloadMaxPixels = useMemo(
    () => (maxPixels === undefined ? APP_DEMO_PRELOAD_MAX_PIXELS : Math.min(maxPixels, APP_DEMO_PRELOAD_MAX_PIXELS)),
    [maxPixels],
  );

  const appDemoCurrentExperience = appDemoFrontSlot === 'a' ? appDemoStageA : appDemoStageB;
  const appDemoPendingExperience = appDemoPendingSlot === 'a'
    ? appDemoStageA
    : appDemoPendingSlot === 'b'
      ? appDemoStageB
      : null;
  const appDemoVisibleExperience =
    appDemoCrossfading && appDemoPendingExperience ? appDemoPendingExperience : appDemoCurrentExperience;
  const appDemoVisibleReady = appDemoCrossfading && appDemoPendingSlot
    ? appDemoStageReady[appDemoPendingSlot]
    : appDemoStageReady[appDemoFrontSlot];
  const runtimeViewModel = useMemo(
    () => (active && renderSelection ? buildExperienceRuntimeViewModel(active, renderSelection) : null),
    [active, renderSelection],
  );

  const activeCarouselIndex = useMemo(
    () => (active ? carouselItems.findIndex((e) => e.id === active.id) : -1),
    [active, carouselItems],
  );

  /** Scroll a tile into view by operating only on the scroller element itself.
   * Never use scrollIntoView — it walks up and scrolls ALL ancestor containers. */
  const scrollTileIntoView = useCallback((scroller: HTMLDivElement, idx: number) => {
    const tile = scroller.children[idx] as HTMLElement | undefined;
    if (!tile) return;
    const isVertical = scroller.scrollHeight > scroller.clientHeight;
    if (isVertical) {
      const center = tile.offsetTop - (scroller.clientHeight - tile.offsetHeight) / 2;
      scroller.scrollTo({ top: Math.max(0, center), behavior: 'smooth' });
    } else {
      const center = tile.offsetLeft - (scroller.clientWidth - tile.offsetWidth) / 2;
      scroller.scrollTo({ left: Math.max(0, center), behavior: 'smooth' });
    }
  }, []);

  const selectExperience = useCallback((exp: LabExperience, idx: number) => {
    setActive(exp);
    requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      scrollTileIntoView(scroller, idx);
    });
  }, [scrollTileIntoView]);

  const goPrev = useCallback(() => {
    if (!carouselItems.length) return;
    const next = activeCarouselIndex <= 0 ? carouselItems.length - 1 : activeCarouselIndex - 1;
    selectExperience(carouselItems[next], next);
  }, [activeCarouselIndex, carouselItems, selectExperience]);

  const goNext = useCallback(() => {
    if (!carouselItems.length) return;
    const next = (activeCarouselIndex + 1) % carouselItems.length;
    selectExperience(carouselItems[next], next);
  }, [activeCarouselIndex, carouselItems, selectExperience]);

  const setAppDemoStageExperience = useCallback((slot: DemoStageSlot, experience: LabExperience | null) => {
    if (slot === 'a') {
      setAppDemoStageA(experience);
      return;
    }
    setAppDemoStageB(experience);
  }, []);

  const setAppDemoSlotReady = useCallback((slot: DemoStageSlot, ready: boolean) => {
    setAppDemoStageReady((prev) => (prev[slot] === ready ? prev : { ...prev, [slot]: ready }));
  }, []);

  const startAppDemo = useCallback(() => {
    if (appDemoItems.length === 0) return;
    const nextIndex = appDemoItems[appDemoIndex] ? appDemoIndex : 0;
    const nextExperience = appDemoItems[nextIndex];
    setAppDemoActive(true);
    setCarouselOpen(false);
    setCarouselDocked(false);
    setActive(null);
    setAppDemoIndex(nextIndex);
    setAppDemoFrontSlot('a');
    setAppDemoPendingSlot(null);
    setAppDemoCrossfading(false);
    setAppDemoStageA(nextExperience);
    setAppDemoStageB(null);
    setAppDemoStageReady({ a: false, b: false });
  }, [appDemoIndex, appDemoItems]);

  const stopAppDemo = useCallback(() => {
    setAppDemoActive(false);
    setActive(null);
    setCarouselOpen(false);
    setAppDemoFrontSlot('a');
    setAppDemoPendingSlot(null);
    setAppDemoCrossfading(false);
    setAppDemoStageA(null);
    setAppDemoStageB(null);
    setAppDemoStageReady({ a: false, b: false });
  }, []);

  const advanceAppDemo = useCallback(() => {
    if (appDemoItems.length === 0) return;
    setAppDemoIndex((idx) => (idx + 1) % appDemoItems.length);
  }, [appDemoItems.length]);

  const handleAppDemoStageReady = useCallback((slot: DemoStageSlot) => {
    setAppDemoSlotReady(slot, true);
  }, [setAppDemoSlotReady]);

  useEffect(() => {
    if (
      !appDemoActive ||
      appDemoItems.length === 0 ||
      !appDemoCurrentExperience ||
      appDemoPendingSlot !== null ||
      appDemoCrossfading
    ) {
      return;
    }
    const id = window.setTimeout(advanceAppDemo, APP_DEMO_INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [
    advanceAppDemo,
    appDemoActive,
    appDemoCrossfading,
    appDemoCurrentExperience,
    appDemoItems.length,
    appDemoPendingSlot,
  ]);

  useEffect(() => {
    if (!appDemoActive || appDemoItems.length === 0) return;
    const nextExperience = appDemoItems[appDemoIndex % appDemoItems.length];
    if (!appDemoCurrentExperience) {
      setAppDemoFrontSlot('a');
      setAppDemoPendingSlot(null);
      setAppDemoCrossfading(false);
      setAppDemoStageA(nextExperience);
      setAppDemoStageB(null);
      setAppDemoStageReady({ a: false, b: false });
      return;
    }
    if (appDemoCurrentExperience.id === nextExperience.id && appDemoPendingExperience === null) return;
    if (appDemoPendingExperience?.id === nextExperience.id) return;

    const nextSlot: DemoStageSlot = appDemoFrontSlot === 'a' ? 'b' : 'a';
    setAppDemoPendingSlot(nextSlot);
    setAppDemoCrossfading(false);
    setAppDemoStageExperience(nextSlot, nextExperience);
    setAppDemoSlotReady(nextSlot, false);
  }, [
    appDemoActive,
    appDemoCurrentExperience,
    appDemoFrontSlot,
    appDemoIndex,
    appDemoItems,
    appDemoPendingExperience,
    setAppDemoSlotReady,
    setAppDemoStageExperience,
  ]);

  useEffect(() => {
    if (!appDemoPendingSlot || appDemoCrossfading || !appDemoStageReady[appDemoPendingSlot]) return;
    let rafA = 0;
    let rafB = 0;
    rafA = window.requestAnimationFrame(() => {
      rafB = window.requestAnimationFrame(() => {
        setAppDemoCrossfading(true);
      });
    });
    return () => {
      window.cancelAnimationFrame(rafA);
      window.cancelAnimationFrame(rafB);
    };
  }, [appDemoCrossfading, appDemoPendingSlot, appDemoStageReady]);

  useEffect(() => {
    if (!appDemoCrossfading || !appDemoPendingSlot) return;
    const previousFrontSlot = appDemoFrontSlot;
    const nextFrontSlot = appDemoPendingSlot;
    const id = window.setTimeout(() => {
      setAppDemoFrontSlot(nextFrontSlot);
      setAppDemoPendingSlot(null);
      setAppDemoCrossfading(false);
      setAppDemoStageExperience(previousFrontSlot, null);
      setAppDemoSlotReady(previousFrontSlot, false);
    }, APP_DEMO_CROSSFADE_MS);
    return () => window.clearTimeout(id);
  }, [
    appDemoCrossfading,
    appDemoFrontSlot,
    appDemoPendingSlot,
    setAppDemoSlotReady,
    setAppDemoStageExperience,
  ]);

  // Scroll active tile into view when carousel opens
  useEffect(() => {
    if (!carouselOpen || activeCarouselIndex < 0) return;
    requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      scrollTileIntoView(scroller, activeCarouselIndex);
    });
  }, [carouselOpen, activeCarouselIndex, scrollTileIntoView]);

  const isBottom = effectiveCarouselSide === 'bottom';
  const isLeft = effectiveCarouselSide === 'left';
  const panelBorderClass = isBottom ? 'border-t' : isLeft ? 'border-r' : 'border-l';
  const panelPositionClass = isBottom
    ? 'bottom-0 left-0 right-0'
    : isLeft ? 'top-0 left-0 bottom-0 w-[196px]' : 'top-0 right-0 bottom-0 w-[196px]';
  const panelInitialAnim = isBottom ? { y: '100%' } : isLeft ? { x: '-100%' } : { x: '100%' };
  const chevronPositionClass = isBottom
    ? 'bottom-1 left-1/2 -translate-x-1/2 h-8 w-12'
    : isLeft ? 'left-1 top-1/2 -translate-y-1/2 h-12 w-8' : 'right-1 top-1/2 -translate-y-1/2 h-12 w-8';
  const ChevronOpenIcon = isBottom ? ChevronUp : isLeft ? ChevronRight : ChevronLeft;
  const ChevronCloseIcon = isBottom ? ChevronDown : isLeft ? ChevronLeft : ChevronRight;

  // When docked, shrink the experience area to leave real space for the carousel.
  const docked = carouselDocked && carouselOpen;
  const dockedInset = docked
    ? (isBottom ? { bottom: 164 } : isLeft ? { left: 196 } : { right: 196 })
    : {};

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-white dark:bg-[#080810]">

      {appDemoActive && (
        <div className="absolute inset-0 z-50 overflow-hidden bg-black">
          <ExperienceSurface
            experience={appDemoStageA}
            dockedInset={dockedInset}
            maxPixels={
              appDemoPendingSlot === 'a' && !appDemoStageReady.a
                ? appDemoPreloadMaxPixels
                : maxPixels
            }
            autoDemo
            visible={
              !!appDemoStageA &&
              (appDemoFrontSlot === 'a'
                ? !appDemoCrossfading && appDemoStageReady.a
                : appDemoPendingSlot === 'a' && appDemoCrossfading)
            }
            interactive={
              !!appDemoStageA &&
              (appDemoFrontSlot === 'a'
                ? !appDemoCrossfading && appDemoStageReady.a
                : appDemoPendingSlot === 'a' && appDemoCrossfading)
            }
            zIndex={appDemoFrontSlot === 'a' ? 1 : 2}
            onDemoAdvance={advanceAppDemo}
            onDemoExit={stopAppDemo}
            onRuntimeReady={() => handleAppDemoStageReady('a')}
            onQuit={stopAppDemo}
          />
          <ExperienceSurface
            experience={appDemoStageB}
            dockedInset={dockedInset}
            maxPixels={
              appDemoPendingSlot === 'b' && !appDemoStageReady.b
                ? appDemoPreloadMaxPixels
                : maxPixels
            }
            autoDemo
            visible={
              !!appDemoStageB &&
              (appDemoFrontSlot === 'b'
                ? !appDemoCrossfading && appDemoStageReady.b
                : appDemoPendingSlot === 'b' && appDemoCrossfading)
            }
            interactive={
              !!appDemoStageB &&
              (appDemoFrontSlot === 'b'
                ? !appDemoCrossfading && appDemoStageReady.b
                : appDemoPendingSlot === 'b' && appDemoCrossfading)
            }
            zIndex={appDemoFrontSlot === 'b' ? 1 : 2}
            onDemoAdvance={advanceAppDemo}
            onDemoExit={stopAppDemo}
            onRuntimeReady={() => handleAppDemoStageReady('b')}
            onQuit={stopAppDemo}
          />
        </div>
      )}

      {/* ── Experience layer — keyed by id so it fades when switching ── */}
      <AnimatePresence>
        {!appDemoActive && active && (
          <motion.div
            key={active.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="absolute inset-0 overflow-hidden"
          >
            {/* Sample page backdrop for overlay experiences (ambient / effect) */}
            {(active.kind === 'ambient' || active.kind === 'effect') && <OverlayBackdrop />}
            <ExperienceSurface
              experience={active}
              dockedInset={dockedInset}
              maxPixels={maxPixels}
              transparent={active.kind === 'ambient' || active.kind === 'effect'}
              initialQuality={queryQualityForExperience(active, routeMode.queryParams)}
              onRenderSelectionChange={setRenderSelection}
              autoDemo={routeMode.fluidEngine || routeMode.fluidReference}
              onQuit={() => {
                setActive(null);
                setCarouselOpen(false);
              }}
              className="h-full w-full overflow-hidden"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {appDemoActive && appDemoVisibleExperience && appDemoVisibleReady && (
        <div className="pointer-events-none fixed left-3 top-3 z-[70] flex max-w-[72vw] items-center gap-2 rounded-lg bg-black/55 px-2.5 py-2 text-white">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-400 via-sky-300 to-cyan-300 text-base leading-none text-slate-950">
            {appDemoVisibleExperience.icon}
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold leading-tight">{appDemoVisibleExperience.name}</div>
            <div className="bg-gradient-to-r from-violet-300 via-sky-200 to-cyan-200 bg-clip-text text-[9px] font-semibold uppercase leading-tight tracking-wide text-transparent">
              Demo mode
            </div>
          </div>
        </div>
      )}

      {active && !appDemoActive && runtimeViewModel && (
        <div className="pointer-events-none fixed left-3 top-3 z-[70] rounded-lg bg-black/55 px-2.5 py-2 text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-100">
          <div className="text-[9px] text-cyan-200">Lab Runtime</div>
          <div>
            {runtimeViewModel.label}
          </div>
          {runtimeViewModel.backendProfileRoute && (
            <a
              className="pointer-events-auto mt-1 inline-block text-[9px] normal-case tracking-normal text-cyan-200 underline decoration-cyan-200/50 underline-offset-2 hover:text-cyan-100"
              href={runtimeViewModel.backendProfileRoute}
            >
              Backend/profile link
            </a>
          )}
        </div>
      )}

      {/* ── Carousel — outside the experience key so it persists across switches ── */}
      {active && !appDemoActive && (
        <>
          {/* Chevron toggle + render settings — visible when carousel is closed */}
          <AnimatePresence>
            {!carouselOpen && (
              <>
                <motion.button
                  key="chevron-open"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => setCarouselOpen(true)}
                  aria-label="Show experience picker"
                  className={`fixed z-[60] flex items-center justify-center ${chevronPositionClass} text-white/20 transition-colors hover:text-white/50`}
                >
                  <ChevronOpenIcon size={16} />
                </motion.button>

              </>
            )}
          </AnimatePresence>

          {/* Carousel panel */}
          <AnimatePresence>
            {carouselOpen && (
              <motion.div
                key={`carousel-${effectiveCarouselSide}`}
                initial={panelInitialAnim}
                animate={isBottom ? { y: 0 } : { x: 0 }}
                exit={panelInitialAnim}
                transition={{ type: 'spring', stiffness: 400, damping: 40, mass: 0.7 }}
                className={`fixed z-[60] flex flex-col ${panelBorderClass} border-white/10 bg-black/90 backdrop-blur-xl ${panelPositionClass}${isBottom && isMobile && !isLandscape ? ' max-h-[40vh]' : ''}`}
              >
                {/* Header */}
                <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.07] px-3 py-1.5">
                  {isMobile && !isLandscape ? (
                    /* Mobile: filter pills replace the label */
                    <div
                      className="flex flex-1 gap-1 overflow-x-auto"
                      style={{ scrollbarWidth: 'none' }}
                    >
                      {availableKinds.map((kind) => (
                        <button
                          key={kind}
                          onClick={() => setCarouselFilter(kind)}
                          className={[
                            'shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[9px] font-semibold transition-colors',
                            carouselFilter === kind ? 'bg-white/15 text-white' : 'text-white/30 hover:text-white/60',
                          ].join(' ')}
                        >
                          {KIND_LABELS[kind] ?? kind}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="mr-auto text-[10px] font-semibold uppercase tracking-widest text-white/30">
                      Experiences
                    </span>
                  )}
                  {/* Side-picker buttons hidden on portrait mobile */}
                  {(!isMobile || isLandscape) && (['left', 'bottom', 'right'] as const).map((s) => {
                    const SideIcon = s === 'left' ? PanelLeft : s === 'bottom' ? PanelBottom : PanelRight;
                    return (
                      <button
                        key={s}
                        onClick={() => setCarouselSide(s)}
                        aria-label={`Move to ${s}`}
                        className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
                          carouselSide === s ? 'text-white/70' : 'text-white/20 hover:text-white/50'
                        }`}
                      >
                        <SideIcon size={12} />
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCarouselDocked((d) => !d)}
                    aria-label={carouselDocked ? 'Undock' : 'Dock'}
                    className={`flex h-6 w-6 items-center justify-center rounded transition-colors ${
                      carouselDocked ? 'text-white/70' : 'text-white/20 hover:text-white/50'
                    }`}
                  >
                    {carouselDocked ? <PinOff size={12} /> : <Pin size={12} />}
                  </button>
                  <button
                    onClick={() => setCarouselOpen(false)}
                    aria-label="Close carousel"
                    className="flex h-6 w-6 items-center justify-center rounded text-white/20 transition-colors hover:text-white/50"
                  >
                    <ChevronCloseIcon size={14} />
                  </button>
                </div>

                {isBottom ? (
                  isMobile && !isLandscape ? (
                    /* ── Mobile portrait: full-width swipe tiles (filter is in header) ── */
                    <div className="flex flex-col overflow-hidden">
                      {/* Full-width swipe tile scroller — native momentum + scroll-snap.
                          overflow-x-scroll implicitly clips overflow-y, so py-2 gives
                          room for the 2px active ring and the label below tiles. */}
                      <div
                        ref={scrollerRef}
                        className="flex items-center gap-2 overflow-x-scroll px-2 py-2 snap-x snap-mandatory"
                        style={{ scrollbarWidth: 'none' }}
                      >
                        {carouselItems.map((exp, i) => (
                          <div key={exp.id} className="shrink-0 snap-start py-0.5">
                            <CarouselTile
                              exp={exp}
                              index={i}
                              isActive={active?.id === exp.id}
                              size={88}
                              onClick={() => selectExperience(exp, i)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* ── Desktop bottom: left filter column + prev/tiles/next ── */
                    <div className="flex h-[132px] items-stretch">
                      {/* Filters */}
                      <div className="flex shrink-0 flex-col justify-center gap-0.5 border-r border-white/[0.07] px-2 py-1.5">
                        {availableKinds.map((kind) => (
                          <button
                            key={kind}
                            onClick={() => setCarouselFilter(kind)}
                            className={[
                              'whitespace-nowrap rounded-md px-2 py-0.5 text-[9px] font-semibold transition-colors',
                              carouselFilter === kind ? 'bg-white/15 text-white' : 'text-white/30 hover:text-white/60',
                            ].join(' ')}
                          >
                            {KIND_LABELS[kind] ?? kind}
                          </button>
                        ))}
                      </div>
                      {/* Prev */}
                      <button
                        onClick={goPrev}
                        disabled={!carouselItems.length}
                        aria-label="Previous"
                        className="flex shrink-0 items-center justify-center px-1.5 text-white/25 transition-colors hover:text-white/60 disabled:opacity-0"
                      >
                        <ChevronLeft size={15} />
                      </button>
                      {/* Tiles */}
                      <div
                        ref={scrollerRef}
                        className="flex flex-1 items-center gap-2 overflow-x-auto px-1"
                        style={{ scrollbarWidth: 'none' }}
                      >
                        {carouselItems.map((exp, i) => (
                          <CarouselTile
                            key={exp.id}
                            exp={exp}
                            index={i}
                            isActive={active?.id === exp.id}
                            size={80}
                            onClick={() => selectExperience(exp, i)}
                          />
                        ))}
                      </div>
                      {/* Next */}
                      <button
                        onClick={goNext}
                        disabled={!carouselItems.length}
                        aria-label="Next"
                        className="flex shrink-0 items-center justify-center px-1.5 text-white/25 transition-colors hover:text-white/60 disabled:opacity-0"
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  )
                ) : (
                  /* ── Side layout: vertical scroll ── */
                  <div className="flex flex-1 flex-col overflow-hidden">
                    {/* Filter pills */}
                    <div
                      className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.07] px-2 py-1.5"
                      style={{ scrollbarWidth: 'none' }}
                    >
                      {availableKinds.map((kind) => (
                        <button
                          key={kind}
                          onClick={() => setCarouselFilter(kind)}
                          className={[
                            'shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-[9px] font-semibold transition-colors',
                            carouselFilter === kind ? 'bg-white/15 text-white' : 'text-white/30 hover:text-white/60',
                          ].join(' ')}
                        >
                          {KIND_LABELS[kind] ?? kind}
                        </button>
                      ))}
                    </div>
                    {/* Prev */}
                    <button
                      onClick={goPrev}
                      disabled={!carouselItems.length}
                      aria-label="Previous"
                      className="flex shrink-0 items-center justify-center py-1 text-white/25 transition-colors hover:text-white/60 disabled:opacity-0"
                    >
                      <ChevronUp size={15} />
                    </button>
                    {/* Tiles — vertical scroll */}
                    <div
                      ref={scrollerRef}
                      className="flex flex-col items-center gap-2 overflow-y-auto px-2 py-1"
                      style={{ scrollbarWidth: 'none' }}
                    >
                      {carouselItems.map((exp, i) => (
                        <CarouselTile
                          key={exp.id}
                          exp={exp}
                          index={i}
                          isActive={active?.id === exp.id}
                          size={74}
                          onClick={() => selectExperience(exp, i)}
                          labelRight
                        />
                      ))}
                    </div>
                    {/* Next */}
                    <button
                      onClick={goNext}
                      disabled={!carouselItems.length}
                      aria-label="Next"
                      className="flex shrink-0 items-center justify-center py-1 text-white/25 transition-colors hover:text-white/60 disabled:opacity-0"
                    >
                      <ChevronDown size={15} />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>


        </>
      )}

      {/* ── Gallery layer ── */}
      <AnimatePresence>
        {!active && (
          <motion.div
            key="gallery"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="absolute inset-0 overflow-y-auto text-slate-900 dark:text-slate-100"
          >
      <main className="max-w-5xl mx-auto px-4 sm:px-8 pt-8 sm:pt-16 pb-16 sm:pb-32">

        {/* Title / Logo */}
        {/* overflow:visible (default) lets particles float outside the h1 bounding box */}
        <div className="relative mb-5 sm:mb-8 flex justify-center">
          {LOGO_PARTICLES.map(([size, color, left, top, drift, duration, delay], i) => (
            <motion.span
              key={i}
              aria-hidden
              className="pointer-events-none absolute rounded-full"
              style={{ width: `${size}rem`, height: `${size}rem`, background: color, left, top }}
              initial={{ opacity: 0 }}
              animate={{ y: [0, -drift, 0], opacity: [0.35, 0.7, 0.35] }}
              transition={{ duration, repeat: Infinity, delay, ease: 'easeInOut' }}
            />
          ))}
          <h1 className="relative text-center text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight bg-gradient-to-r from-violet-400 via-sky-300 to-cyan-400 bg-clip-text text-transparent">
            Pixi Lab
          </h1>
        </div>

        {/* Segmented filter */}
        <div className="flex justify-center mb-3 sm:mb-4">
          <div className="inline-flex gap-0.5 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-white/[0.06]">
            {availableKinds.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setFilter(kind)}
                className={[
                  'px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150',
                  filter === kind
                    ? 'bg-white dark:bg-slate-700 shadow-md text-slate-900 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
                ].join(' ')}
              >
                {KIND_LABELS[kind] ?? kind}
              </button>
            ))}
          </div>
        </div>

        {appDemoItems.length > 0 && (
          <div className="mb-8 flex justify-center">
            <button
              type="button"
              onClick={startAppDemo}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 via-sky-400 to-cyan-400 px-4 py-2 text-sm font-bold text-white shadow-md shadow-sky-500/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play size={14} />
              Demo mode
            </button>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
          {filtered.map((experience, index) => (
            <ExperienceCard
              key={experience.id}
              experience={experience}
              index={index}
              onSelect={setActive}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-32 flex flex-col items-center gap-3 text-slate-400">
            <div className="text-4xl">◎</div>
            <p className="font-medium">Nothing here yet</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center pb-10 text-xs text-slate-400 dark:text-slate-600">
        @hooksjam/pixi-lab · MIT · PixiJS v8
      </footer>

      {/* Theme toggle */}
      <button
        type="button"
        onClick={() => setDark((d) => !d)}
        aria-label="Toggle theme"
        className="fixed bottom-6 right-6 w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg shadow-lg hover:scale-110 active:scale-95 transition-transform"
      >
        {dark ? '☀️' : '🌙'}
      </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ExperienceCardProps {
  experience: LabExperience;
  index: number;
  onSelect: (e: LabExperience) => void;
}

interface ExperienceSurfaceProps {
  experience: LabExperience | null;
  dockedInset: CSSProperties;
  maxPixels?: number;
  autoDemo?: boolean;
  visible?: boolean;
  interactive?: boolean;
  zIndex?: number;
  transparent?: boolean;
  initialQuality?: RenderQuality;
  onRenderSelectionChange?: (selection: RenderBackendProfileSelection) => void;
  onDemoAdvance?: () => void;
  onDemoExit?: () => void;
  onRuntimeReady?: () => void;
  onQuit: () => void;
  className?: string;
}

function ExperienceSurface({
  experience,
  dockedInset,
  maxPixels,
  autoDemo = false,
  visible = true,
  interactive = true,
  zIndex = 1,
  transparent = false,
  initialQuality,
  onRenderSelectionChange,
  onDemoAdvance,
  onDemoExit,
  onRuntimeReady,
  onQuit,
  className = 'absolute inset-0 overflow-hidden',
}: ExperienceSurfaceProps) {
  if (!experience) return null;

  return (
    <div
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: interactive ? 'auto' : 'none',
        transition: `opacity ${APP_DEMO_CROSSFADE_MS}ms ease-in-out`,
        zIndex,
      }}
    >
      {/* transform creates a containing block so GameLauncher's fixed
          children are constrained to this element when docked. */}
      <div
        className="fixed inset-0 overflow-hidden"
        style={{ ...dockedInset, transform: 'translateZ(0)' }}
      >
        <GameLauncher
          key={experience.id}
          definition={experience}
          maxPixels={maxPixels}
          autoDemo={autoDemo}
          initialQuality={initialQuality}
          onRenderSelectionChange={onRenderSelectionChange}
          transparent={transparent}
          onDemoAdvance={onDemoAdvance}
          onDemoExit={onDemoExit}
          onRuntimeReady={onRuntimeReady}
          onQuit={onQuit}
        />
      </div>
    </div>
  );
}

/** Simulated content page shown behind transparent overlay experiences. */
function OverlayBackdrop() {
  return (
    <div className="fixed inset-0 overflow-y-auto bg-white text-slate-800 pointer-events-none select-none">
      {/* Nav */}
      <nav className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/90 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400" />
          <span className="text-sm font-bold tracking-tight text-slate-900">Acme Dashboard</span>
        </div>
        <div className="hidden sm:flex items-center gap-6 text-xs font-medium text-slate-500">
          <span>Overview</span><span>Analytics</span><span>Reports</span><span>Settings</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-sky-400 to-violet-500" />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 p-8 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Good morning, James</p>
          <h1 className="text-3xl font-bold mb-2">Your workspace at a glance</h1>
          <p className="text-sm text-slate-300 max-w-md">All your projects, insights, and activity in one place. Dive into any area or explore something new.</p>
          <div className="mt-5 flex gap-3">
            <div className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold">View projects</div>
            <div className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/70">Invite team</div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Active Projects', value: '12', delta: '+2 this week' },
            { label: 'Team Members', value: '8', delta: '2 online now' },
            { label: 'Tasks Due', value: '5', delta: '3 overdue' },
            { label: 'Uptime', value: '99.9%', delta: 'Last 30 days' },
          ].map(({ label, value, delta }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{delta}</p>
            </div>
          ))}
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Recent Activity</h2>
            <span className="text-xs text-slate-400">View all</span>
          </div>
          {[
            { icon: '📄', title: 'Q2 Report finalized', time: '2 min ago', badge: 'Docs' },
            { icon: '🚀', title: 'v2.4.1 deployed to production', time: '18 min ago', badge: 'Deploy' },
            { icon: '💬', title: 'Sofia commented on Onboarding flow', time: '1 hr ago', badge: 'Design' },
            { icon: '✅', title: 'Sprint 14 review completed', time: '3 hr ago', badge: 'Agile' },
          ].map(({ icon, title, time, badge }, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3 border-b last:border-0 border-slate-50">
              <span className="text-lg leading-none">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">{title}</p>
                <p className="text-[10px] text-slate-400">{time}</p>
              </div>
              <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{badge}</span>
            </div>
          ))}
        </div>

        {/* Paragraph copy */}
        <div className="grid sm:grid-cols-2 gap-6 text-sm text-slate-600 leading-relaxed">
          <p>
            Seamlessly integrate your workflows with our powerful APIs. Build custom automations that
            save your team hours every week — from smart notifications to real-time syncing across
            every tool in your stack.
          </p>
          <p>
            Our analytics engine processes millions of data points so you don&apos;t have to. Get
            actionable insights, beautiful charts, and automated reports delivered straight to your
            inbox on any schedule you choose.
          </p>
        </div>
      </main>
    </div>
  );
}

function ExperienceCard({ experience, index, onSelect }: ExperienceCardProps) {
  const badgeCls = KIND_BADGE[experience.kind] ?? 'bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400';
  const needsDemoQa = experience.capabilities.demo && !hasPassedDemoQa(experience.id);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = useState(240);
  const [previewActive, setPreviewActive] = useState(false);

  useLayoutEffect(() => {
    if (previewRef.current) {
      setPreviewSize(previewRef.current.clientWidth);
    }
  }, []);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setPreviewActive(entry.isIntersecting),
      { rootMargin: '180px', threshold: 0.01 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(experience)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(experience)}
      className="cursor-pointer select-none group"
    >
      {/* Square canvas */}
      <div
        ref={previewRef}
        className="relative w-full aspect-square rounded-2xl overflow-hidden pointer-events-none bg-slate-100 dark:bg-[#0d0d1e] transition-transform duration-200 group-hover:scale-[1.03]"
      >
        <PreviewTile definition={experience} index={index} size={previewSize} active={previewActive} />

        {/* Kind badge — overlaid on the preview tile */}
        <span className={`absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${badgeCls}`}>
          {experience.kind}
        </span>

        {needsDemoQa && (
          <span
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-amber-300/95 px-1.5 py-1 text-[9px] font-bold uppercase leading-none text-amber-950"
            title="Manual demo QA has not passed yet"
          >
            <AlertTriangle size={10} strokeWidth={2.5} />
            Needs QA
          </span>
        )}
      </div>

      {/* Name — centered below canvas */}
      <p className="mt-3 text-center text-sm font-semibold text-slate-800 dark:text-slate-200 leading-tight">
        {experience.name}
      </p>
    </div>
  );
}

// ── CarouselTile ──────────────────────────────────────────────────────────────
interface CarouselTileProps {
  exp: LabExperience;
  index: number;
  isActive: boolean;
  size: number;
  onClick: () => void;
  labelRight?: boolean;
}

function CarouselTile({ exp, index, isActive, size, onClick, labelRight }: CarouselTileProps) {
  const tileRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = tileRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={tileRef}
      className={[
        'flex shrink-0 items-center gap-1.5 transition-all duration-150 cursor-pointer',
        labelRight ? 'flex-row w-full' : 'flex-col',
      ].join(' ')}
    >
      {/* Ring wrapper — rounded-2xl matches GameTile's own rounded-2xl; flex removes inline baseline gap; no overflow-hidden so ring isn't clipped */}
      <div className={['shrink-0 flex rounded-2xl', isActive ? 'ring-2 ring-white/65' : ''].join(' ')}>
        <PreviewTile definition={exp} index={index} size={size} onPress={onClick} active={inView} />
      </div>
      <span
        className={[
          'text-[9px] font-medium leading-tight text-white/50 truncate',
          labelRight ? 'flex-1 text-left' : 'text-center',
        ].join(' ')}
        style={labelRight ? undefined : { maxWidth: size }}
      >
        {exp.name}
      </span>
    </div>
  );
}


