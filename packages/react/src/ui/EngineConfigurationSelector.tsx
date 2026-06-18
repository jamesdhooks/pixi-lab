import { motion } from 'framer-motion';
import type { RenderQuality } from '@hooksjam/pixi-lab-core';

export interface EngineConfigurationOption {
  id: RenderQuality;
  label: string;
  legacyQuality: RenderQuality;
}

export interface EngineConfigurationSelectorProps {
  value: RenderQuality;
  renderedValue?: RenderQuality;
  options: readonly EngineConfigurationOption[];
  onChange: (selection: EngineConfigurationOption) => void;
}

export function EngineConfigurationSelector({
  value,
  renderedValue,
  options,
  onChange,
}: EngineConfigurationSelectorProps) {
  const selected = options.find((option) => option.id === value) ?? options[0];
  const rendered = renderedValue ? options.find((option) => option.id === renderedValue) : undefined;
  const hasFallback = rendered !== undefined && rendered.id !== selected?.id;

  if (!selected) return null;

  return (
    <motion.label
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex h-8 items-center gap-2 rounded-xl bg-black/30 px-2 text-xs font-semibold text-white/75 backdrop-blur-md"
    >
      <span className="hidden text-[10px] uppercase tracking-[0.18em] text-white/35 sm:inline">Engine</span>
      <select
        aria-label="Engine configuration"
        value={selected.id}
        onChange={(event) => {
          const next = options.find((option) => option.id === event.target.value);
          if (next) onChange(next);
        }}
        className="h-6 rounded-lg border border-white/10 bg-black/40 px-2 text-xs font-semibold text-white outline-none transition-colors hover:border-white/25 focus:border-cyan-300/60"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {hasFallback && rendered && (
        <span className="hidden text-[10px] font-medium uppercase tracking-[0.14em] text-red-300/80 sm:inline">
          Rendering {rendered.label}
        </span>
      )}
    </motion.label>
  );
}
