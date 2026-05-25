/**
 * SimControlPanel — stacked horizontal sliders at the bottom of the screen.
 * No card backgrounds, just transparent floating controls.
 */
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { GameApp, SettingsField } from '@hooksjam/pixi-lab-core';

export interface SimControlPanelProps {
  app: GameApp | null;
  fields: SettingsField[];
  /** Bumped when the demo AI changes a setting — triggers a re-sync from app.settings. */
  settingsVersion?: number;
}

function formatValue(value: number, field: SettingsField): string {
  const step = field.step ?? 1;
  const decimals = step < 1 ? String(step).split('.')[1]?.length ?? 1 : 0;
  return value.toFixed(decimals);
}

export function SimControlPanel({ app, fields, settingsVersion }: SimControlPanelProps) {
  const numericFields = fields.filter((f) => f.type === 'number');
  const [values, setValues] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!app) return;
    const init: Record<string, number> = {};
    for (const f of numericFields) {
      const v = app.settings.get(f.key);
      init[f.key] = typeof v === 'number' ? v : (f.default as number);
    }
    setValues(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, settingsVersion]);

  const handleChange = useCallback(
    (key: string, value: number) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      app?.settings.set(key, value);
    },
    [app],
  );

  if (numericFields.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut', delay: 0.06 }}
      className="pointer-events-none absolute left-0 right-0 top-16 z-20 flex flex-col items-center gap-2 px-8"
    >
      {numericFields.map((field) => {
        const val = values[field.key] ?? (field.default as number);
        return (
          <div key={field.key} className="pointer-events-auto flex w-full max-w-xs items-center gap-3">
            {/* Label */}
            <span className="w-24 shrink-0 text-right text-[10px] font-semibold uppercase tracking-widest text-white/40">
              {field.label}
            </span>
            {/* Slider */}
            <input
              type="range"
              min={field.min}
              max={field.max}
              step={field.step}
              value={val}
              onChange={(e) => handleChange(field.key, parseFloat(e.target.value))}
              className={[
                'h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20',
                '[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5',
                '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
                '[&::-webkit-slider-thumb]:bg-white/90',
                '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5',
                '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0',
                '[&::-moz-range-thumb]:bg-white/90',
              ].join(' ')}
            />
            {/* Value */}
            <span className="w-8 text-left font-mono text-[11px] font-semibold text-white/60">
              {formatValue(val, field)}
            </span>
          </div>
        );
      })}
    </motion.div>
  );
}
