/**
 * components/games/ui/IntroCard.tsx
 *
 * Full-screen intro shown before game starts.
 * Shows game name, description, Play button, and "How to play" link.
 */
import { motion } from 'framer-motion';
import { Play, HelpCircle } from 'lucide-react';

interface IntroCardProps {
  icon: string;
  name: string;
  short: string;
  long: string;
  onPlay: () => void;
  onHowToPlay?: () => void;
  onQuit: () => void;
}

export function IntroCard({
  icon,
  name,
  short,
  long,
  onPlay,
  onHowToPlay,
  onQuit,
}: IntroCardProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="mx-4 w-full max-w-sm rounded-3xl border border-white/20 bg-white/10 p-8 text-center text-white shadow-2xl"
      >
        <div className="mb-4 text-7xl">{icon}</div>
        <h1 className="mb-1 text-2xl font-bold">{name}</h1>
        <p className="mb-1 text-sm text-white/70">{short}</p>
        <p className="mb-6 text-xs leading-relaxed text-white/50">{long}</p>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onPlay}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-base font-bold text-black transition-colors hover:bg-white/90"
        >
          <Play size={18} fill="currentColor" />
          Play
        </motion.button>

        {onHowToPlay && (
          <button
            onClick={onHowToPlay}
            className="mx-auto flex items-center justify-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
          >
            <HelpCircle size={14} />
            How to play
          </button>
        )}

        <button
          onClick={onQuit}
          className="mt-4 text-xs text-white/30 transition-colors hover:text-white/60"
        >
          Back
        </button>
      </motion.div>
    </div>
  );
}
