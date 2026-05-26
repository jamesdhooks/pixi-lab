import type { SimStyle } from '@hooksjam/pixi-lab-core';
import { BottomSheet } from './BottomSheet.js';
import { useViewportContext } from '../ViewportProvider.js';

export interface ShaderTuningDrawerProps {
  open: boolean;
  style: SimStyle | null;
}

export function ShaderTuningDrawer({ open, style }: ShaderTuningDrawerProps) {
  const { isMobile, isLandscape, safeArea } = useViewportContext();

  if (!open || !style?.uniformSchema?.length) return null;

  const controls = style.uniformSchema.map((uniform) => (
    <label key={uniform.key} style={{ display: 'block', fontSize: 12, marginBottom: 10 }}>
      <span>{uniform.label}</span>
      <input
        type="range"
        min={uniform.min}
        max={uniform.max}
        step={uniform.step}
        defaultValue={String(uniform.default)}
        style={{ width: '100%' }}
        aria-label={uniform.label}
      />
    </label>
  ));

  if (isMobile && !isLandscape) {
    return (
      <BottomSheet open={open} onClose={() => { /* caller manages open */ }} title="Tuning">
        <div style={{ padding: 12 }}>{controls}</div>
      </BottomSheet>
    );
  }

  return (
    <aside
      style={{
        position: 'absolute',
        right: 16,
        top: 72 + (safeArea.top || 0),
        width: 260,
        background: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(148, 163, 184, 0.35)',
        borderRadius: 8,
        padding: 12,
        color: '#f8fafc',
      }}
    >
      {controls}
    </aside>
  );
}
