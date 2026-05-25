export interface DebugToggleProps {
  value: boolean;
  onChange: (enabled: boolean) => void;
}

export function DebugToggle({ value, onChange }: DebugToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      style={{
        background: value ? '#f59e0b' : '#111827',
        color: '#f8fafc',
        border: '1px solid #334155',
        borderRadius: 6,
        padding: '0.35rem 0.5rem',
      }}
    >
      Debug
    </button>
  );
}
