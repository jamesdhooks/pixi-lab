/**
 * components/games/ui/SettingsDrawer.tsx
 *
 * Auto-renders SettingsField[] from the engine Settings instance.
 * Slide-up drawer shown when the user taps the settings button.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { Settings } from '@hooksjam/pixi-lab-core';
import type { SettingsField } from '@hooksjam/pixi-lab-core';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  fields: SettingsField[];
}

export function SettingsDrawer({ open, onClose, settings, fields }: SettingsDrawerProps) {
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

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/50"
            onClick={onClose}
          />
          <motion.div
            key="drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="absolute inset-x-0 bottom-0 z-50 max-h-[70%] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-gray-900/95 p-6 backdrop-blur-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Settings</h3>
              <button onClick={onClose} className="text-white/50 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5">
              {fields.map((field) => (
                <FieldRow
                  key={field.key}
                  field={field}
                  value={vals[field.key]}
                  onChange={(v) => apply(field.key, v)}
                />
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

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
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-white">{field.label}</p>
        {field.description && <p className="mt-0.5 text-xs text-white/50">{field.description}</p>}
      </div>

      {field.type === 'boolean' && (
        <button
          onClick={() => onChange(!value)}
          className={`relative h-6 w-10 rounded-full transition-colors ${value ? 'bg-green-500' : 'bg-white/20'}`}
          role="switch"
          aria-checked={Boolean(value)}
        >
          <motion.div
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
            animate={{ x: value ? 18 : 2 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          />
        </button>
      )}

      {field.type === 'number' && (
        <div className="flex items-center gap-2">
          <span className="w-8 text-right text-xs text-white/60">
            {typeof value === 'number' ? value : field.min}
          </span>
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={typeof value === 'number' ? value : (field.min ?? 0)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-24 accent-white"
          />
        </div>
      )}

      {field.type === 'select' && (
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs text-white"
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-gray-800">
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
