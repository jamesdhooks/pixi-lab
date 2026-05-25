/**
 * packages/react/src/ui/StartCard.tsx
 *
 * Auto-dismissing intro hint shown when gameplay starts.
 * Uses the first tutorial page (icon + title + body) as content.
 * Scales in, holds briefly, then scales/fades away. Tap anywhere to skip.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StartCardProps {
  icon: string;
  title: string;
  body: string;
}

export function StartCard({ icon, title, body }: StartCardProps) {
  const [visible, setVisible] = useState(true);
  const dismiss = useCallback(() => setVisible(false), []);

  useEffect(() => {
    const t = setTimeout(dismiss, 2200);
    return () => clearTimeout(t);
  }, [dismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-auto absolute inset-0 z-20 flex cursor-pointer items-center justify-center"
          onClick={dismiss}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            className="mx-8 w-full max-w-xs rounded-2xl bg-white/10 px-8 py-7 text-center text-white shadow-2xl backdrop-blur-xl"
            initial={{ scale: 0.72, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.88, opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
          >
            <div className="mb-3 text-6xl">{icon}</div>
            <h2 className="mb-2 text-xl font-bold">{title}</h2>
            <p className="text-sm leading-relaxed text-white/60">{body}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
