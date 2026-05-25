import type { RenderQuality } from '@hooksjam/pixi-lab-core';

export interface QualitySelectorProps {
  value: RenderQuality;
  options: readonly RenderQuality[];
  onChange: (quality: RenderQuality) => void;
}

export function QualitySelector({ value, options, onChange }: QualitySelectorProps) {
  return (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      {options.map((quality) => (
        <button
          key={quality}
          type="button"
          onClick={() => onChange(quality)}
          style={{
            background: value === quality ? '#0ea5e9' : '#111827',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '0.35rem 0.5rem',
            textTransform: 'capitalize',
          }}
        >
          {quality}
        </button>
      ))}
    </div>
  );
}
