# Pixi Lab Games Execution Bible

> **For Hermes / NeoLocal:** This is the source-of-truth plan for turning Pixi Lab from a simulation-heavy rebuild into a deliberate game engine and game catalogue. Do not implement new games from the old backup docs directly; use this document first, then update it with evidence after every slice.

**Goal:** Build score/rule-driven games on top of the current Pixi Lab runtime while preserving the reusable simulation/WebGL work as engine capabilities, not one-off demos.

**Architecture:** Games live in `packages/games` as self-contained `GameDefinition` experiences. The shared shell remains in `packages/react`, runtime contracts stay in `packages/core`, and advanced visual/physics capabilities are exposed through reusable Pixi/WebGL-backed engine layers. PixiJS is the default backend; raw WebGL/WebGL2 is opt-in through `engineConfigurations`, scene-owned adapters, and future reusable effects systems.

**Tech Stack:** TypeScript strict, PixiJS v8, React 18 launcher shell, current `LabExperience` contract, `GameApp`, `Scene`, settings/modes/style manifests, advanced physics metadata, raw WebGL2 helpers, Vitest.

---

## 1. Provenance from the backup branch

This bible replaces and consolidates the following backup-branch guidance:

- `origin/backup/pixi-lab-main-before-core-rebuild-20260701-124115:.github/instructions/games.instructions.md`
  - kept: one-folder-per-game structure, pure TypeScript game code, launcher-owned UI, settings/modes/tutorial conventions, idle-by-default discipline.
  - updated: old guidance assumed every game used `GameDefinition` and `Scene` with direct Pixi wrappers; the current branch has a broader `LabExperience` runtime, backend/profile selection, raw WebGL2 scene adapters, and Ball Pit currently registered as a `SimulationDefinition` despite living in `packages/games`.
- `origin/backup/...:.github/skills/add-experience/SKILL.md`
  - kept: route by experience kind (`game`, `simulation`, future `toy`/`ambient`/`effect`), deterministic model/state separation, package-level tests, shell-provided reset/tutorial/settings UI.
  - updated: new game work must plan backend/profile support and reusable effects up front.
- `origin/backup/...:pixijs_simulation_master_plan_v7.md`
  - kept: reusable primitive systems, style manifests, render layers, quality/performance budgets, burst emitter/effects vision.
  - updated: use those simulation systems to power game feedback and game mechanics rather than porting the entire old simulation catalogue onto `main`.
- `origin/backup/...:reference/racegame.html`
  - kept as concept evidence for **Mini Formula**, the first explicit non-Ball-Pit game candidate.
- `origin/backup/...:sprites/spritesheet.md`
  - kept as asset/effect input for future polish. Sprite-driven concepts like `task-garden`, `sleep-aquarium`, `ant-signal`, and `confetti` are game-adjacent, but they should not be promoted as games until they have scoring/rules/win-loop definitions.

## 2. Current engine reality, July 2026 branch state

Before adding any game, account for the current branch state:

1. `packages/core/src/LabExperience.ts` owns the shared experience contract.
2. `packages/core/src/types.ts` has moved beyond old `qualityModes` only:
   - `RendererBackend = 'pixi' | 'webgl2' | 'three' | 'webgpu'`;
   - `RenderProfile = 'preview' | 'standard' | 'high'`;
   - `RenderQuality = 'basic' | 'enhanced' | 'raw'` remains as compatibility vocabulary;
   - `EngineConfiguration` is the host-facing selector.
3. `packages/react/src/GameLauncher.tsx` already renders backend/profile selectors through `definition.capabilities.engineConfigurations` and keeps the shell app-agnostic.
4. `packages/games/src/index.ts` currently exports only Ball Pit.
5. `packages/games/src/ballpit/ballpit.definition.ts` currently declares `SimulationDefinition`, `kind: 'simulation'`, and `engineConfigurations: createEngineConfigurations(['raw'], { rawBackend: 'webgl2' })`.
6. The simulation package now contains substantial raw/advanced systems: particle metaballs, GPU fluid/water, splash MPM, raw WebGL2 scenes, advanced physics metadata, and style manifests.
7. `packages/core/src/physics/AdvancedPhysicsEngine.ts` is the beginning of reusable advanced physics vocabulary, not yet a complete game-facing physics platform.

