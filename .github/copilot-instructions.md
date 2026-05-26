# pixi-lab — Copilot Instructions

> **START HERE.** Read this file before touching any code.

## Project Identity

- **Package:** `@hooksjam/pixi-lab` (monorepo)
- **Purpose:** Standalone, publishable PixiJS v8 game engine and game content library
- **Stack:** TypeScript 5.4+ strict · PixiJS v8 · planck physics v1 · React 18 · Vite 5
- **Package manager:** pnpm ONLY. Never use `npm` or `yarn`.
- **Structure:**
  - `packages/core` → `@hooksjam/pixi-lab-core` — engine types, GameApp, scenes, physics, AI, scoring
  - `packages/react` → `@hooksjam/pixi-lab-react` — React shell (GameRuntime, GameLauncher, GameTile, UI)
  - `packages/games` → `@hooksjam/pixi-lab-games` — game content (Ball Pit, etc.)
  - `packages/simulations` → `@hooksjam/pixi-lab-simulations` — simulation content (Harmonic Sand Plate, etc.)
  - `packages/demo` → demo app (Vite SPA, not published)

## Non-Negotiable Rules

1. **TypeScript strict** — no `any`, no `@ts-ignore` without an explanatory comment
2. **No `console.log`** in library code — use a logger or remove debug logging before commit
3. **`@hooksjam/pixi-lab-core` is the single import** for all engine types — never import directly from `pixi.js` or `planck` in `packages/react` or `packages/games`
4. **`LabExperience` lives in `packages/core`** (`LabExperience.ts`) — this is the shared contract between games, simulations, and toys
5. **`GameLauncher` in packages/react is app-agnostic** — no routing, no fetch calls. Host apps inject `onQuit`, `onSubmitScore`, `topScores` props
6. **Each game is a self-contained folder** under `packages/games/src/<game-name>/`
7. **Simulation rendering must use the appropriate core renderer family** — do not default to a generic field painter. Field sims use `FieldPaletteRenderer`; blobs use `DensityMetaballRenderer`; trails use `TrailFeedbackRenderer`; triangular/crystal/fungal grids use `MeshLatticeRenderer`; plasma/discharge/streak systems use `ArcLineRenderer`; agents/debris use `ParticlePointRenderer`.
8. **Conventional Commits enforced.** Format: `type(scope): subject`
  - Valid scopes: `core`, `react`, `games`, `sims`, `demo`, `ci`, `deps`, `config`

## Architecture

```
packages/core/src/
  types.ts            — all primitive types (Vec2, GameEvent, ScoreEntry, …)
  LabExperience.ts    — LabExperience interface/union (the shared contract)
  GameApp.ts          — main runtime orchestrator
  Scene.ts            — base scene class
  physics/            — planck wrappers
  render/             — PixiJS wrappers and shared renderer families
  ai/                 — AI controller abstractions
  scoring/            — HighScoreProvider, NameSuggestions
  screensaver/        — ScreensaverManager
  index.ts            — public barrel (everything a consumer needs)

packages/react/src/
  GameRuntime.tsx     — mounts canvas, owns GameApp lifecycle
  GameTile.tsx        — animated tile with live preview canvas
  GameLauncher.tsx    — full-screen shell (intro→play→pause→gameover)
  ui/                 — HUD, QuitButton, IntroCard, TutorialOverlay, PauseModal, GameOverModal, SettingsDrawer
  index.ts            — public barrel

packages/games/src/
  <game-name>/        — one folder per game (see add-experience skill)
  index.ts            — GAME_REGISTRY, getGame()

packages/simulations/src/
  <simulation-name>/  — one folder per simulation (see add-simulation skill)
  index.ts            — SIMULATION_REGISTRY, getSimulation()
```

## Common Commands

```bash
pnpm install                              # install all workspace deps
pnpm --filter @hooksjam/pixi-lab-core build   # build core
pnpm --recursive build                    # build all packages
pnpm --recursive typecheck                # typecheck all packages
pnpm --filter @hooksjam/pixi-lab-demo dev # run demo app
pnpm test                                 # run all tests (Vitest)
```

## Adding a New Game or Simulation

Use the `/add-experience` skill (`.github/skills/add-experience/SKILL.md`). It routes to game or simulation scaffolding.

## What NOT to Do

```typescript
// ❌ Never import pixi.js directly in packages/react or packages/games
import { Container } from 'pixi.js'; // use @hooksjam/pixi-lab-core

// ❌ Never put routing or fetch calls in packages/react/GameLauncher
import { useNavigate } from 'react-router'; // belongs in the host app wrapper

// ❌ Never call GameApp directly from a game definition file
import { GameApp } from '@hooksjam/pixi-lab-core'; // only in packages/react

// ❌ Never add a game or simulation directly to a registry without a definition file
// Add to packages/games/src/<name>/<name>.definition.ts or packages/simulations/src/<name>/<name>.definition.ts first
```
