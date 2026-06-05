/**
 * packages/react/src/index.ts
 *
 * Public API for @hooksjam/pixi-lab-react.
 */

export { ExperienceRuntime, GameRuntime, SimulationRuntime, type ExperienceRuntimeProps, type GameRuntimeProps } from './GameRuntime.js';
export { GameTile, PreviewTile, type GameTileProps, type PreviewTileProps } from './GameTile.js';
export { GameLauncher, type GameLauncherProps } from './GameLauncher.js';
export { isRenderQuality, resolveRenderSelection, sanitizeRenderQuality } from './qualitySelection.js';
export { Gallery, type GalleryProps } from './Gallery.js';
export { AmbientLayer, type AmbientLayerProps } from './AmbientLayer.js';
export { ForegroundAmbientOverlay, type ForegroundAmbientOverlayProps } from './ForegroundAmbientOverlay.js';

// Viewport infrastructure
export { ViewportProvider, useViewportContext } from './ViewportProvider.js';
export { useViewport, type ViewportState, type SafeAreaInsets } from './hooks/useViewport.js';

// UI primitives (for host-app customisation)
export { HUD } from './ui/HUD.js';
export { QuitButton } from './ui/QuitButton.js';
export { IntroCard } from './ui/IntroCard.js';
export { TutorialOverlay } from './ui/TutorialOverlay.js';
export { PauseModal } from './ui/PauseModal.js';
export { GameOverModal } from './ui/GameOverModal.js';
export { PressHint } from './ui/PressHint.js';
export { StartCard } from './ui/StartCard.js';
export { SettingsDrawer } from './ui/SettingsDrawer.js';
export { StylePicker, type StylePickerProps } from './ui/StylePicker.js';
export { QualitySelector, type QualitySelectorProps } from './ui/QualitySelector.js';
export { DebugToggle, type DebugToggleProps } from './ui/DebugToggle.js';
export { DebugPanel, type DebugPanelProps } from './ui/DebugPanel.js';
export { ModeToggle, type ModeToggleProps } from './ui/ModeToggle.js';
export { ShaderTuningDrawer, type ShaderTuningDrawerProps } from './ui/ShaderTuningDrawer.js';
export { SimControlPanel, type SimControlPanelProps } from './ui/SimControlPanel.js';
export { BottomSheet, type BottomSheetProps } from './ui/BottomSheet.js';
export { OverflowMenu, type OverflowMenuProps, type OverflowItem } from './ui/OverflowMenu.js';