**Implication:** the next game work must not pretend Pixi Lab is only a simple Pixi/Planck game starter. It is now a lab runtime with Pixi UI, backend/profile selection, simulation-grade rendering, and raw WebGL2 escape hatches. Games should use that power intentionally.

## 3. Definition of “game” for this repo

A Pixi Lab **game** is a goal/rule-driven interactive experience with at least one of:

- score;
- timer/lap/time attack;
- win/lose/fail/retry state;
- progression, levels, waves, or objectives;
- player skill loop with measurable performance.

A game should use `GameDefinition` and `kind: 'game'` unless there is a documented compatibility reason not to. Simulations and ambients can inspire mechanics, but they do not become games until they have a game loop.

## 4. Package structure for each game

Use this structure for every new game:

```txt
packages/games/src/<game-id>/
  <game-id>.definition.ts       # GameDefinition, capability metadata, factories
  <game-id>.config.ts           # SettingsField[] and defaults
  <GameName>Model.ts            # deterministic rules/state where practical
  <GameName>Scene.ts            # Pixi-facing primary gameplay scene
  <GameName>PreviewScene.ts     # lightweight tile preview
  <GameName>AI.ts               # optional demo/screensaver driver
  <GameName>Effects.ts          # optional game-specific adapters over shared effects
  __tests__/
    <game-id>.definition.test.ts
    <GameName>Model.test.ts
    <GameName>Scene.test.ts     # when scene behavior can be tested headlessly
```

Then register in:

```txt
packages/games/src/index.ts
```

Rules:

1. Game files import engine/runtime types from `@hooksjam/pixi-lab-core`.
2. React UI stays in `packages/react`; games do not import React.
3. The launcher owns intro, pause/settings, tutorial, reset, mode selection, score display, and demo toggles.
4. Keep deterministic rules in a model where possible. Pixi scene code should render and translate input, not hide game rules.
5. Preview scenes must be cheap: no audio, no large raw texture allocation, no unbounded physics churn.
6. Scene update/render must stay idle-aware. Do not force continuous work unless animation, physics, active input, raw passes, or effects are actually active.

## 5. Backend strategy: Pixi first, raw WebGL when earned

### 5.1 Default route

New games should start with the Pixi backend:

```ts
capabilities: {
  score: true,
  reset: true,
  tutorial: true,
  demo: true,
  settings: true,
  engineConfigurations: createEngineConfigurations(['basic', 'enhanced']),
}
```

Use Pixi for:

- sprites and atlas rendering;
- text/HUD-facing scene elements that are not React shell UI;
- display object transforms;
- particles below the threshold where raw buffers are unnecessary;
- deterministic/portable gameplay.

### 5.2 Raw/WebGL route

Only advertise raw/WebGL when a game has a real raw path and tests/browser QA:

```ts
engineConfigurations: createEngineConfigurations(['basic', 'enhanced', 'raw'], { rawBackend: 'webgl2' })
```

Raw/WebGL is appropriate for:

- tens of thousands of particles;
- persistent trail/density fields;
- fluid or metaball simulation;
- shader-heavy game effects;
- GPU feedback buffers;
- postprocessing that Pixi cannot express cleanly.

Raw mode must be scoped to the scene or a reusable effect/physics layer. Do not globally promote raw for a game just because a reference exists.

## 6. Required engine enhancement: shared effects layer

The old master plan’s burst emitter section is still valid, but it needs a current-engine implementation path. Build a reusable effects layer before implementing multiple effect-heavy games.

### 6.1 Target API

Create a core-level effects vocabulary that can be backed by Pixi first and raw WebGL later:

