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
   * The quality level actually being rendered. May differ from `value` when the
   * performance governor falls back to a lower tier. When provided and different
   * from `value`, the rendered engine/profile is shown as a fallback note.
   */
  renderedValue?: RenderQuality;
  /** Legacy quality-token options retained for compatibility. */
  options?: readonly RenderQuality[];
  /** Preferred backend/profile engine configurations. */
  configurations?: readonly EngineConfiguration[];
  onChange: (quality: RenderQuality) => void;
}

function optionLabel(quality: RenderQuality): string {
  return toEngineConfiguration(quality).label;
}

export function EngineConfigurationSelector({ value, renderedValue, options, configurations, onChange }: EngineConfigurationSelectorProps) {
  const hasFallback = renderedValue !== undefined && renderedValue !== value;
  const engineConfigurations = getSupportedEngineConfigurations(
    configurations === undefined ? (options === undefined ? undefined : { qualityModes: options }) : { engineConfigurations: configurations },
  );
  const renderedLabel = hasFallback && renderedValue ? optionLabel(renderedValue) : null;

  return (
    <motion.label
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex h-8 items-center gap-2 rounded-xl bg-black/30 px-2 backdrop-blur-md"
    >
      <span className="hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35 sm:inline">
        Engine
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as RenderQuality)}
        aria-label="Engine configuration"
        title={hasFallback && renderedLabel ? `Performance fallback to ${renderedLabel}` : 'Engine configuration'}
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

export const QualitySelector = EngineConfigurationSelector;
export type QualitySelectorProps = EngineConfigurationSelectorProps;

