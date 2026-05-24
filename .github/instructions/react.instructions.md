---
applyTo: packages/react/**/*.{ts,tsx}
---

# React Package Instructions

## Purpose
`packages/react` is the React integration layer. It wraps the engine for use in React apps.
It must be **app-agnostic** — no routing, no fetch calls, no app-specific state.

## Key Components

- `GameRuntime.tsx` — mounts a canvas and owns the `GameApp` lifecycle. The source of truth for canvas mounting.
- `GameTile.tsx` — animated game tile with live preview canvas. Used in game selection grids.
- `GameLauncher.tsx` — **app-agnostic** full-screen game shell (intro → tutorial → play → pause → game over). Accepts `onQuit`, `onSubmitScore`, `topScores` props injected by the host app.
- `ui/` — reusable UI primitives (HUD, QuitButton, IntroCard, etc.)

## Rules

1. **`GameLauncher` stays app-agnostic.** No `useNavigate`, no `fetch('/api/...')`, no app-specific hooks.
   The host app wraps it and injects routing + API behaviour via props.
2. **Import engine types from `@hooksjam/pixi-lab-core`** — never from `pixi.js` or `planck` directly.
3. **No `any`** — type all props, state, and event handlers explicitly.
4. **Components use named exports** — no default exports.
5. **All new public components/types must be exported** from `src/index.ts`.

## `GameLauncherProps` contract

```typescript
interface GameLauncherProps {
  definition: GameDefinition;
  userId?: string;
  topScores?: ScoreEntry[];           // injected by host app
  onSubmitScore?: (score: number, name: string) => Promise<void>; // host app persists
  onQuit?: () => void;                // host app navigates away
}
```

Do NOT add routing or API calls to `GameLauncher`. If you need app-specific behaviour, create a wrapper in the consuming app.