```ts
export type EffectKind =
  | 'spark'
  | 'confetti'
  | 'firework'
  | 'ember'
  | 'smoke'
  | 'shockwave'
  | 'trail'
  | 'glow'
  | 'score-pop'
  | 'collision-burst';

export interface EffectEvent {
  readonly kind: EffectKind;
  readonly x: number;
  readonly y: number;
  readonly intensity?: number;
  readonly color?: number;
  readonly seed?: number;
  readonly durationMs?: number;
  readonly layer?: 'world' | 'screen' | 'background';
}

export interface EffectsLayer {
  emit(effect: EffectEvent): void;
  update(dt: number): void;
  clear(): void;
  isActive(): boolean;
}
```

### 6.2 Implementation sequence

1. Add `EffectEvent` / `EffectsLayer` types in `packages/core`.
2. Add a Pixi-backed implementation using pooled sprites/graphics.
3. Add a test-only fake effects layer for model/scene unit tests.
4. Wire `Scene` or `GameApp` so effects activity participates in idle/render decisions.
5. Add optional raw WebGL2 effects backend using the existing particle/metaball/trail work:
   - particle point buffers;
   - trail feedback textures;
   - density/metaball composite;
   - bloom/glow pass;
   - sprite atlas sampling where useful.
6. Let games inject or request the effects layer from `GameContext` rather than constructing global singletons.

### 6.3 First effects to build

In order:

1. `collision-burst` / `spark` — needed by Ball Pit, Mini Formula, and most arcade games.
2. `score-pop` — needed by score-driven games and visible feedback.
3. `confetti` — win/finish/completion feedback.
4. `shockwave` — impacts/explosions, leverages current raw circular-field knowledge.
5. `trail` — Mini Formula tire/light trails, orbital/particle game mechanics.
6. `glow` — shared bloom-ish marker for objectives, pickups, and feedback.

## 7. Game catalogue and execution order

### Tier 0 — Preserve and normalize existing game package

#### 0.1 Ball Pit baseline

Current state:

- lives in `packages/games`;
- registered from `GAME_REGISTRY`;
- currently typed as `SimulationDefinition` and `kind: 'simulation'`;
- uses raw WebGL2 and advanced circle particles;
- is valuable as a stress/physics benchmark.

Decision:

- Keep Ball Pit as the package baseline for now.
- Do not block new games on converting it to `GameDefinition`.
- Add a follow-up task to decide whether Ball Pit is:
  1. a real game with scoring/objectives, renamed/converted to `GameDefinition`; or
  2. a simulation benchmark that should move to `packages/simulations` later.

Acceptance for Tier 0:

- current tests stay green;
- `GAME_REGISTRY` remains valid;
- docs clearly state Ball Pit’s transitional status.

### Tier 1 — Engine-first game foundation

Implement before new game catalog expansion:

1. **Game session state**
   - Add standard states: `intro`, `countdown`, `playing`, `paused`, `gameover`, `complete`.
   - Keep shell state and scene state separated.
2. **Score/event contract hardening**
   - Confirm `GameEvent` covers score, combo, lap, checkpoint, objective, health/lives, gameover, complete.
   - Add typed helpers if current event payloads are too loose.
3. **Effects layer MVP**
   - Add Pixi-backed `EffectsLayer` and fake test implementation.
   - Wire into idle/render activity.
4. **Sprite/atlas asset path**
   - Define how games reference sprites from package assets.
   - Add loader/cache policy and testable fallback behavior.
5. **Input/controller vocabulary**
   - Standardize pointer, keyboard, touch, virtual joystick, and tilt/mobile-friendly controls.
   - Mini Formula requires steering/throttle/brake; future games need drag/tap/multi-touch.
6. **Game test harness**
   - Add a helper for deterministic model ticks and scene input events.

Acceptance for Tier 1:

- `pnpm test` passes;
- package-level typechecks pass or documented MSYS timeout is replaced by smaller reliable commands;
- one sample scene uses effects through the shared layer, not bespoke particles.

### Tier 2 — First real game: Mini Formula

Source evidence: `reference/racegame.html` from the backup branch.

Concept:

- top-down time-trial / checkpoint racing game;
- Pixi-first renderer;
- optional enhanced effects for skid trails, sparks, speed lines, checkpoint glow;
- eventual raw/WebGL trail backend only after Pixi version works.

