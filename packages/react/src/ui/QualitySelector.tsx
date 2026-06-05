import { motion } from 'framer-motion';
import {
  getSupportedRenderQualityModes,
  groupQualityModesByBackend,
  toRenderBackendProfileCandidate,
  type RenderQuality,
} from '@hooksjam/pixi-lab-core';

export interface QualitySelectorProps {
  value: RenderQuality;
  /**
   * The quality level actually being rendered. May differ from `value` when the
   * performance governor falls back to a lower tier. When provided and different
   * from `value`, the rendered tier is highlighted in red to signal fallback.
   */
  renderedValue?: RenderQuality;
  options?: readonly RenderQuality[];
  onChange: (quality: RenderQuality) => void;
}

export function QualitySelector({ value, renderedValue, options, onChange }: QualitySelectorProps) {
  const hasFallback = renderedValue !== undefined && renderedValue !== value;
  const backendGroups = groupQualityModesByBackend(
    getSupportedRenderQualityModes(options === undefined ? undefined : { qualityModes: options }),
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex h-8 items-center gap-0.5 rounded-xl bg-black/30 px-1 backdrop-blur-md"
      aria-label="Renderer backend and profile options"
    >
      {backendGroups.map((group, groupIndex) => (
        <div key={group.backend} className="flex items-center gap-0.5" data-renderer-backend={group.backend}>
          {groupIndex > 0 ? <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-white/10" /> : null}
          <span className="sr-only">{group.backend} backend</span>
          {group.candidates.map(({ quality: q, backend, profile, legacyLabel }) => {
            const isSelected = q === value;
            const isRendered = q === (renderedValue ?? value);
            const isFallback = hasFallback && isRendered;
            const renderedCandidate = toRenderBackendProfileCandidate(renderedValue ?? value);
            const title = isFallback
              ? `Performance fallback to ${renderedCandidate.backend} / ${renderedCandidate.profile}`
              : `${legacyLabel}: ${backend} / ${profile}`;

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
                title={title}
                aria-label={`${legacyLabel} render option, ${backend} backend, ${profile} profile`}
                className={`h-6 rounded-lg px-2.5 text-xs font-semibold capitalize transition-colors ${cls}`}
              >
                {legacyLabel}
              </button>
            );
          })}
        </div>
      ))}
    </motion.div>
  );
}
