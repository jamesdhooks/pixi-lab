/**
 * components/games/ui/SettingsDrawer.tsx
 *
 * Game/simulation settings panel — a compact dropdown anchored to the top-right
 * controls bar. Opens below the settings button with a slide-down animation.
 * Less blur, less dramatic than a full modal.
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Check } from 'lucide-react';
import type { Settings } from '@hooksjam/pixi-lab-core';
import type { SettingsField } from '@hooksjam/pixi-lab-core';
import { BottomSheet } from './BottomSheet.js';
import { useViewportContext } from '../ViewportProvider.js';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  fields: SettingsField[];
  maxPixels?: number;
  onMaxPixelsChange?: (v: number | undefined) => void;
}

export function SettingsDrawer({ open, onClose, settings, fields, maxPixels, onMaxPixelsChange }: SettingsDrawerProps) {
  const { isMobile, isLandscape } = useViewportContext();
  const [vals, setVals] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!open) return;
    const next: Record<string, unknown> = {};
    for (const f of fields) {
      next[f.key] = settings.get(f.key);
    }
    setVals(next);
  }, [open, fields, settings]);

  const apply = (key: string, value: unknown) => {
    settings.set(key, value as string | number | boolean);
    setVals((prev) => ({ ...prev, [key]: value }));
  };

  const PIXEL_PRESETS: Array<{ label: string; sub: string; value: number | undefined }> = [
    { label: 'Off', sub: 'unlimited', value: undefined },
    { label: '360p', sub: '640×360', value: 230_400 },
    { label: '720p', sub: '1280×720', value: 921_600 },
    { label: '1080p', sub: '1920×1080', value: 2_073_600 },
  ];

  const content = (
    <div className="p-3 space-y-0.5">
      {/* ── Common: resolution (pixel budget) ── */}
      <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Resolution</p>
      <div className="grid grid-cols-4 gap-1 mb-2">
        {PIXEL_PRESETS.map(({ label, sub, value }) => (
          <button
            key={label}
            onClick={() => onMaxPixelsChange?.(value)}
            className={`flex flex-col items-center py-1.5 rounded-xl transition-colors ${
              maxPixels === value
                ? 'bg-white/15 text-white'
                : 'bg-white/[0.05] text-white/40 hover:bg-white/10 hover:text-white/70'
            }`}
          >
            <span className="text-[11px] font-bold leading-none">{label}</span>
            <span className="text-[9px] mt-0.5 opacity-60">{sub}</span>
          </button>
        ))}
      </div>

      {/* ── Experience-specific settings ── */}
      {fields.length > 0 && (
        <>
          <div className="mx-0 my-2 h-px bg-white/8" />
          <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Experience</p>
          {fields.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              value={vals[field.key]}
              onChange={(v) => apply(field.key, v)}
            />
          ))}
        </>
      )}
    </div>
  );

  // Mobile portrait — render as a BottomSheet
  if (isMobile && !isLandscape) {
    return (
      <BottomSheet open={open} onClose={onClose} title="Settings">
        {content}
      </BottomSheet>
    );
  }

  // Desktop / landscape — existing dropdown anchored top-right
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Transparent click-catcher for outside-dismiss */}
          <div className="absolute inset-0 z-40" onClick={onClose} />

          {/* Dropdown panel — slides in from top-right */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-3 top-12 z-50 w-80 max-h-[70vh] overflow-y-auto rounded-2xl bg-black/80 shadow-xl backdrop-blur-md ring-1 ring-white/12"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-sm font-bold text-white">Settings</h3>
              <button
                onClick={onClose}
                className="text-white/40 transition-colors hover:text-white"
                aria-label="Close settings"
              >
                <X size={14} />
              </button>
            </div>

            {/* Divider */}
            <div className="mx-4 h-px bg-white/8" />

            {content}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Field row ──────────────────────────────────────────────────────────────────

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: SettingsField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl px-2 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{field.label}</p>
        {field.description && (
          <p className="mt-0.5 text-xs leading-snug text-white/45">{field.description}</p>
        )}
      </div>

      <div className="shrink-0">
        {field.type === 'boolean' && (
          <ToggleSwitch value={Boolean(value)} onChange={onChange} />
        )}
        {field.type === 'number' && (
          <NumberSlider field={field} value={value} onChange={onChange} />
        )}
        {field.type === 'select' && (
          <CustomSelect field={field} value={value} onChange={onChange} />
        )}
      </div>
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: unknown) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative h-7 w-12 rounded-full transition-colors duration-200 ${
        value ? 'bg-emerald-500' : 'bg-white/15'
      }`}
    >
      <motion.div
        className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md"
        animate={{ x: value ? 22 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

// ── Number slider ─────────────────────────────────────────────────────────────

function NumberSlider({
  field,
  value,
  onChange,
}: {
  field: SettingsField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const num = typeof value === 'number' ? value : (field.min ?? 0);
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={field.min}
        max={field.max}
        step={field.step ?? 1}
        value={num}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-28 cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
      />
      <span className="w-9 text-right text-sm tabular-nums text-white/60">{num}</span>
    </div>
  );
}

// ── Custom select ─────────────────────────────────────────────────────────────

function CustomSelect({
  field,
  value,
  onChange,
}: {
  field: SettingsField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  // Capture button position at open time so the fixed dropdown aligns correctly
  // even inside a scroll container (overflow-y: auto clips absolute children).
  const [btnRect, setBtnRect] = useState<{ top: number; bottom: number; right: number; width: number } | null>(null);
  const current = field.options?.find((o) => o.value === String(value));

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setBtnRect({ top: r.top, bottom: r.bottom, right: window.innerWidth - r.right, width: r.width });
    }
    setOpen((o) => !o);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Determine whether to open upward if near the bottom of the viewport
  const openUpward = btnRect ? btnRect.bottom > window.innerHeight * 0.65 : false;

  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="flex min-w-[110px] items-center justify-between gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm text-white ring-1 ring-white/15 transition-colors hover:bg-white/15"
      >
        <span className="truncate">{current?.label ?? String(value)}</span>
        <ChevronDown
          size={13}
          className={`shrink-0 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && btnRect && (
          <motion.div
            initial={{ opacity: 0, y: openUpward ? 4 : -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUpward ? 4 : -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'fixed',
              ...(openUpward
                ? { bottom: window.innerHeight - btnRect.top + 6 }
                : { top: btnRect.bottom + 6 }),
              right: btnRect.right,
              minWidth: Math.max(btnRect.width, 130),
            }}
            className="z-[9999] overflow-hidden rounded-xl bg-black/90 p-1 shadow-2xl ring-1 ring-white/20 backdrop-blur-xl"
          >
            {field.options?.map((opt) => {
              const active = opt.value === String(value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-white/15 text-white'
                      : 'text-white/65 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span>{opt.label}</span>
                  {active && <Check size={12} className="shrink-0 text-emerald-400" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
