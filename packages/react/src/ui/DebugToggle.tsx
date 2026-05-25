import { Bug } from 'lucide-react';

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
      aria-label="Toggle debug"
      className={`flex h-8 w-8 items-center justify-center rounded-xl backdrop-blur-md transition-colors ${
        value
          ? 'bg-amber-400/70 text-amber-900 hover:bg-amber-400'
          : 'bg-black/30 text-white/50 hover:bg-black/50 hover:text-white'
      }`}
    >
      <Bug size={14} />
    </button>
  );
}
