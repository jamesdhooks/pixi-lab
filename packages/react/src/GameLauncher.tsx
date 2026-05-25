/**
 * packages/react/src/GameLauncher.tsx
 *
 * Full-screen game shell. Shows intro card → gameplay → pause modal → game over.
 * App-agnostic: score data and navigation are injected via props.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { GameRuntime } from './GameRuntime';
import { QuitButton } from './ui/QuitButton';
import { IntroCard } from './ui/IntroCard';
import { TutorialOverlay } from './ui/TutorialOverlay';
import { PauseModal } from './ui/PauseModal';
import { GameOverModal } from './ui/GameOverModal';
import { HUD } from './ui/HUD';
import { SettingsDrawer } from './ui/SettingsDrawer';
import { StylePicker } from './ui/StylePicker';
import { QualitySelector } from './ui/QualitySelector';
import { DebugToggle } from './ui/DebugToggle';
import { nameSuggestions } from '@hooksjam/pixi-lab-core';
import type { LabExperience } from '@hooksjam/pixi-lab-core';
import type { GameEvent, RenderQuality, ScoreEntry } from '@hooksjam/pixi-lab-core';
import type { GameApp } from '@hooksjam/pixi-lab-core';

type Shell = 'intro' | 'tutorial' | 'playing' | 'paused' | 'gameover';

export interface GameLauncherProps {
  definition: LabExperience;
  userId?: string;
  /** Top scores for the leaderboard — fetched by the host app */
  topScores?: ScoreEntry[];
  /** Called when the user submits a score — host app persists it */
  onSubmitScore?: (score: number, name: string) => Promise<void>;
  /** Called when the user quits — host app handles navigation */
  onQuit?: () => void;
}

export function GameLauncher({
  definition,
  userId,
  topScores = [],
  onSubmitScore,
  onQuit,
}: GameLauncherProps) {
  const [shell, setShell] = useState<Shell>('intro');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState<number | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [styleId, setStyleId] = useState(definition.styleManifest?.defaultStyleId ?? '');
  const [quality, setQuality] = useState<RenderQuality>('basic');
  const [debugEnabled, setDebugEnabled] = useState(false);
  const appRef = useRef<GameApp | null>(null);

  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    nameSuggestions.load().then(setSuggestions).catch(() => {});
  }, []);

  const handleEvent = useCallback((event: GameEvent) => {
    switch (event.kind) {
      case 'score_update':
        if (typeof event.value === 'number') setScore(event.value);
        break;
      case 'lives_update':
        if (typeof event.value === 'number') setLives(event.value);
        break;
      case 'game_over':
        setShell('gameover');
        break;
      default:
        break;
    }
  }, []);

  const handleQuit = useCallback(() => {
    onQuit?.();
  }, [onQuit]);

  const handlePlay = useCallback(() => {
    setShell('playing');
  }, []);

  const handleRestart = useCallback(() => {
    setScore(0);
    setLives(undefined);
    setShell('intro');
  }, []);

  const handlePause = useCallback(() => {
    appRef.current?.pause();
    setShell('paused');
  }, []);

  const handleResume = useCallback(() => {
    appRef.current?.resume();
    setShell('playing');
  }, []);

  const handleScoreSubmit = useCallback(
    async (name: string) => {
      await onSubmitScore?.(score, name);
    },
    [onSubmitScore, score],
  );

  const tutorialPages = definition.tutorialPages ?? [];
  const isSimulation = definition.kind === 'simulation';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black">
      {/* Game canvas — always mounted so we have it ready */}
      <GameRuntime
        definition={definition}
        userId={userId}
        mode="play"
        onEvent={handleEvent}
        onReady={(app) => {
          appRef.current = app;
        }}
        className="absolute inset-0"
      />

      {/* Overlays */}
      {shell === 'intro' && (
        <IntroCard
          icon={definition.icon}
          name={definition.name}
          short={definition.short}
          long={definition.long}
          onPlay={() => {
            if (tutorialPages.length > 0) {
              setShell('tutorial');
            } else {
              handlePlay();
            }
          }}
          onHowToPlay={tutorialPages.length > 0 ? () => setShell('tutorial') : undefined}
          onQuit={handleQuit}
        />
      )}

      {shell === 'tutorial' && tutorialPages.length > 0 && (
        <TutorialOverlay pages={tutorialPages} onDone={handlePlay} />
      )}

      {shell === 'playing' && (
        <>
          <QuitButton onQuit={handleQuit} />
          {isSimulation ? (
            <div style={{ position: 'absolute', left: 16, top: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
              {definition.styleManifest && (
                <StylePicker
                  manifest={definition.styleManifest}
                  value={styleId}
                  onChange={(nextStyleId) => {
                    setStyleId(nextStyleId);
                    appRef.current?.setStyle(nextStyleId);
                  }}
                />
              )}
              <QualitySelector
                value={quality}
                options={definition.capabilities.qualityModes ?? ['basic', 'enhanced']}
                onChange={(nextQuality) => {
                  setQuality(nextQuality);
                  appRef.current?.setQuality(nextQuality);
                }}
              />
              <DebugToggle
                value={debugEnabled}
                onChange={(enabled) => {
                  setDebugEnabled(enabled);
                  appRef.current?.setDebugEnabled(enabled);
                }}
              />
              <button type="button" onClick={handlePause} style={{ background: '#111827', color: '#f8fafc', border: '1px solid #334155', borderRadius: 6, padding: '0.35rem 0.5rem' }}>
                Pause
              </button>
            </div>
          ) : (
            <HUD score={score} lives={lives} onPause={handlePause} />
          )}
        </>
      )}

      {shell === 'paused' && (
        <PauseModal
          onResume={handleResume}
          onSettings={
            definition.settingsFields.length > 0 ? () => setSettingsOpen(true) : undefined
          }
          onQuit={handleQuit}
        />
      )}

      {shell === 'gameover' && (
        definition.kind === 'game' ? (
          <GameOverModal
            score={score}
            suggestions={suggestions}
            topScores={topScores}
            onSubmit={handleScoreSubmit}
            onRestart={handleRestart}
            onQuit={handleQuit}
          />
        ) : null
      )}

      {appRef.current && (
        <SettingsDrawer
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settings={appRef.current.settings}
          fields={definition.settingsFields}
        />
      )}
    </div>
  );
}
