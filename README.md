# Pixi Lab

A standalone **PixiJS v8** engine lab rebuilt around a small, intentional foundation: core runtime capabilities first, React host shell second, and only the curated launch set after that.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-0f62fe?logo=github&logoColor=white)](https://jamesdhooks.github.io/pixi-lab/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PixiJS](https://img.shields.io/badge/PixiJS-v8-e72264)](https://pixijs.com/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-f69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

## Current main scope

Main is intentionally narrow. It contains the reusable engine and host shell plus three content experiences:

- **Ball Pit** — game package baseline and physics/game-loop proving ground.
- **Harmonic Sand Plate** — simulation controls, presets, preview, and raw/Pixi rendering coverage.
- **Orbital Shrapnel** — orbital simulation with raw renderer/composite planning coverage.

Reference scenes, ambient packages, exploratory ports, and broad documentation drafts stay off main until they are cleaned up and promoted deliberately.

## Packages

| Package | Description |
|---|---|
| [`@hooksjam/pixi-lab-core`](packages/core) | Engine/runtime contracts, scene lifecycle, input, physics, rendering helpers, simulation adapters, styles, scoring, and quality controls. |
| [`@hooksjam/pixi-lab-react`](packages/react) | React runtime shell, launcher, gallery tiles, HUD, settings, debug, and simulation controls. |
| [`@hooksjam/pixi-lab-games`](packages/games) | Curated game registry. Currently exports Ball Pit only. |
| [`@hooksjam/pixi-lab-simulations`](packages/simulations) | Curated simulation registry. Currently exports Harmonic Sand Plate and Orbital Shrapnel only. |
| [`@hooksjam/pixi-lab-demo`](packages/demo) | Vite demo app for launching and validating the curated set. |

## Quick start

```bash
pnpm install
pnpm --filter @hooksjam/pixi-lab-demo dev
```

Open `http://localhost:5173`.

## Architecture

```txt
packages/
  core/src/         Shared engine/runtime primitives and renderer adapters
  react/src/        App-agnostic React host shell and UI controls
  games/src/        Curated games exposed through GAME_REGISTRY
  simulations/src/  Curated simulations exposed through SIMULATION_REGISTRY
  demo/src/         Vite host app that composes the curated registries
```

All launchable content enters through the shared `LabExperience` contract:

```txt
GameLauncher → GameRuntime → GameApp → LabExperience.factory() → Scene
```

A scene may be Pixi-native, shader-heavy, DOM-backed, or raw WebGL-backed. Core owns reusable adapters and lifecycle rules; content packages own scene-specific implementation.

## Development commands

```bash
pnpm install
pnpm --recursive build
pnpm --recursive typecheck
pnpm test
pnpm --filter @hooksjam/pixi-lab-demo dev
```

Package-specific builds:

```bash
pnpm --filter @hooksjam/pixi-lab-core build
pnpm --filter @hooksjam/pixi-lab-react build
pnpm --filter @hooksjam/pixi-lab-games build
pnpm --filter @hooksjam/pixi-lab-simulations build
```

## Adding content

Use [`.github/skills/add-experience/SKILL.md`](.github/skills/add-experience/SKILL.md) for the current scaffold rules.

Promotion to main should happen in this order:

1. Add or extend shared engine capability when needed.
2. Add tests for the engine/content behavior.
3. Register exactly one polished experience.
4. Keep documentation consolidated here or under `docs/architecture/`.

## Conventions

- TypeScript strict mode.
- Conventional commits with focused scopes: `core`, `react`, `games`, `sims`, `demo`, `docs`, `config`.
- React shell stays app-agnostic; host apps own routing and persistence.
- No broad reference-scene dumps on main.

## Attribution

Third-party references and notices live in [docs/attribution.md](docs/attribution.md). Experiences can also declare scene-specific attribution links that appear in the intro title card.

- **Lava Lamp** credits Matt Bryant's [WebGL Lava Lamp](https://github.com/brybrant/lava-lamp), licensed under [GPL-3.0](https://github.com/brybrant/lava-lamp/blob/master/LICENSE), and the credited [raymarch lava lamp shader](https://www.shadertoy.com/view/fsKXDm) by [@Arrangemonk](https://www.shadertoy.com/user/Arrangemonk) as the source reference for its WebGL2 raymarch adaptation.
- **Water Tank** credits Eric Arnebäck's [gl-water2d](https://github.com/Erkaman/gl-water2d), licensed under [MIT](https://github.com/Erkaman/gl-water2d/blob/master/LICENSE), as the inspiration for the SPH-style particle liquid path.
- **Fluid Tank** credits Pavel Dobryakov's [WebGL Fluid Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation), licensed under [MIT](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/master/LICENSE), for adapted fluid rendering/post-processing ideas.
- **Particle Fluid** credits Haxiomic's [GPU Fluid Experiments](https://github.com/haxiomic/GPU-Fluid-Experiments), licensed under [GPL-3.0](https://github.com/haxiomic/GPU-Fluid-Experiments/blob/master/LICENSE.txt), as the visual reference for its original particle-fluid scene.

## License

MIT © hooksjam
