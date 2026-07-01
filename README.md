# Pixi Lab

A standalone, publishable **PixiJS v8** game engine and interactive experience library — built as a pnpm monorepo with TypeScript 5.4+ strict mode throughout.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-0f62fe?logo=github&logoColor=white)](https://jamesdhooks.github.io/pixi-lab/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PixiJS](https://img.shields.io/badge/PixiJS-v8-e72264?logo=data:image/svg+xml;base64,)](https://pixijs.com/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-f69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

**[▶ Open live demo →](https://jamesdhooks.github.io/pixi-lab/)**

---

## Packages

| Package | Version | Description |
|---|---|---|
| [`@hooksjam/pixi-lab-core`](packages/core) | 0.1.0 | Engine: game loop, scene lifecycle, input, physics, AI, render systems, scoring |
| [`@hooksjam/pixi-lab-react`](packages/react) | 0.1.0 | React shell: `GameRuntime`, `GameLauncher`, `GameTile`, full UI library |
| [`@hooksjam/pixi-lab-games`](packages/games) | 0.1.0 | Game content registry (`GAME_REGISTRY`) |
| [`@hooksjam/pixi-lab-simulations`](packages/simulations) | 0.1.0 | Simulation content registry (`SIMULATION_REGISTRY`) including Pixi and raw WebGL-backed scenes |
| [`@hooksjam/pixi-lab-ambients`](packages/ambients) | 0.1.0 | Ambient / overlay content registry (`AMBIENT_REGISTRY`) |
| [`@hooksjam/pixi-lab-demo`](packages/demo) | — | Vite demo app and dashboard (not published) |

---

## Quick Start

```bash
# Requires Node ≥ 20 and pnpm ≥ 9
pnpm install
pnpm --filter @hooksjam/pixi-lab-demo dev
```

Open `http://localhost:5173` to browse and launch all experiences.

---

## Architecture

```
packages/
  core/src/
    GameApp.ts          Main runtime orchestrator
    LabExperience.ts    Shared contract for games, simulations, and toys
    Scene.ts            Base scene class
    types.ts            Primitive types (Vec2, GameEvent, ScoreEntry, …)
    ai/                 AI controller abstractions (BasicAI, DemoAI, SimulationAI)
    ambient/            Ambient background layer system
    debug/              In-app debug panel
    director/           Scene-level director / scripting
    fx/                 Visual effects helpers
    gestures/           Pointer gesture recogniser (tap, drag, swipe, hold, pinch)
    performance/        Adaptive quality / FPS guard
    physics/            planck-js wrappers (Bodies, World, Categories, Pool)
    render/             PixiJS wrappers (PixiApp, Sprites, Particles, passes, procedural)
    scoring/            HighScoreProvider, NameSuggestions
    screensaver/        ScreensaverManager
    sim/                Simulation base utilities, including DomScriptScene for DOM/WebGL adapters
    stagnation/         Stagnation-detection for auto-reset
    style/              Style / palette registry

  react/src/
    GameRuntime.tsx         Mounts canvas, owns GameApp lifecycle
    GameLauncher.tsx        Full-screen shell (intro → play → pause → game-over)
    GameTile.tsx / Gallery  Animated preview tile with live canvas
    ui/                     HUD, QuitButton, IntroCard, TutorialOverlay, PauseModal,
                            GameOverModal, SettingsDrawer, StylePicker, QualitySelector,
                            DebugPanel, SimControlPanel, ShaderTuningDrawer, …

  games/src/
    */                  Game definitions exported through GAME_REGISTRY

  simulations/src/
    */                  Simulation definitions exported through SIMULATION_REGISTRY
                        Scenes may be Pixi-native, custom shader pipelines, or raw WebGL
                        adapters, but all enter through the same LabExperience factory

  ambients/src/
    */                  Ambient/effect definitions exported through AMBIENT_REGISTRY
```

### The `LabExperience` contract

Every game, simulation, ambient, overlay, and toy is described by a `LabExperience` definition object — a single structure that carries its metadata, factory functions, AI factories, gesture hints, settings fields, and capabilities flags. `GameLauncher`, `GameTile`, and the dashboard consume only this interface; they are agnostic of implementation details.

```ts
import type { LabExperience } from '@hooksjam/pixi-lab-core';
```

### Shared runtime, multiple render backends

All experiences enter through the same lifecycle:

```txt
GameLauncher → GameRuntime → GameApp → LabExperience.factory() → Scene
```

A scene can be Pixi-native, shader-heavy, DOM-backed, or raw WebGL-backed. For ports such as Fluid Tank, `DomScriptScene` supplies a generic adapter: the simulation package owns the markup/script and receives the active style palette through `data-pixi-lab-style` plus a `pixi-lab-style-change` event. Core stays generic; content packages own renderer-specific code.

### Render-variant engine plan

The GPU field rendering upgrade report recommends promoting common field rendering ideas into reusable variants instead of one-off scene forks. The next engine pass should add a small render-variant registry that lets definitions declare capabilities such as:

- field source: particles, scalar field, velocity field, dye texture, signed-distance field
- backend: Pixi primitives, Pixi render texture pipeline, custom shader pass, raw WebGL adapter
- presentation: fullscreen scene, background layer, foreground overlay, widget, preview tile
- style inputs: palette, exposure, edge darkening, bloom/color-grade settings
- quality controls: resolution scale, render-target budget, FPS governor hints

That keeps host apps and React UI stable while allowing simulations to swap implementation details behind the existing `LabExperience`/`Scene` boundary.

---

## Development Commands

```bash
pnpm install                              # install all workspace deps
pnpm dev                                  # run the demo app (Vite)

pnpm --recursive build                    # build all packages (tsc)
pnpm --recursive typecheck                # typecheck all packages
pnpm test                                 # run all tests (Vitest)
pnpm test:watch                           # watch mode

pnpm --filter @hooksjam/pixi-lab-core build
pnpm --filter @hooksjam/pixi-lab-react build
pnpm --filter @hooksjam/pixi-lab-games build
pnpm --filter @hooksjam/pixi-lab-simulations build
```

---

## Adding a New Experience

Read [`.github/skills/add-experience/SKILL.md`](.github/skills/add-experience/SKILL.md) — it routes to the correct scaffold for a game or simulation.

**Key rules:**
- Each game lives in `packages/games/src/<name>/`
- Each simulation lives in `packages/simulations/src/<name>/`
- Start with a `<name>.definition.ts` file, register it in the package `index.ts`
- Never import `pixi.js` or `planck` directly from `packages/react` or `packages/games` — go through `@hooksjam/pixi-lab-core`

---

## Stack

| Concern | Library |
|---|---|
| Renderer | [PixiJS v8](https://pixijs.com/) |
| Physics | [planck-js v1](https://github.com/piqnt/planck.js) |
| React shell | [React 18](https://react.dev/) |
| Animations | [Framer Motion 11](https://www.framer.com/motion/) |
| Icons | [Lucide React](https://lucide.dev/) |
| Styles | [Tailwind CSS v3](https://tailwindcss.com/) |
| Build | [Vite 5](https://vitejs.dev/) + `tsc` |
| Tests | [Vitest](https://vitest.dev/) |
| Package manager | [pnpm](https://pnpm.io/) (workspaces) |

---

## Conventions

- **TypeScript strict** — no `any`, no `@ts-ignore` without a comment
- **No `console.log`** in library code
- **Conventional Commits** — `type(scope): subject`
  - Scopes: `core` · `react` · `games` · `sims` · `demo` · `ci` · `deps` · `config`
- `GameLauncher` is app-agnostic — no routing, no `fetch`. Host apps inject `onQuit`, `onSubmitScore`, `topScores`

---

## License

MIT © hooksjam
