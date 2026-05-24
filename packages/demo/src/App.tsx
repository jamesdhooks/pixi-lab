import { useState } from 'react';
import { GameLauncher } from '@hooksjam/pixi-lab-react';
import { GAME_REGISTRY } from '@hooksjam/pixi-lab-games';
import type { GameDefinition } from '@hooksjam/pixi-lab-core';

export function App() {
  const [active, setActive] = useState<GameDefinition | null>(null);

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
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        pixi-lab
      </h1>
      <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
        Interactive games and simulations powered by PixiJS v8 + planck physics.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '1rem',
        }}
      >
        {GAME_REGISTRY.map((game) => (
          <button
            key={game.id}
            onClick={() => setActive(game)}
            style={{
              background: '#1e1e2e',
              border: '1px solid #2d2d3f',
              borderRadius: 12,
              padding: '1.5rem',
              textAlign: 'left',
              cursor: 'pointer',
              color: 'inherit',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#6366f1';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#2d2d3f';
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{game.icon}</div>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{game.name}</div>
            <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>{game.short}</div>
            <div
              style={{
                marginTop: '0.75rem',
                fontSize: '0.75rem',
                color: '#6366f1',
                fontWeight: 500,
              }}
            >
              {game.capabilities.aiAutoplay ? 'AI autoplay' : '1-player'}
              {game.capabilities.screensaver ? ' · screensaver' : ''}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
