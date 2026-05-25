import { motion } from 'framer-motion';
import type { RenderQuality } from '@hooksjam/pixi-lab-core';

export interface QualitySelectorProps {
  value: RenderQuality;
  /**
   * The quality level actually being rendered. May differ from `value` when the
   * performance governor falls back to a lower tier. When provided and different
   * from `value`, the rendered tier is highlighted in red to signal fallback.
   */
  renderedValue?: RenderQuality;
  options: readonly RenderQuality[];
  onChange: (quality: RenderQuality) => void;
}

export function QualitySelector({ value, renderedValue, options, onChange }: QualitySelectorProps) {
  const hasFallback = renderedValue !== undefined && renderedValue !== value;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex h-8 items-center gap-0.5 rounded-xl bg-black/30 px-1 backdrop-blur-md"
    >
      {options.map((q) => {
        const isSelected = q === value;
        const isRendered = q === (renderedValue ?? value);
        const isFallback = hasFallback && isRendered;

        let cls: string;
        if (isFallback) {
          // Rendered tier during fallback — red highlight
          cls = 'bg-red-500/20 text-red-300/80';
        } else if (isSelected) {
          // User-selected tier (and it's actually rendering)
          cls = 'bg-white/20 text-white';
        } else if (hasFallback && isSelected) {
          // User wants this tier but engine fell back — faint ring
          cls = 'text-white/40 ring-1 ring-white/20';
        } else {
          cls = 'text-white/50 hover:text-white/80';
        }

        return (
          <button
            key={q}
            type="button"
            onClick={() => onChange(q)}
            title={isFallback ? 'Performance fallback' : undefined}
            className={`h-6 rounded-lg px-2.5 text-xs font-semibold capitalize transition-colors ${cls}`}
          >
            {q}
          </button>
        );
      })}
    </motion.div>
  );
}
