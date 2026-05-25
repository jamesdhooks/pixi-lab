/**
 * packages/react/src/index.ts
 *
 * Public API for @hooksjam/pixi-lab-react.
 */

export { ExperienceRuntime, GameRuntime, SimulationRuntime, type ExperienceRuntimeProps, type GameRuntimeProps } from './GameRuntime';
export { GameTile, PreviewTile, type GameTileProps, type PreviewTileProps } from './GameTile';
export { GameLauncher, type GameLauncherProps } from './GameLauncher';
export { Gallery, type GalleryProps } from './Gallery';

// UI primitives (for host-app customisation)
export { HUD } from './ui/HUD';
export { QuitButton } from './ui/QuitButton';
export { IntroCard } from './ui/IntroCard';
export { TutorialOverlay } from './ui/TutorialOverlay';
export { PauseModal } from './ui/PauseModal';
export { GameOverModal } from './ui/GameOverModal';
export { SettingsDrawer } from './ui/SettingsDrawer';
export { StylePicker, type StylePickerProps } from './ui/StylePicker';
export { QualitySelector, type QualitySelectorProps } from './ui/QualitySelector';
export { DebugToggle, type DebugToggleProps } from './ui/DebugToggle';
export { ShaderTuningDrawer, type ShaderTuningDrawerProps } from './ui/ShaderTuningDrawer';
