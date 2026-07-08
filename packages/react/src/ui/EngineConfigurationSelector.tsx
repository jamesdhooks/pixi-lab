import { motion } from 'framer-motion';
import {
  getSupportedEngineConfigurations,
  toEngineConfiguration,
  type EngineConfiguration,
  type RenderQuality,
} from '@hooksjam/pixi-lab-core';

export interface EngineConfigurationSelectorProps {
  value: RenderQuality;
  /**
   * The style/profile actually being rendered. May differ from `value` when the
   * performance governor falls back to a lower tier. When provided and different
   * from `value`, the rendered style/profile is shown as a fallback note.
   */
  renderedValue?: RenderQuality;
  /** Preferred backend/profile configurations. Kept for compatibility; do not surface as an Engine dropdown. */
  configurations?: readonly EngineConfiguration[];
  onChange: (quality: RenderQuality) => void;
}

function optionLabel(quality: RenderQuality, configurations: readonly EngineConfiguration[]): string {
  return configurations.find((configuration) => configuration.legacyQuality === quality)?.label ?? toEngineConfiguration(quality).label;
}

export function EngineConfigurationSelector({ value, renderedValue, configurations, onChange }: EngineConfigurationSelectorProps) {
  const hasFallback = renderedValue !== undefined && renderedValue !== value;
  const engineConfigurations = getSupportedEngineConfigurations({ engineConfigurations: configurations });
  const renderedLabel = hasFallback && renderedValue ? optionLabel(renderedValue, engineConfigurations) : null;

  return (
    <motion.label
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex h-8 items-center gap-2 rounded-xl bg-black/30 px-2 backdrop-blur-md"
    >
      <span className="hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35 sm:inline">
        Style
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as RenderQuality)}
        aria-label="Style"
        title={hasFallback && renderedLabel ? `Performance fallback to ${renderedLabel}` : 'Style'}
        className="h-6 min-w-36 rounded-lg border border-white/10 bg-black/40 px-2 text-xs font-semibold text-white outline-none transition-colors hover:bg-black/55 focus:border-white/35 focus:ring-1 focus:ring-white/20"
      >
        {engineConfigurations.map((configuration) => (
          <option key={configuration.id} value={configuration.legacyQuality}>
            {configuration.label}
          </option>
        ))}
      </select>
      {hasFallback && renderedLabel ? (
        <span className="hidden text-[10px] font-medium text-red-300/80 lg:inline" title={`Performance fallback to ${renderedLabel}`}>
          rendering {renderedLabel}
        </span>
      ) : null}
    </motion.label>
  );
}
