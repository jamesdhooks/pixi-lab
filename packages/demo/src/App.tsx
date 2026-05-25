import { useState, useMemo, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, PanelLeft, PanelBottom, PanelRight, Pin, PinOff } from 'lucide-react';
import { GameLauncher, PreviewTile } from '@hooksjam/pixi-lab-react';
import { GAME_REGISTRY } from '@hooksjam/pixi-lab-games';
import { SIMULATION_REGISTRY } from '@hooksjam/pixi-lab-simulations';
import type { LabExperience } from '@hooksjam/pixi-lab-core';

const ALL_EXPERIENCES: readonly LabExperience[] = [...GAME_REGISTRY, ...SIMULATION_REGISTRY];

type FilterKind = 'all' | LabExperience['kind'];

const KIND_LABELS: Record<string, string> = {
  all: 'All',
  game: 'Games',
  simulation: 'Simulations',
  ambient: 'Ambients',
  effect: 'Effects',
  toy: 'Toys',
};

const KIND_BADGE: Record<string, string> = {
  game:       'bg-blue-100   text-blue-600   dark:bg-blue-500/15   dark:text-blue-300',
  simulation: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  ambient:    'bg-teal-100   text-teal-600   dark:bg-teal-500/15   dark:text-teal-300',
  effect:     'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300',
  toy:        'bg-pink-100   text-pink-600   dark:bg-pink-500/15   dark:text-pink-300',
};

export function App() {
  const [active, setActive] = useState<LabExperience | null>(null);
  const [filter, setFilter] = useState<FilterKind>('all');
  const [dark, setDark] = useState(true);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselFilter, setCarouselFilter] = useState<FilterKind>('all');
  const [carouselSide, setCarouselSide] = useState<'bottom' | 'left' | 'right'>('bottom');
  const [carouselDocked, setCarouselDocked] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Sync dark class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const availableKinds = useMemo<FilterKind[]>(() => {
    const seen = new Set<LabExperience['kind']>();
    for (const e of ALL_EXPERIENCES) seen.add(e.kind);
    return ['all', ...Array.from(seen)];
  }, []);

  const filtered = useMemo(
    () => (filter === 'all' ? ALL_EXPERIENCES : ALL_EXPERIENCES.filter((e) => e.kind === filter)),
    [filter],
  );

  const carouselItems = useMemo(
    () => (carouselFilter === 'all' ? ALL_EXPERIENCES : ALL_EXPERIENCES.filter((e) => e.kind === carouselFilter)),
    [carouselFilter],
  );

  const activeCarouselIndex = useMemo(
    () => (active ? carouselItems.findIndex((e) => e.id === active.id) : -1),
    [active, carouselItems],
  );

  const selectExperience = useCallback((exp: LabExperience, idx: number) => {
    setActive(exp);
    requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const tile = scroller.children[idx] as HTMLElement | undefined;
      tile?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }, []);

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

  // Scroll active tile into view when carousel opens
  useEffect(() => {
    if (!carouselOpen || activeCarouselIndex < 0) return;
    requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const tile = scroller.children[activeCarouselIndex] as HTMLElement | undefined;
      tile?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }, [carouselOpen, activeCarouselIndex]);

  const isBottom = carouselSide === 'bottom';
  const isLeft = carouselSide === 'left';
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

      {/* ── Experience layer — keyed by id so it fades when switching ── */}
      <AnimatePresence>
        {active && (
          <motion.div
            key={active.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            {/* transform creates a containing block so GameLauncher's fixed
                children are constrained to this element when docked. */}
            <div
              className="fixed inset-0"
              style={{ ...dockedInset, transform: 'translateZ(0)' }}
            >
              <GameLauncher
                definition={active}
                onQuit={() => { setActive(null); setCarouselOpen(false); }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Carousel — outside the experience key so it persists across switches ── */}
      {active && (
        <>
          {/* Chevron toggle — visible when carousel is closed */}
          <AnimatePresence>
            {!carouselOpen && (
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
            )}
          </AnimatePresence>

          {/* Carousel panel */}
          <AnimatePresence>
            {carouselOpen && (
              <motion.div
                key={`carousel-${carouselSide}`}
                initial={panelInitialAnim}
                animate={isBottom ? { y: 0 } : { x: 0 }}
                exit={panelInitialAnim}
                transition={{ type: 'spring', stiffness: 400, damping: 40, mass: 0.7 }}
                className={`fixed z-[60] flex flex-col ${panelBorderClass} border-white/10 bg-black/90 backdrop-blur-xl ${panelPositionClass}`}
              >
                {/* Header */}
                <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.07] px-3 py-1.5">
                  <span className="mr-auto text-[10px] font-semibold uppercase tracking-widest text-white/30">
                    Experiences
                  </span>
                  {(['left', 'bottom', 'right'] as const).map((s) => {
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
                  /* ── Bottom layout: horizontal scroll ── */
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
      <main className="max-w-5xl mx-auto px-8 pt-24 pb-32">

        {/* Title */}
        <h1 className="text-center text-6xl sm:text-7xl font-bold tracking-tight mb-14 text-slate-900 dark:text-white">
          Pixi Lab
        </h1>

        {/* Segmented filter */}
        <div className="flex justify-center mb-16">
          <div className="inline-flex gap-0.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-white/[0.06]">
            {availableKinds.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setFilter(kind)}
                className={[
                  'px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150',
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

function ExperienceCard({ experience, index, onSelect }: ExperienceCardProps) {
  const badgeCls = KIND_BADGE[experience.kind] ?? 'bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400';
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = useState(240);

  useLayoutEffect(() => {
    if (previewRef.current) {
      setPreviewSize(previewRef.current.clientWidth);
    }
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
        <PreviewTile definition={experience} index={index} size={previewSize} />

        {/* Kind badge — overlaid on the preview tile */}
        <span className={`absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${badgeCls}`}>
          {experience.kind}
        </span>
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
  return (
    <div
      className={[
        'flex shrink-0 items-center gap-1.5 transition-all duration-150 cursor-pointer',
        labelRight ? 'flex-row w-full' : 'flex-col',
        isActive ? 'opacity-100' : 'opacity-40 hover:opacity-75',
      ].join(' ')}
    >
      {/* Ring wrapper — rounded-2xl matches GameTile's own rounded-2xl; flex removes inline baseline gap; no overflow-hidden so ring isn't clipped */}
      <div className={['shrink-0 flex rounded-2xl', isActive ? 'ring-2 ring-white/65' : ''].join(' ')}>
        <PreviewTile definition={exp} index={index} size={size} onPress={onClick} />
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


