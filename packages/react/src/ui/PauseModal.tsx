/**
 * components/games/ui/PauseModal.tsx
 */
import { motion } from 'framer-motion';
import { Play, Settings, X } from 'lucide-react';

interface PauseModalProps {
  onResume: () => void;
  onSettings?: () => void;
  onQuit: () => void;
}

export function PauseModal({ onResume, onSettings, onQuit }: PauseModalProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className="mx-4 w-full max-w-xs rounded-3xl border border-white/20 bg-white/10 p-8 text-center text-white shadow-2xl"
      >
        <h2 className="mb-6 text-2xl font-bold">Paused</h2>

        <div className="space-y-2.5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onResume}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 font-bold text-black transition-colors hover:bg-white/90"
          >
            <Play size={16} fill="currentColor" />
            Resume
          </motion.button>

          {onSettings && (
            <button
              onClick={onSettings}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 py-2.5 font-medium text-white transition-colors hover:bg-white/20"
            >
              <Settings size={16} />
              Settings
            </button>
          )}

          <button
            onClick={onQuit}
            className="flex w-full items-center justify-center gap-2 py-1 text-sm text-white/50 transition-colors hover:text-white"
          >
            <X size={14} />
            Quit
          </button>
        </div>
      </motion.div>
    </div>
  );
}
