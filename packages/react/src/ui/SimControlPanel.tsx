/**
 * SimControlPanel — stacked horizontal sliders at the bottom of the screen.
 * No card backgrounds, just transparent floating controls.
 */
import { type CSSProperties, type ReactNode, useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { GameApp, SettingsField } from '@hooksjam/pixi-lab-core';
import { useViewportContext } from '../ViewportProvider.js';

export interface SimControlPanelProps {
  app: GameApp | null;
  fields: SettingsField[];
  /** Bumped when the demo AI changes a setting — triggers a re-sync from app.settings. */
  settingsVersion?: number;
  /** Optional content shown at the top of the panel (e.g. StylePicker + ModeToggle on mobile). */
  headerSlot?: ReactNode;
}

function formatValue(value: number, field: SettingsField): string {
  const step = field.step ?? 1;
  const decimals = step < 1 ? String(step).split('.')[1]?.length ?? 1 : 0;
  return value.toFixed(decimals);
}

export function SimControlPanel({ app, fields, settingsVersion, headerSlot }: SimControlPanelProps) {
  const { safeArea, isMobile, isLandscape } = useViewportContext();
  const numericFields = fields.filter((f) => f.type === 'number');
  const selectFields = fields.filter((f) => f.type === 'select');
  const [values, setValues] = useState<Record<string, number>>({});
  const [selectValues, setSelectValues] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!app) return;
    const init: Record<string, number> = {};
    const initSelect: Record<string, string> = {};
    for (const f of numericFields) {
      const v = app.settings.get(f.key);
      init[f.key] = typeof v === 'number' ? v : (f.default as number);
    }
    for (const f of selectFields) {
      const v = app.settings.get(f.key);
      initSelect[f.key] = typeof v === 'string' ? v : String(f.default);
    }
    setValues(init);
    setSelectValues(initSelect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, settingsVersion]);

  const handleChange = useCallback(
    (key: string, value: number) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      app?.settings.set(key, value);
    },
    [app],
  );

  const handleSelectChange = useCallback(
    (key: string, value: string) => {
      setSelectValues((prev) => ({ ...prev, [key]: value }));
      app?.settings.set(key, value);
    },
    [app],
  );

  if (numericFields.length === 0 && selectFields.length === 0 && !headerSlot) return null;

  // On desktop, push controls below the HUD (which contains style dropdown on desktop).
  // HUD is ~44px tall (padding + 32px button height). Add gap for breathing room.
  // On mobile portrait, HUD is also present but more compact; still use similar offset.
  const hudHeight = 44; // safeArea.top + 12px padding + 8 + 24 height + gap
  const topOffset = `${(safeArea.top || 0) + 12 + hudHeight + 8}px`;
  // Narrow labels on mobile portrait to avoid overflow at 375 px.
  const labelClass = isMobile && !isLandscape
    ? 'w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-widest text-white/70'
    : 'w-24 shrink-0 text-right text-[10px] font-semibold uppercase tracking-widest text-white/70';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22, ease: 'easeOut', delay: 0.06 }}
      className="pointer-events-none absolute left-0 right-0 z-50 flex flex-col items-center gap-2 pl-12 pr-12"
      style={{ top: topOffset }}
    >
      {/* Header row: optional slot (style/mode) */}
      <div className="pointer-events-auto relative z-50 flex w-full max-w-xs items-center justify-center gap-2 overflow-visible">
        <div className="flex flex-col items-center gap-1.5 overflow-visible">
          {headerSlot}
        </div>
      </div>

      {/* Slider rows — animate in/out on collapse */}
      <AnimatePresence initial={false}>
        {!collapsed && numericFields.map((field) => {
          const val = values[field.key] ?? (field.default as number);
          return (
            <motion.div
              key={field.key}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: 'easeInOut' }}
              className="pointer-events-auto flex w-full max-w-xs items-center gap-3 overflow-hidden rounded-full bg-black/25 px-3 py-1 backdrop-blur-sm"
            >
              {/* Label */}
              <span className={labelClass}>
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
                  'h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/35',
                  '[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5',
                  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
                  '[&::-webkit-slider-thumb]:bg-white/90',
                  '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5',
                  '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0',
                  '[&::-moz-range-thumb]:bg-white/90',
                ].join(' ')}
              />
              {/* Value */}
              <span className="w-8 text-left font-mono text-[11px] font-semibold text-white/80">
                {formatValue(val, field)}
              </span>
            </motion.div>
          );
        })}
        {!collapsed && selectFields.map((field) => {
          const current = selectValues[field.key] ?? String(field.default);
          const options = field.options ?? [];
          const isInjectPalette = field.key === 'injectPalette';
          return (
            <motion.div
              key={field.key}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: 'easeInOut' }}
              className="pointer-events-auto flex w-full max-w-xs items-center gap-3 overflow-hidden rounded-full bg-black/25 px-3 py-1"
            >
              <span className={labelClass}>{field.label}</span>
              <div className="flex flex-1 items-center justify-end gap-1.5 overflow-x-auto">
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelectChange(field.key, opt.value)}
                    title={opt.label}
                    aria-label={opt.label}
                    className={[
                      isInjectPalette
                        ? 'h-5 w-5 rounded-full border transition-transform'
                        : 'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                      isInjectPalette
                        ? (current === opt.value
                            ? 'border-white ring-2 ring-white/55 scale-105'
                            : 'border-white/35 hover:border-white/75')
                        : (current === opt.value
                            ? 'bg-white text-black'
                            : 'bg-white/10 text-white/80 hover:bg-white/20'),
                    ].join(' ')}
                    style={isInjectPalette ? chipStyleForInjectOption(opt.value) : undefined}
                  >
                    {!isInjectPalette ? opt.label : ''}
                  </button>
                ))}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Collapse/expand chevron — positioned below all controls */}
      {(numericFields.length > 0 || selectFields.length > 0 || headerSlot) && (
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand controls' : 'Collapse controls'}
          className="pointer-events-auto flex shrink-0 items-center justify-center py-1 text-white/25 transition-colors hover:text-white/60"
        >
          {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      )}
    </motion.div>
  );
}

function chipStyleForInjectOption(value: string): CSSProperties {
  if (value === 'cyan') return { background: '#35ffe5' };
  if (value === 'magenta') return { background: '#ff41dc' };
  if (value === 'amber') return { background: '#ffbe4a' };
  if (value === 'rainbow') {
    return {
      background:
        'conic-gradient(from 210deg, #ff4d4d, #ffb84d, #f8ff4d, #4dff8e, #4dd8ff, #824dff, #ff4de3, #ff4d4d)',
    };
  }
  return {
    background:
      'linear-gradient(135deg, #35ffe5 0%, #4dd8ff 33%, #ff41dc 66%, #ffbe4a 100%)',
  };
}
