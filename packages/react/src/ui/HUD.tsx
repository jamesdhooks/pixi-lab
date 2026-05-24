/**
 * components/games/ui/HUD.tsx
 *
 * Heads-up display strip — score, timer, and optional extra slots.
 * Overlaid on top of the canvas.
 */
interface HUDProps {
  score?: number;
  lives?: number;
  timeRemaining?: number;
  extra?: React.ReactNode;
  onPause?: () => void;
}

export function HUD({ score, lives, timeRemaining, extra, onPause }: HUDProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex items-center justify-between px-4">
      {/* Score */}
      <div className="min-w-[60px] rounded-full bg-black/40 px-3 py-1 text-center text-sm font-bold text-white backdrop-blur-sm">
        {score !== undefined ? score.toLocaleString() : '—'}
      </div>

      {/* Center slot */}
      <div className="pointer-events-auto">{extra}</div>

      {/* Right: lives / timer / pause */}
      <div className="flex items-center gap-2">
        {lives !== undefined && (
          <div className="rounded-full bg-black/40 px-3 py-1 text-sm font-bold text-red-400 backdrop-blur-sm">
            {'❤️'.repeat(Math.max(0, lives))}
          </div>
        )}
        {timeRemaining !== undefined && (
          <div className="rounded-full bg-black/40 px-3 py-1 text-sm font-bold text-white backdrop-blur-sm">
            {Math.ceil(timeRemaining)}s
          </div>
        )}
        {onPause && (
          <button
            onClick={onPause}
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            aria-label="Pause"
          >
            <span className="text-xs font-bold leading-none">⏸</span>
          </button>
        )}
      </div>
    </div>
  );
}
