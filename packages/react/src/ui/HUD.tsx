/**
 * components/games/ui/HUD.tsx
 *
 * Unified top bar: quit · score/controls · tutorial · pause
 */
import { X, Settings, Heart, HelpCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import type React from 'react';

interface HUDProps {
  score?: number;
  lives?: number;
  timeRemaining?: number;
  /** Replaces the center score slot with arbitrary content (e.g. sim controls) */
  controls?: React.ReactNode;
  onQuit?: () => void;
  onSettings?: () => void;
  onTutorial?: () => void;
}

export function HUD({ score, lives, timeRemaining, controls, onQuit, onSettings, onTutorial }: HUDProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 px-3 pt-3"
    >
      {/* Left: Quit */}
      {onQuit && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onQuit}
          className="pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black/30 text-white/70 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white"
          aria-label="Quit"
        >
          <X size={15} strokeWidth={2.5} />
        </motion.button>
      )}

      {/* Center: score or custom controls */}
      <div className="pointer-events-auto flex min-w-0 flex-1 items-center justify-center gap-2">
        {controls ?? (
          score !== undefined ? (
            <div className="rounded-xl bg-black/30 px-4 py-1.5 backdrop-blur-md">
              <span className="text-sm font-bold tabular-nums text-white">{score.toLocaleString()}</span>
            </div>
          ) : null
        )}
      </div>

      {/* Right: score (when controls are in center) / lives / timer / tutorial / pause */}
      <div className="flex shrink-0 items-center gap-1.5">
        {controls !== undefined && score !== undefined && (
          <div className="rounded-xl bg-black/30 px-3 py-1.5 backdrop-blur-md">
            <span className="text-sm font-bold tabular-nums text-white">{score.toLocaleString()}</span>
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
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl bg-black/30 text-white/60 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white"
            aria-label="How to play"
          >
            <HelpCircle size={15} />
          </motion.button>
        )}
        {onSettings && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onSettings}
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-xl bg-black/30 text-white/60 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-white"
            aria-label="Settings"
          >
            <Settings size={15} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
