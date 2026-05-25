import type { LabExperience } from '@hooksjam/pixi-lab-core';
import { PreviewTile } from './GameTile';

export interface GalleryProps {
  experiences: readonly LabExperience[];
  activeKind: 'all' | LabExperience['kind'];
  onKindChange: (kind: 'all' | LabExperience['kind']) => void;
  onSelect: (experience: LabExperience) => void;
}

export function Gallery({ experiences, activeKind, onKindChange, onSelect }: GalleryProps) {
  const filtered = activeKind === 'all' ? experiences : experiences.filter((experience) => experience.kind === activeKind);
  const kinds: Array<'all' | LabExperience['kind']> = ['all', 'game', 'simulation', 'toy'];

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>pixi-lab</h1>
      <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>Interactive games and simulations powered by PixiJS v8.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => onKindChange(kind)}
            style={{
              background: activeKind === kind ? '#2563eb' : '#1e293b',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: 6,
              padding: '0.45rem 0.7rem',
              textTransform: 'capitalize',
            }}
          >
            {kind}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
        {filtered.map((experience, index) => (
          <div key={experience.id} style={{ display: 'grid', gap: 8 }}>
            <PreviewTile definition={experience} onPress={() => onSelect(experience)} index={index} />
            <div>
              <div style={{ fontWeight: 700 }}>{experience.name}</div>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>{experience.short}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
