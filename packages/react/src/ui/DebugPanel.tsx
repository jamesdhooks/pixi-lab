/**
 * components/games/ui/DebugPanel.tsx
 *
 * Bottom-right floating debug panel.
 * Collapsed: a small bug-icon button.
 * Expanded: a compact card showing live engine stats.
 * Toggling the panel also enables/disables the in-canvas DebugOverlay.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, X } from 'lucide-react';
import type { GameApp } from '@hooksjam/pixi-lab-core';

interface DebugStats {
  fps: number;
  frameMs: number;
  quality: string;
  interactionMode: string;
  bodyCount: number;
  canvasW: number;
  canvasH: number;
  heapMB: number | null;
}

export interface DebugPanelProps {
  app: GameApp | null;
}

export function DebugPanel({ app }: DebugPanelProps) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<DebugStats | null>(null);

  // Poll stats while open
  useEffect(() => {
    if (!open || !app) return;
    const id = setInterval(() => setStats(app.getDebugStats()), 500);
    setStats(app.getDebugStats()); // immediate first read
    return () => clearInterval(id);
  }, [open, app]);

  // Turn off when app changes (e.g. scene restart)
  useEffect(() => {
    if (!app) setOpen(false);
  }, [app]);

  return (
    <div className="pointer-events-auto">
      <AnimatePresence mode="wait">
        {open ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.92, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 6 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            onClick={() => setOpen(false)}
            className="min-w-[170px] cursor-pointer rounded-2xl bg-black/75 p-4 shadow-2xl backdrop-blur-xl"
          >
            {/* Header */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bug size={12} className="text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                  Debug
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/30 transition-colors hover:text-white"
                aria-label="Close debug panel"
              >
                <X size={12} />
              </button>
            </div>

            {/* Stats */}
            <div className="space-y-1.5 font-mono text-xs">
              <StatRow label="fps" value={stats ? String(stats.fps) : '—'} />
              <StatRow label="frame" value={stats ? `${stats.frameMs} ms` : '—'} />
              <StatRow label="quality" value={stats?.quality ?? '—'} />
              {stats?.interactionMode && (
                <StatRow label="mode" value={stats.interactionMode} />
              )}
              <StatRow label="bodies" value={stats ? String(stats.bodyCount) : '—'} />
              <StatRow
                label="canvas"
                value={stats ? `${stats.canvasW} × ${stats.canvasH}` : '—'}
              />
              {stats?.heapMB != null && (
                <StatRow label="heap" value={`${stats.heapMB} MB`} />
              )}
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="btn"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setOpen(true)}
            aria-label="Open debug panel"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/30 text-white/35 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-amber-400"
          >
            <Bug size={14} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-white/40">{label}</span>
      <span className="text-white/80">{value}</span>
    </div>
  );
}
