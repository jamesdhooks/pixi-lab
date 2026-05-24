/**
 * components/games/ui/QuitButton.tsx
 *
 * Consistent top-left quit button present in every game.
 */
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

interface QuitButtonProps {
  onQuit: () => void;
  label?: string;
}

export function QuitButton({ onQuit, label = 'Quit' }: QuitButtonProps) {
  return (
    <motion.button
      onClick={onQuit}
      whileTap={{ scale: 0.9 }}
      className="absolute left-3 top-3 z-50 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/60"
      aria-label={label}
    >
      <X size={14} strokeWidth={2.5} />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </motion.button>
  );
}
