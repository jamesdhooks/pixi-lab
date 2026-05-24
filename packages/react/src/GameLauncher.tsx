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
import { nameSuggestions } from '@hooksjam/pixi-lab-core';
import type { GameDefinition } from '@hooksjam/pixi-lab-core';
import type { GameEvent, ScoreEntry } from '@hooksjam/pixi-lab-core';
import type { GameApp } from '@hooksjam/pixi-lab-core';

type Shell = 'intro' | 'tutorial' | 'playing' | 'paused' | 'gameover';

export interface GameLauncherProps {
  definition: GameDefinition;
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
          <HUD score={score} lives={lives} onPause={handlePause} />
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
        <GameOverModal
          score={score}
          suggestions={suggestions}
          topScores={topScores}
          onSubmit={handleScoreSubmit}
          onRestart={handleRestart}
          onQuit={handleQuit}
        />
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
