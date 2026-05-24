/**
 * packages/react/src/index.ts
 *
 * Public API for @hooksjam/pixi-lab-react.
 */

export { GameRuntime, type GameRuntimeProps } from './GameRuntime';
export { GameTile, type GameTileProps } from './GameTile';
export { GameLauncher, type GameLauncherProps } from './GameLauncher';

// UI primitives (for host-app customisation)
export { HUD } from './ui/HUD';
export { QuitButton } from './ui/QuitButton';
export { IntroCard } from './ui/IntroCard';
export { TutorialOverlay } from './ui/TutorialOverlay';
export { PauseModal } from './ui/PauseModal';
export { GameOverModal } from './ui/GameOverModal';
export { SettingsDrawer } from './ui/SettingsDrawer';
