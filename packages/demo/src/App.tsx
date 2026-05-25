import { useState } from 'react';
import { Gallery, GameLauncher } from '@hooksjam/pixi-lab-react';
import { GAME_REGISTRY } from '@hooksjam/pixi-lab-games';
import { SIMULATION_REGISTRY } from '@hooksjam/pixi-lab-simulations';
import type { LabExperience } from '@hooksjam/pixi-lab-core';

const ALL_EXPERIENCES: readonly LabExperience[] = [...GAME_REGISTRY, ...SIMULATION_REGISTRY];
type GalleryKind = 'all' | LabExperience['kind'];

export function App() {
  const [active, setActive] = useState<LabExperience | null>(null);
  const [activeKind, setActiveKind] = useState<GalleryKind>('all');

  if (active) {
    return (
      <div style={{ width: '100vw', height: '100vh' }}>
        <GameLauncher
          definition={active}
          onQuit={() => setActive(null)}
        />
      </div>
    );
  }

  return (
    <Gallery
      experiences={ALL_EXPERIENCES}
      activeKind={activeKind}
      onKindChange={setActiveKind}
      onSelect={setActive}
    />
  );
}
