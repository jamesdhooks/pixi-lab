import type { SimStyleManifest } from '@hooksjam/pixi-lab-core';

export interface StylePickerProps {
  manifest: SimStyleManifest;
  value: string;
  onChange: (styleId: string) => void;
}

export function StylePicker({ manifest, value, onChange }: StylePickerProps) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      aria-label="Style"
      style={{ background: '#111827', color: '#f8fafc', border: '1px solid #334155', borderRadius: 6, padding: '0.35rem 0.5rem' }}
    >
      {manifest.styles.map((style) => (
        <option key={style.id} value={style.id}>
          {style.name}
        </option>
      ))}
    </select>
  );
}
