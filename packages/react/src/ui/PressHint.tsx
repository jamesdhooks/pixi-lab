/**
 * packages/react/src/ui/PressHint.tsx
 *
 * Subtle animated hand shown for ~3 s at the start of gameplay.
 * Auto-dismisses; pointer-events-none so all taps/clicks pass through.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hand } from 'lucide-react';

export function PressHint() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2800);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            className="opacity-30"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 0.85, ease: 'easeInOut', repeat: 2, repeatDelay: 0.1 }}
          >
            <Hand size={52} strokeWidth={1.2} className="text-white drop-shadow-lg" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
