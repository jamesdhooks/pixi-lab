/**
 * components/games/ui/TutorialOverlay.tsx
 *
 * Paged tutorial card shown at the bottom-left of the screen.
 * Game remains fully visible behind it — no full-screen backdrop.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';

export interface TutorialPage {
  icon: string;
  title: string;
  body: string;
}

interface TutorialOverlayProps {
  pages: TutorialPage[];
  onDone: () => void;
}

export function TutorialOverlay({ pages, onDone }: TutorialOverlayProps) {
  const [idx, setIdx] = useState(0);
  const page = pages[idx];
  const isLast = idx === pages.length - 1;

  return (
    <div className="pointer-events-auto w-[calc(100vw-24px)] max-w-[400px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          className="relative rounded-2xl bg-black/75 p-5 text-white shadow-2xl backdrop-blur-xl"
        >
          <button
            onClick={onDone}
            className="absolute right-3 top-3 text-white/40 transition-colors hover:text-white"
          >
            <X size={14} />
          </button>

          <div className="mb-3 text-5xl">{page.icon}</div>
          <h2 className="mb-1.5 text-lg font-bold">{page.title}</h2>
          <p className="mb-4 text-sm leading-relaxed text-white/70">{page.body}</p>

          {pages.length > 1 && (
            <div className="mb-4 flex gap-1.5">
              {pages.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 w-4 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/25'}`}
                />
              ))}
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => (isLast ? onDone() : setIdx(idx + 1))}
            className="flex items-center gap-1 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            {isLast ? 'Got it!' : <>Next <ChevronRight size={13} /></>}
          </motion.button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