Implementation order:

1. Port rules into `MiniFormulaModel.ts`:
   - track bounds;
   - car pose/velocity;
   - checkpoint/lap state;
   - timer;
   - collision penalties;
   - finish/gameover state.
2. Add `mini-formula.config.ts`:
   - car color;
   - assist/steering sensitivity;
   - race length/laps;
   - effect intensity;
   - debug track visibility.
3. Add `MiniFormulaScene.ts` Pixi path:
   - track graphics/sprites;
   - car sprite/shape;
   - checkpoint markers;
   - effects layer calls for skid/sparks/checkpoint.
4. Add `MiniFormulaPreviewScene.ts`:
   - one car ghost loop;
   - no full collision loop;
   - no raw allocation.
5. Add `MiniFormulaAI.ts`:
   - demo line following;
   - safe screensaver mode.
6. Register in `packages/games/src/index.ts`.
7. Add tests:
   - model tick;
   - checkpoint order;
   - lap completion;
   - reset;
   - definition defaults.
8. Browser QA:
   - basic Pixi route;
   - enhanced Pixi route;
   - mobile/touch controls;
   - preview tile CPU budget.

Initial capabilities:

```ts
capabilities: {
  score: true,
  reset: true,
  tutorial: true,
  demo: true,
  settings: true,
  engineConfigurations: createEngineConfigurations(['basic', 'enhanced']),
}
```

Do not add raw until Pixi Mini Formula is fun and verified.

### Tier 3 — Convert simulation mechanics into actual games

These candidates come from old simulation/sprite/effects docs. They should be gameified only after Mini Formula proves the game foundation.

#### 3.1 Task Garden

Source evidence: `sprites/spritesheet.md` has task garden plants/sparkles and explicitly game-like completion assets.

Game loop:

- plant tasks/seeds;
- water/drag resources;
- complete growth stages;
- score by streak/time/healthy plants;
- confetti/sparkle effects on completion.

Engine prerequisites:

- sprite atlas path;
- `score-pop` and `confetti` effects;
- simple persistence hooks if task data becomes external later.

#### 3.2 Ant Signal Colony

Source evidence: `sprites/spritesheet.md` and old raw field roadmap mention ant agents/pheromone texture.

Game loop:

- guide ant colony to collect food;
- player places pheromone signals/barriers;
- score by food delivered before time/stagnation;
- escalating maps.

Engine prerequisites:

- field/agent simulation helper extracted from current simulation work;
- Pixi particle/sprite rendering first;
- optional raw pheromone texture backend later.

#### 3.3 Sleep Aquarium Challenge

Source evidence: fish/bubble sprites and ambient catalogue.

Game loop:

- calm aquarium balancing game;
- keep fish happy by managing bubbles/food/current;
- score by harmony/time without stress spikes.

Engine prerequisites:

- sprite atlas;
- lightweight schooling model;
- soft glow/trail effects.

#### 3.4 Orbital Sling / Space Debris game

Source evidence: current Orbital Shrapnel and old debris/well sprites.

Game loop:

- place wells/impulses to guide debris into targets or protect planets;
- score by precision and cleanup;
- raw renderer can remain optional/high tier.

Engine prerequisites:

- extract reusable orbital model helpers if not already clean;
- decide whether game lives in `packages/games` while simulation remains in `packages/simulations`.

### Tier 4 — Game polish and release loop

After at least two games exist:

1. Add game catalogue filters separate from simulations.
2. Add local best-score persistence.
3. Add input remapping / mobile control presets.
4. Add sound/audio hooks, if still in scope.
5. Add shared game tutorial patterns.
6. Add deploy smoke checklist per game route.

## 8. Logical execution order

Follow this order. Do not skip ahead because a reference demo looks easy.

### Phase A — Branch and documentation baseline

1. Keep `agent/pixi-lab-core-rebuild-clean` clean and pushed.
2. Work on branch `games`.
3. Add this bible.
4. Commit and push the branch.

