/**
 * components/games/ui/HUD.tsx
 *
 * Unified top bar: quit · score/controls · tutorial · pause
 */
import { X, Settings, Heart, HelpCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import type React from 'react';
import { useViewportContext } from '../ViewportProvider.js';

interface HUDProps {
  score?: number;
  lives?: number;
  timeRemaining?: number;
  gameStats?: { dropsRemaining?: number; phase?: string; combo?: number };
  /** Replaces the center score slot with arbitrary content (e.g. sim controls) */
  controls?: React.ReactNode;
  onQuit?: () => void;
  onSettings?: () => void;
  onTutorial?: () => void;
}

export function HUD({ score, lives, timeRemaining, gameStats, controls, onQuit, onSettings, onTutorial }: HUDProps) {
  const { safeArea } = useViewportContext();

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 px-4 pt-6"
      style={{ paddingTop: `${(safeArea.top || 0) + 28}px` }}
    >
      {/* Left: Quit */}
      {onQuit && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onQuit}
          className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/30 text-white/70 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white"
          aria-label="Quit"
        >
          <X size={15} strokeWidth={2.5} />
        </motion.button>
      )}

      {/* Center: score or custom controls — absolutely centered so left/right slot widths don't skew alignment */}
      <div className="pointer-events-none absolute inset-x-0 flex items-center justify-center"
        style={{ top: `${(safeArea.top || 0) + 28}px`, height: '54px' }}
      >
        <div className="pointer-events-auto">
          {controls ?? (
            score !== undefined ? (
              <div className="flex items-center gap-4 rounded-[1.35rem] bg-black/45 px-6 py-3.5 shadow-xl shadow-black/30 backdrop-blur-md">
                <div className="text-center leading-none">
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-white/45">Score</div>
                  <div className="text-3xl font-black tabular-nums text-white sm:text-4xl">{score.toLocaleString()}</div>
                </div>
                {gameStats?.dropsRemaining !== undefined ? (
                  <div className="h-11 w-px bg-white/15" />
                ) : null}
                {gameStats?.dropsRemaining !== undefined ? (
                  <div className="text-center leading-none">
                    <div className="text-[11px] font-black uppercase tracking-[0.22em] text-white/45">Balls</div>
                    <div className="text-3xl font-black tabular-nums text-cyan-200 sm:text-4xl">{gameStats.dropsRemaining}</div>
                  </div>
                ) : null}
              </div>
            ) : null
          )}
        </div>
      </div>
      {/* Spacer keeps the right slot from consuming the absolute center's space */}
      <div className="flex-1" />

      {/* Right: score (when controls are in center) / lives / timer / tutorial / pause */}
      <div className="flex shrink-0 items-center gap-1.5">
        {controls !== undefined && score !== undefined && (
          <div className="flex items-center gap-2 rounded-2xl bg-black/40 px-3 py-2 shadow-lg shadow-black/25 backdrop-blur-md">
            <div className="text-center leading-none">
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">Score</div>
              <div className="text-base font-black tabular-nums text-white">{score.toLocaleString()}</div>
            </div>
            {gameStats?.dropsRemaining !== undefined ? (
              <>
                <div className="h-7 w-px bg-white/15" />
                <div className="text-center leading-none">
                  <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/45">Balls</div>
                  <div className="text-base font-black tabular-nums text-cyan-200">{gameStats.dropsRemaining}</div>
                </div>
              </>
            ) : null}
          </div>
        )}
        {lives !== undefined && lives > 0 && (
          <div className="flex items-center gap-0.5 rounded-xl bg-black/30 px-2.5 py-1.5 backdrop-blur-md">
            {Array.from({ length: Math.max(0, lives) }, (_, i) => (
              <Heart key={i} size={11} fill="currentColor" className="text-rose-400" />
            ))}
          </div>
        )}
        {timeRemaining !== undefined && (
          <div className="flex items-center gap-1 rounded-xl bg-black/30 px-2.5 py-1.5 backdrop-blur-md">
            <Clock size={11} className="text-white/60" />
            <span className="text-xs font-bold tabular-nums text-white">{Math.ceil(timeRemaining)}s</span>
          </div>
        )}
        {onTutorial && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onTutorial}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-xl bg-black/30 text-white/60 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white"
            aria-label="How to play"
          >
            <HelpCircle size={15} />
          </motion.button>
        )}
        {onSettings && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onSettings}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-xl bg-black/30 text-white/60 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white"
            aria-label="Settings"
          >
            <Settings size={15} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
