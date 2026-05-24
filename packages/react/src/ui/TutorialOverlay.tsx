/**
 * components/games/ui/TutorialOverlay.tsx
 *
 * Paged tutorial card overlay.
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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md">
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -40, opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="mx-4 w-full max-w-xs rounded-3xl border border-white/20 bg-white/10 p-8 text-center text-white shadow-2xl"
        >
          <button
            onClick={onDone}
            className="absolute right-4 top-4 text-white/40 hover:text-white"
          >
            <X size={16} />
          </button>

          <div className="mb-4 text-6xl">{page.icon}</div>
          <h2 className="mb-2 text-xl font-bold">{page.title}</h2>
          <p className="mb-6 text-sm leading-relaxed text-white/70">{page.body}</p>

          {/* Page dots */}
          <div className="mb-5 flex justify-center gap-1.5">
            {pages.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${i === idx ? 'bg-white' : 'bg-white/30'}`}
              />
            ))}
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => (isLast ? onDone() : setIdx(idx + 1))}
            className="mx-auto flex items-center justify-center gap-1 rounded-xl bg-white px-6 py-2.5 font-bold text-black transition-colors hover:bg-white/90"
          >
            {isLast ? (
              'Got it!'
            ) : (
              <>
                Next <ChevronRight size={16} />
              </>
            )}
          </motion.button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