### Phase B — Engine game foundation

1. Audit current `GameEvent`, `GameCapabilities`, and `GameContext`.
2. Add or tighten game session/event helpers.
3. Add shared effects types and Pixi implementation.
4. Add effect-idle integration tests.
5. Add sprite/asset loading convention.
6. Add deterministic game model test helper.
7. Run `pnpm test` and package-level typechecks.
8. Commit.

### Phase C — Mini Formula MVP

1. Bring over `reference/racegame.html` as reference only, not production code.
2. Write `MiniFormulaModel` tests first.
3. Implement model.
4. Add config/definition.
5. Add Pixi scene.
6. Add preview scene.
7. Add AI/demo.
8. Register game.
9. Browser QA.
10. Commit.

### Phase D — Effects/raw enhancement

1. Add shared effects that Mini Formula actually uses.
2. Add optional enhanced Pixi visual pass.
3. Only then assess a raw/WebGL2 trail/effects backend.
4. Keep raw off unless the concrete route passes tests and browser smoke.

### Phase E — Next game candidate

Choose exactly one:

1. Task Garden, if we want sprite/effects/completion gameplay.
2. Ant Signal Colony, if we want field/agent gameplay and raw-field reuse.
3. Orbital Sling, if we want to convert existing orbital simulation work into score mechanics.

Document the choice in this file before implementation.

## 9. Acceptance gates for every game

Every game slice must satisfy:

1. **Definition gate**
   - `kind: 'game'` for new games;
   - unique kebab-case id;
   - capabilities match actual implementation;
   - no raw/backend option advertised without a working scene path.
2. **Model gate**
   - deterministic core rules tested without Pixi where possible.
3. **Scene gate**
   - no React imports;
   - no direct global DOM assumptions beyond engine-provided canvas/runtime;
   - idle-aware update/render behavior.
4. **Effects gate**
   - use shared effects layer for common feedback;
   - do not duplicate bespoke spark/confetti/trail systems per game.
5. **Performance gate**
   - preview is lightweight;
   - raw allocations are bounded and profile-specific;
   - Pi/mobile budgets are considered before enabling high profiles.
6. **Verification gate**
   - `pnpm test`;
   - package typecheck(s) relevant to touched packages;
   - browser smoke route for the new game and preview tile.

## 10. Known branch/tooling notes from creating this bible

- Current branch verification before this bible:
  - `pnpm test` passed: 27 files, 150 tests.
  - `pnpm --filter @hooksjam/pixi-lab-simulations typecheck` passed after rebuilding core declarations.
  - Aggregate `pnpm typecheck` and several package typecheck invocations timed out under the Windows/MSYS shell without source diagnostics; use smaller package-level commands and rebuild `@hooksjam/pixi-lab-core` first when declarations are stale.
- The current branch had a stale/broken local `refs/codex/...` ref that interfered with git gc. Use `git -c gc.auto=0 ...` if git maintenance stalls until the local repo is fully cleaned.
- GitHub auth for this repo must be `jamesdhooks`, not `inventdevinc`.

## 11. Next concrete task list

### Task 1: Commit this bible

**Files:**

- Create: `docs/plans/games-execution-bible.md`

**Verify:**

```bash
git status --short --branch
git add docs/plans/games-execution-bible.md
git commit -m "docs(games): add execution bible"
git push -u origin games
```

### Task 2: Effects layer design spike

**Objective:** Confirm exact core insertion points before implementation.

**Files to inspect:**

- `packages/core/src/Scene.ts`
- `packages/core/src/GameApp.ts`
- `packages/core/src/types.ts`
- `packages/core/src/render/*`
- current raw helpers under `packages/core/src/sim` and `packages/simulations/src/shared`

**Output:** update this bible with precise file paths for the effects MVP.

### Task 3: Mini Formula implementation plan

**Objective:** Write a separate bite-sized implementation plan for Mini Formula after effects-layer insertion points are known.

**Output file:**

- `docs/plans/mini-formula-implementation-plan.md`

Do not implement Mini Formula until that plan exists.
