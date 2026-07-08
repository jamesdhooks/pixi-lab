# Pixi Lab Games Execution Bible

> **Agent entry point for the `games` branch.** Read this before implementing or modifying any Pixi Lab game. This document is both the working game backlog and the implementation guide. An agent should be able to open this file, understand the current architecture, pick the next unstarted game, implement one game slice, and update progress/evidence before handing off.

**Branch:** `games`  
**Status:** active game-track planning and execution guide  
**Last updated:** 2026-07-08  
**Primary tracked source of truth:** this file  
**Local reference examples:** `/examples/*` may contain ignored reference briefs or demos. Do **not** assume files under `/examples` are tracked on this branch.

---

## 0. Fast-start checklist for the next agent

1. Confirm branch and workspace:
   ```bash
   git status --short --branch
   git branch --show-current
   ```
   Work on `games` unless James explicitly says otherwise.
2. Read `AGENTS.md`, then this bible.
3. Choose the next `Status: not-started` game from [Section 7](#7-catalogue-and-progress-tracker), unless James names a different one.
4. Before coding, fill in or update the chosen game's **Implementation notes** and **Architecture/support required** bullets in this file if they are incomplete.
5. Implement one vertical slice only: model + definition + scene + preview/demo + tests + registration.
6. Run the smallest relevant gates first, then the broader gates listed in [Section 10](#10-verification-gates).
7. Update this bible with:
   - status;
   - files touched;
   - test/build commands and results;
   - known gaps;
   - the next recommended task.
8. Commit with a conventional commit (`feat(games): ...`, `docs(games): ...`, `test(games): ...`).

---

## 1. What this bible is replacing

This bible consolidates game-track planning that used to be scattered across local reference docs, backup branch files, and simulation-era trackers.

Use this file instead of implementing directly from older docs.

Reference material currently folded into this guide:

- **Curated fridge/touch physics game brief**
  - Local reference path: `examples/curated-fridge-physics-games.md` when present.
  - Status: reference-only; it should not be tracked by the games branch.
  - Purpose: touch/fridge constraints and first touch-game catalogue.
- **Primitive arcade/gamepad game brief**
  - Local reference path: `examples/gamepad-primitive-arcade-ideas.md` when present.
  - Status: reference-only unless James asks to track examples.
  - Purpose: SNES-style gamepad catalogue and recommended order.
- Prior game/simulation instructions from the backup branch:
  - `.github/instructions/games.instructions.md`;
  - `.github/skills/add-experience/SKILL.md`;
  - legacy Pixi simulation master/tracking plans;
  - reference demos such as `racegame.html`.

**Important source-control rule:** `/examples` is ignored by `.gitignore`. Do not force-add reference docs or demos from `/examples` to this branch unless James explicitly asks. If a reference exists only under `/examples`, summarize the relevant requirements in this bible instead of tracking the reference file.

---

## 2. Current architecture reality

Pixi Lab is not a one-off game folder. It is a monorepo game/simulation runtime:

| Package | Path | Role |
| --- | --- | --- |
| Core engine | `packages/core` | `LabExperience`, `GameApp`, `Scene`, input, physics, render helpers, AI, scoring/events vocabulary. |
| React shell | `packages/react` | `GameLauncher`, `GameRuntime`, tiles, settings/tutorial/reset/pause chrome. Games must not import React. |
| Games | `packages/games` | First-party games. Each new game should live in `packages/games/src/<game-id>/`. |
| Simulations | `packages/simulations` | Non-game simulations/toys. Useful engine references, not automatically games. |
| Demo app | `packages/demo` | Gallery/dev host and QA surface. |

Current notable facts:

1. `packages/core/src/LabExperience.ts` is the shared contract for games, simulations, toys, and future ambient/effect experiences.
2. Runtime supports Pixi plus advanced/raw rendering concepts:
   - `RendererBackend = 'pixi' | 'webgl2' | 'three' | 'webgpu'`;
   - `RenderProfile = 'preview' | 'standard' | 'high'`;
   - `RenderQuality = 'basic' | 'enhanced' | 'raw'`;
   - host-facing `EngineConfiguration` entries.
3. `GameLauncher` already exposes backend/profile choices from definitions. Do not hard-code game-specific UI there.
4. `packages/games/src/index.ts` is the games package registry/export surface.
5. Ball Pit lives in the games package but is currently a simulation/toy/benchmark, not proof that the branch has a finished rule-driven game catalogue.
6. The simulation package contains advanced renderer/physics work. Reuse it only through clean core/package boundaries, not by copy-pasting scene internals into every game.

---

## 3. Definition of “game”

A Pixi Lab **game** is a goal/rule-driven experience with one or more of:

- score;
- timer/lap/time attack;
- win/lose/fail/retry state;
- waves/levels/objectives/progression;
- player skill loop with measurable performance.

A game should be registered as `kind: 'game'` and use a `GameDefinition`-style shape unless current core contracts require a compatibility adapter. If an experience has no scoring/objective/fail state, track it as `toy`, `simulation`, or `ambient`, not as a completed game.

### Ball Pit disposition

Ball Pit / Gravity Playground is valuable engine work, but in current form it is a toy/simulation. Do not mutate it in-place just to call it a game.

If ball-pit mechanics become a game, create a separate game such as **Color Pit Arena** with its own folder, model, definition, scoring, bins, combos, and game-over state. Reuse shared primitives only after the boundary is clean.

---

## 4. Input categories

Every catalogue item is categorized explicitly:

| Category | Meaning | UX rules |
| --- | --- | --- |
| `touch` | Fridge/tablet/kiosk-first game. Primary controls are tap, drag, hold, release, or giant on-screen buttons. | No tiny UI, no fast twitch, no keyboard assumptions, large targets, short sessions, spectator-friendly. |
| `gamepad` | SNES-style controller-first game. Primary controls are D-pad/left stick plus A/B/X/Y/L/R/Start. | Must still have menu accessibility, pause/reset, remapping or documented mapping, and no keyboard-only assumptions. |
| `touch+gamepad` | Works well with both. | Design both input paths intentionally; do not bolt gamepad on after the scene assumes pointer-only semantics. |

### Required input documentation per game

Each implemented game must document:

- primary category: `touch`, `gamepad`, or `touch+gamepad`;
- exact controls;
- how demo/AI/autoplay drives the same model;
- how pause/reset/tutorial work in the shell;
- what accessibility fallback exists if the target input is unavailable.

---

## 5. Game implementation conventions

Use this structure for each new game:

```txt
packages/games/src/<game-id>/
  <game-id>.definition.ts       # GameDefinition/capability metadata/factories
  <game-id>.config.ts           # settings fields and defaults
  <GameName>Model.ts            # deterministic game rules/state
  <GameName>Scene.ts            # Pixi-facing gameplay scene
  <GameName>PreviewScene.ts     # cheap tile preview
  <GameName>AI.ts               # demo/screensaver driver when useful
  <GameName>Effects.ts          # optional adapters over shared effects
  __tests__/
    <game-id>.definition.test.ts
    <GameName>Model.test.ts
```

Register/export through:

```txt
packages/games/src/index.ts
```

Rules:

1. Import engine/runtime types from `@hooksjam/pixi-lab-core`.
2. Keep React out of `packages/games`.
3. Keep deterministic rules in a model where possible. Scene code translates input, owns Pixi objects, and renders model state.
4. Preview scenes must be cheap: no audio, no large raw textures, no unbounded physics churn.
5. Keep rendering idle-aware. Do not force continuous render unless there is animation, awake physics, active input, particles/effects, or a documented custom visual reason.
6. `aiAutoplay` means supported, not always running. AI should inject through the normal input/model path.
7. Settings fields need sections. Input-mode-specific controls belong under `section: 'Input Mode'` and should use `visibleModes` where available.
8. Capabilities must match reality. Do not advertise raw/WebGL/gamepad/score/tutorial/demo if the implementation does not support it.

---

## 6. Shared architecture/support work to prefer over one-offs

Agents should favor existing architecture and add reusable features only when a game proves the need.

### 6.1 Foundation tasks

| Support area | Needed by | Status | Notes |
| --- | --- | --- | --- |
| Game session state (`intro`, `countdown`, `playing`, `paused`, `gameover`, `complete`) | all score games | needed | Keep shell state and game model state separated. |
| Typed game events for score/combo/lap/objective/health/gameover/complete | all games | needed | Tighten only as required by first implemented game. |
| Primitive physics helpers: circles, boxes, sensors, walls, body pools | touch physics games | needed | Extract after two games prove shared shape, unless current helpers are already reusable. |
| Shared effects layer: spark, collision burst, score-pop, confetti, shockwave, trail, glow | most games | needed | Pixi first. Raw/WebGL later only when earned. |
| Gamepad input adapter and mapping vocabulary | gamepad catalogue | not started | Must avoid keyboard-only assumptions. Needs browser Gamepad API polling, mapping normalization, and tests where practical. |
| Game model test helpers | all games | needed | Deterministic ticks, fake random seed, fake input, fake events. |
| Preview performance budget helpers | all games | active need | Keep previews light and idle-aware. |

### 6.2 Raw/WebGL policy

Start Pixi-first unless the game’s core mechanic genuinely needs raw GPU work.

Raw/WebGL is appropriate for:

- tens of thousands of particles;
- persistent trail/density fields;
- shader-heavy effects;
- GPU feedback buffers;
- fluid/metaball visuals that Pixi cannot express cleanly.

Do **not** advertise raw mode because a reference demo exists. Add raw only when the concrete route is implemented, tested, and browser-smoked.

---

## 7. Catalogue and progress tracker

Status values:

- `not-started` — no implementation slice exists.
- `planned` — plan/details exist but no code.
- `in-progress` — code exists on this branch but not accepted.
- `implemented` — code and tests exist.
- `qa-needed` — implementation exists but needs manual browser/device QA.
- `accepted` — James accepted it.
- `deprioritized` — do not pick unless James reopens it.

### 7.1 Current shipped/seed experiences

| Experience | Category | Status | Tracking | Notes |
| --- | --- | --- | --- | --- |
| Ball Pit / Gravity Playground | touch | in-progress as simulation/toy | `packages/games/src/ballpit` | Not a finished game until separate score/objective/fail loop exists. Keep as physics/effects benchmark. |
| Harmonic Sand Plate | touch | simulation | `packages/simulations` | Not part of the game catalogue. Can inform renderer/effects work. |
| Space Debris | touch | simulation | `packages/simulations` | Not part of the game catalogue. Can inform orbital/particle mechanics. |
| Fireworks | touch | simulation | `packages/simulations` | Not part of the game catalogue. Can inform effects layer. |

### 7.2 Touch/fridge catalogue

These are touchscreen/fridge-first, primitive physics games. They favor short sessions, visible physics, and large controls.

| Order | Game | Category | Status | Core loop | Architecture/support required | Implementation notes / next step |
| ---: | --- | --- | --- | --- | --- | --- |
| T0 | Ball Pit / Gravity Playground | touch | simulation only | Spawn/manipulate many balls. | Existing ball physics/render benchmark. Needs score/objective/fail state to become game. | Do not convert in place. Use as source for Color Pit Arena only after extracting clean shared primitives. |
| T1 | Pegboard / Pachinko | touch | not-started | Drop balls through pegs into scoring bins. | Circle body pool, static pegs/walls, bin sensors, score events, score-pop/spark effects. | Recommended first true touch game. Write `PegboardModel` tests first. |
| T2 | Color Pit Arena | touch | planned | Route colored balls into matching bins before overflow. | Reusable ball spawn/pool, color/bin rules, force-field input modes, overflow/gameover, score/combo events. | Separate `packages/games/src/color-pit-arena/`; preserve Ball Pit simulation behavior. |
| T3 | Sorting Factory / Ball Rain Machine | touch | not-started | Toggle gates/diverters to sort continuous colored ball flow. | Colored-ball/bin primitives, gates, drains, jam/overflow detection, optional fan/suction zones. | Build after Pegboard/Color Pit prove sensors and bins. |
| T4 | Rotating Maze Ball | touch | not-started | Rotate maze/gravity to guide ball to exit. | Maze wall primitives, gravity-rotation or transform strategy, exit sensor, timer/move counter. | If rotating static bodies is brittle, fake via gravity rotation. |
| T5 | Catapult vs Block Tower | touch | not-started | Drag/release launcher to knock down block tower. | Projectile launch vector, dynamic rectangles, destruction scoring, trajectory dots, dust/spark effects. | Fake the launcher; no ropes/joints in MVP. |
| T6 | Side-View Physics Golf | touch | not-started | Trick-shot ball through ramps/bumpers into hole. | Drag/release aiming, course geometry, hole sensor, stroke/time scoring, trajectory preview. | Keep holes short and forgiving; level design is the main risk. |
| T7 | Physics Bowling Chaos | touch | not-started | Launch ball down lane to knock down primitive pins/blocks. | Lane bounds, pin bodies, knockdown detection, scoring/reset. | Avoid realistic spin; make it silly physics knockdown. |
| T8 | One-Tap Pinball World | touch | not-started | Large flipper/gate controls bounce ball into score targets. | Arcade-simple flipper impulses, bumpers, drains, score zones, combo effects. | Medium risk; do not chase perfect pinball simulation. |
| T9 | Don’t Spill the Balls | touch | not-started | Keep cargo balls in moving cart over bumpy terrain. | Fake/limited vehicle motion, cargo sensors, terrain, preserved-cargo scoring. | Avoid realistic suspension; deep forgiving bucket. |
| T10 | Fake-Wave Raft Balance | touch | not-started | Balance raft/cargo on fake sine waves. | Visual wave sampler, fake buoyancy/tilt, cargo removal, time/collected score. | Never build real fluid simulation for MVP. |

Deprioritized touch ideas unless reopened: realistic archery, bridge stress simulator, blob creatures, physics fishing, rope swinger, real fluid/wave simulation.

### 7.3 Gamepad/primitive arcade catalogue

These are SNES-style controller-first games from the gamepad reference brief. They should still use primitive rendering and short arcade loops.

| Order | Game | Category | Status | Core loop | Architecture/support required | Implementation notes / next step |
| ---: | --- | --- | --- | --- | --- | --- |
| G1 | Geometry Rally | gamepad | not-started | Top-down drifting time-trial racer with boost pads, oil slicks, cones. | Gamepad adapter, car kinematics model, checkpoint/lap/timer events, track collision, forgiving reset. | Recommended first gamepad game after input adapter exists. Mini Formula/race references may help, but do not require precision twitch. |
| G2 | Multi-Ball Breakout | gamepad | not-started | Paddle breaks bricks with many balls and gravity/magnet modifiers. | Paddle input, brick grid/model, ball pool, collision scoring, powerup events. | Strong early candidate because it reuses ball physics while proving gamepad. |
| G3 | Tank Arena | gamepad | not-started | Top-down tank combat with ricochets, crates, barrels, simple AI/local multiplayer. | Twin-stick or D-pad+buttons mapping, projectile pool, ricochet, health/lives, AI. | Do single-player vs simple bots first; multiplayer later. |
| G4 | Asteroids++ | gamepad | not-started | Ship survives fragmenting asteroids, gravity wells, magnets. | Wraparound world, thrust/rotation controls, projectile pool, fragment spawning, survival score. | Good gamepad baseline; keep shapes primitive. |
| G5 | Marble Racing | gamepad | not-started | Roll marble through funnels, loops, seesaws, moving obstacles. | Tilt/steer mapping, course checkpoints, physics tuning, timer. | May become touch+gamepad later; start controller-first if picked from this catalogue. |
| G6 | Pinball Adventure | gamepad | not-started | Scrolling pinball world with flippers, launchers, bumpers, bonus paths. | Same risks as touch pinball plus scrolling camera and controller flipper mapping. | Build after simple pinball primitives exist. |
| G7 | Wrecking Ball | gamepad | not-started | Swing/release wrecking ball to demolish primitive structures. | Pendulum/fake swing model, destructible blocks, scoring by damage, camera framing. | Avoid full rope simulation unless proven stable. |
| G8 | Sumo Bots | gamepad | not-started | Physics bots push each other out of arena. | Top-down bot movement, arena ring sensor, shove/boost mechanics, local/bot AI. | Simple and good for local multiplayer later. |
| G9 | Robot Hockey | gamepad | not-started | Physics puck hockey with dash, slap shots, hazards. | Two-goal scoring, puck physics, dash/slap input, simple opponent AI. | Candidate after Sumo/Tank input patterns. |
| G10 | Boulder Dash Physics | gamepad | not-started | Push rocks, dodge falling boulders, trigger switches/breakable walls. | Tile/grid model plus physics-ish falling rocks, level loader, fail/retry state. | More level-design heavy; defer. |
| G11 | Arena Survival | gamepad | not-started | Survive enemies/crushers/lasers/magnets in circular arena. | Enemy spawner, hazards, health/lives/waves, arena bounds. | Strong wave-game candidate after Tank/Asteroids primitives. |
| G12 | Conveyor Factory | gamepad | not-started | Redirect cargo and prevent jams in a kinetic factory. | Overlaps touch Sorting Factory; controller cursor/selector, gate toggles, jam rules. | Decide whether to make Sorting Factory `touch+gamepad` instead of separate game. |
| G13 | Moon Lander | gamepad | not-started | Land with thrusters/fuel on moving pads/procedural caves. | Thruster physics, terrain/cave collision, fuel, landing scoring. | Good compact game; needs precise but forgiving tuning. |
| G14 | Worm Physics | gamepad | not-started | Snake-style movement with momentum and hazards. | Segmented body or simplified trail model, pickups, collision/fail. | Avoid unstable full soft-body worm. |
| G15 | Hovercraft Arena | gamepad | not-started | Low-friction hovercraft combat with boost pads/hazards. | Vehicle kinematics, arena hazards, health/score. | Can share Geometry Rally movement work. |

Bonus backlog, unprioritized: Primitive Lemmings, Missile Command Physics, Geometry Bomberman, Tron Lightcycles, Micro Machines, Primitive Worms.

---

## 8. Recommended execution order

### Phase A — Documentation and branch hygiene

Status: active.

- [x] Create games execution bible.
- [x] Fold touch/fridge catalogue into tracked bible.
- [x] Fold gamepad catalogue into tracked bible.
- [x] Categorize every game as `touch` or `gamepad`.
- [x] Keep `/examples` reference docs local-only unless explicitly requested.
- [ ] Push updated `games` branch after removing tracked fridge example from latest commit history.

### Phase B — Shared foundation before game expansion

Pick these off only as needed by the first actual game. Do not overbuild architecture without a game forcing the requirement.

1. Confirm current `LabExperience`, game capability, event, and session-state contracts.
2. Add only the missing session/event helpers required by Pegboard.
3. Add minimal Pixi effects layer if Pegboard needs visible score/spark feedback.
4. Add model test helper if Pegboard model tests get repetitive.
5. Defer gamepad adapter until the first gamepad game is actually selected.

### Phase C — First true touch game: Pegboard / Pachinko

Required output:

- `packages/games/src/pegboard/` implementation;
- deterministic `PegboardModel` tests;
- primitive Pixi scene and cheap preview;
- score/bin cleanup events;
- demo/AI dropper if feasible;
- registry/export update;
- this bible updated to `in-progress` / `implemented` with evidence.

### Phase D — Second touch game or gamepad foundation

Choose one based on James’s direction:

1. **Color Pit Arena** if the priority is reusing Ball Pit work as a real game.
2. **Sorting Factory** if the priority is a more distinct touch-machine game.
3. **Gamepad input adapter + Geometry Rally plan** if the priority is controller-centered games.

### Phase E — First gamepad game

Do not start a gamepad game until the Gamepad API adapter/mapping is designed enough to avoid keyboard-only code.

Recommended first gamepad game: **Geometry Rally**.  
Recommended fallback: **Multi-Ball Breakout** if controller vehicle feel is too risky.

---

## 9. Implementation recipe for one game

Use this as the repeatable slice.

### 9.1 Plan/update this bible first

For the selected game, update its row with:

- exact status;
- selected input category;
- controls mapping;
- engine features required;
- implementation risks;
- acceptance criteria.

### 9.2 Build model first

Create a deterministic model for rules and score. Examples:

- `PegboardModel.dropBall(x)`;
- `PegboardModel.resolveBin(ballId, binId)`;
- `GeometryRallyModel.passCheckpoint(id)`;
- `BreakoutModel.hitBrick(id)`.

Model tests should prove scoring, reset, fail/complete state, and edge cases without Pixi.

### 9.3 Add definition and config

Definition should advertise only real capabilities:

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

Do not include raw/WebGL or gamepad capabilities until those paths are real.

### 9.4 Implement scene

Scene responsibilities:

- construct Pixi primitives and physics bodies;
- translate input into model actions or forces;
- emit game events to shell;
- render model/physics state;
- clean up all Pixi/physics resources on exit;
- keep preview/standard/high profiles bounded.

### 9.5 Add preview and demo/AI

Preview rules:

- no audio;
- minimal bodies;
- no raw/high-cost allocations;
- idle-aware;
- stable enough for gallery tile.

Demo/AI rules:

- injects through the same game input/model path;
- releases any held pointer/gamepad intents;
- never secretly runs in normal play.

### 9.6 Register and document

- Export/register in `packages/games/src/index.ts`.
- If demo QA status exists for the game, update it.
- Update this bible with progress and verification evidence.

---

## 10. Verification gates

Run the narrowest useful checks first.

Recommended commands:

```bash
pnpm --filter @hooksjam/pixi-lab-core build
pnpm --filter @hooksjam/pixi-lab-games typecheck
pnpm --filter @hooksjam/pixi-lab-games build
pnpm exec vitest run <focused-test-files>
pnpm test
pnpm build
```

If a command is unsupported or times out under Windows/MSYS, record the exact failure and run smaller package-level commands instead. Do not claim a broad gate passed unless it really did.

Manual/browser QA for playable games:

- launch demo app;
- confirm tile renders;
- launch game route;
- verify primary controls;
- verify reset/pause/tutorial/settings;
- verify score/gameover/complete loop;
- verify preview stays performant;
- record any browser/device gaps in this bible.

---

## 11. Branch/tooling notes

- GitHub auth should use `jamesdhooks` for this repo.
- Use `pnpm` only.
- Conventional commit scopes include `core`, `react`, `games`, `sims`, `demo`, `ci`, `deps`, `config`.
- `/examples` is ignored. Do not force-add reference examples unless James asks.
- If git maintenance complains about unreachable objects or stale local refs, avoid mixing that cleanup into game implementation commits unless it blocks the work.

---

## 12. Current handoff state

### Done in this bible update

- Reframed this file as a full agent guide and active progress tracker.
- Folded the touch/fridge game catalogue into the tracked source of truth.
- Folded the gamepad/controller game catalogue into the tracked source of truth.
- Categorized each catalogue item as `touch`, `gamepad`, or simulation/non-game.
- Marked Ball Pit as simulation/toy until it has explicit game mechanics.
- Added support/architecture requirements per game so agents can implement one game at a time without guessing.
- Documented `/examples` as reference-only and ignored.

### Next agent recommendation

1. Implement **Pegboard / Pachinko** as the first true touch game.
2. Keep the implementation Pixi-first and primitive-rendered.
3. Add only the shared architecture Pegboard actually needs.
4. Update this bible after the slice with real test/build evidence.

### Open decision for James

After Pegboard, choose whether the next major direction is:

- **touch track:** Color Pit Arena or Sorting Factory;
- **gamepad track:** Gamepad input adapter plus Geometry Rally / Multi-Ball Breakout.
