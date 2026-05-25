# SKILL: Add a New Experience

Use this skill as a router when adding new pixi-lab content.

Choose the correct scaffold:

- **Game** — competitive or score/rule-driven content in `packages/games`.
- **Simulation** — ambient, emergent, style-driven visual systems in `packages/simulations`.
- **Toy** — future lightweight interactive experiences that are neither game nor simulation.

For simulations, use `.github/skills/add-simulation/SKILL.md`.

For games, follow the existing game package structure:

```txt
packages/games/src/<id>/
  <id>.config.ts
  <id>.definition.ts
  <PascalId>Scene.ts
  <PascalId>PreviewScene.ts
  <PascalId>AI.ts
  __tests__/<PascalId>Scene.test.ts
```

Game definitions must use `kind: 'game'` and satisfy the `GameDefinition` alias exported by `@hooksjam/pixi-lab-core`.

## Minimum viable game definition

```ts
export const myGame: GameDefinition = {
  id: 'my-game',
  kind: 'game',
  name: 'My Game',
  short: 'One-liner shown on the tile',
  long: 'Longer description for the intro card',
  tags: ['action'],
  icon: '🎮',
  capabilities: {
    score: true,  // only declare what you actually use
  },
  factory: (_ctx) => new MyScene(),
  previewFactory: (_ctx) => new MyPreviewScene(),
};
```

- `settingsFields` / `configDefaults` — omit entirely if the game has no user-configurable settings
- `tutorialPages` — omit if no tutorial; the launcher hides the tutorial button automatically
- Capability booleans default to `false`/absent — only declare `true` values

## Capabilities checklist

When authoring `definition.capabilities`, consider:

| Capability | When to add | Requirement |
|---|---|---|
| `score: true` | Scene emits `score_update` events | Required for leaderboard |
| `qualityModes: ['basic', 'enhanced']` | Scene has two rendering tiers | Implement `setQuality()` |
| `reset: true` | Scene supports user-triggered drain/restart | Override `Scene.reset()` — see `BallPitScene` |
| `tutorial: true` | `tutorialPages` array is non-empty | Provide at least one tutorial page |
| `aiAutoplay: true` | AI player extends `BasicAI` | Implement `<Name>AI.ts` |
| `screensaver: true` | Safe to run unattended | No score requirement, stable infinite loop |

## UI provided by the shell (GameLauncher)

You **do not** need to build these UI elements — the launcher handles them:

- **Reset button** — shown bottom-right when `capabilities.reset: true`. Calls `appRef.current.resetScene()` → `scene.reset()`.
- **Debug panel** — the `DebugPanel` component (bottom-right) shows live fps/quality/bodies. It calls `app.getDebugStats()` and `app.setDebugEnabled()`. No code needed in the scene.
- **Quality selector** — shown in HUD controls when `qualityModes` is set. Calls `app.setQuality()`.
- **Settings modal** — centered card (desktop) / bottom-sheet (mobile). Renders `definition.settingsFields` automatically.

## Standard Implementation Loop

For every new game, simulation, ambient, effect, or toy:

1. Read `AGENTS.md`, the relevant master-plan section, and the tracking-system section.
2. Identify reusable engine primitives before writing content-specific code. Prefer extending `packages/core` over duplicating render/model systems in an experience folder.
3. Write or update behavior tests first, then implement the smallest code change that makes them pass.
4. Keep deterministic model/state logic separate from Pixi scene rendering whenever practical.
5. Add a cheap deterministic preview scene with reduced budgets.
6. Register the experience through the package registry so the demo discovers it automatically.
7. Update the tracking document with status, validation notes, deferred gaps, and implementation notes.
8. Run the full quality gate from a built workspace before considering the task complete.

## Quality gates

```bash
pnpm build                         # package exports point at dist, so build before tests
pnpm --recursive typecheck
pnpm test
pnpm --filter @hooksjam/pixi-lab-demo dev
```


