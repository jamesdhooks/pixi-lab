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
  renderFps?: number;
  frameMs: number;
  quality: string;
  interactionMode: string;
  aiEnabled?: boolean;
  bodyCount: number;
  awakeBodies?: number;
  canvasW: number;
  canvasH: number;
  bufferW?: number;
  bufferH?: number;
  resolution?: number;
  resizeCount?: number;
  heapMB: number | null;
  scene?: Record<string, string | number | boolean | null> | null;
}

export interface DebugPanelProps {
  app: GameApp | null;
}

export function DebugPanel({ app }: DebugPanelProps) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<DebugStats | null>(null);
  const buttonFps = stats?.fps;

  // Keep a cheap live snapshot running so the collapsed button can act as a
  // constant perf probe without opening the panel.
  useEffect(() => {
    if (!app) {
      setStats(null);
      return;
    }
    const id = setInterval(() => setStats(app.getDebugStats()), 500);
    setStats(app.getDebugStats()); // immediate first read
    return () => clearInterval(id);
  }, [app]);

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
              <StatRow label="render" value={stats?.renderFps != null ? String(stats.renderFps) : '—'} />
              <StatRow label="frame" value={stats ? `${stats.frameMs} ms` : '—'} />
              <StatRow label="quality" value={stats?.quality ?? '—'} />
              {stats?.interactionMode && (
                <StatRow label="mode" value={stats.interactionMode} />
              )}
              <StatRow label="ai" value={stats?.aiEnabled ? 'on' : 'off'} />
              <StatRow label="bodies" value={stats ? String(stats.bodyCount) : '—'} />
              <StatRow label="awake" value={stats?.awakeBodies != null ? String(stats.awakeBodies) : '—'} />
              <StatRow
                label="logical"
                value={stats ? `${stats.canvasW} × ${stats.canvasH}` : '—'}
              />
              <StatRow
                label="buffer"
                value={stats ? `${stats.bufferW ?? stats.canvasW} × ${stats.bufferH ?? stats.canvasH}` : '—'}
              />
              <StatRow
                label="res"
                value={stats?.resolution != null ? stats.resolution.toFixed(2) : '—'}
              />
              <StatRow
                label="resizes"
                value={stats?.resizeCount != null ? String(stats.resizeCount) : '—'}
              />
              {stats?.heapMB != null && (
                <StatRow label="heap" value={`${stats.heapMB} MB`} />
              )}
              {stats?.scene && Object.keys(stats.scene).length > 0 && (
                <>
                  <div className="pt-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
                    {getSceneStatsHeading(stats.scene)}
                  </div>
                  {Object.entries(stats.scene).map(([label, value]) => (
                    <StatRow key={label} label={formatSceneStatLabel(label)} value={formatSceneStatValue(value)} />
                  ))}
                </>
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
            className="flex h-8 w-[56px] items-center gap-1.5 rounded-xl bg-black/30 px-2 text-white/35 backdrop-blur-md transition-colors hover:bg-black/50 hover:text-amber-400"
          >
            <Bug size={14} />
            <span className="w-[3ch] text-right font-mono text-[11px] font-semibold text-white/75 [font-variant-numeric:tabular-nums]">
              {buttonFps != null ? String(buttonFps).padStart(2, ' ') : '--'}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function getSceneStatsHeading(scene: Record<string, string | number | boolean | null>): string {
  const renderer = typeof scene.renderer === 'string' ? scene.renderer : '';
  return renderer.includes('raw') || renderer.includes('webgl') ? 'Raw telemetry' : 'Scene';
}

function formatSceneStatLabel(label: string): string {
  return label.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`).toLowerCase();
}

function formatSceneStatValue(value: string | number | boolean | null): string {
  if (value === null) return '—';
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  return String(value);
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-white/40">{label}</span>
      <span className="text-white/80">{value}</span>
    </div>
  );
}
