/**
 * ui/ModeToggle.tsx
 *
 * Top-centre pill for switching named interaction modes (e.g. Single / Rapid / Explode).
 * Rendered by GameLauncher when `definition.modes` has more than one entry.
 */
import { motion } from 'framer-motion';
import type { ExperienceMode } from '@hooksjam/pixi-lab-core';

export interface ModeToggleProps {
  modes: ExperienceMode[];
  value: string;
  onChange: (id: string) => void;
}

export function ModeToggle({ modes, value, onChange }: ModeToggleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex h-8 items-center gap-0.5 rounded-xl bg-black/30 px-1 backdrop-blur-md"
    >
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onChange(mode.id)}
          aria-pressed={mode.id === value}
          aria-label={mode.description ?? mode.label}
          className={[
            'h-6 rounded-lg px-3 text-xs font-semibold transition-all',
            mode.id === value
              ? 'bg-white/20 text-white'
              : 'text-white/50 hover:text-white',
          ].join(' ')}
        >
          {mode.icon && <span className="mr-1.5">{mode.icon}</span>}
          {mode.label}
        </button>
      ))}
    </motion.div>
  );
}
