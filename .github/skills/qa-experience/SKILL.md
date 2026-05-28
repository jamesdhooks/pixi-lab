# SKILL: Mark Experience Demo QA Passed

Use this skill when James explicitly approves an experience after manual demo QA.

Do not use this skill merely because automated tests passed, a local screenshot looked fine, or an agent believes the experience is ready. The trigger is an explicit user approval such as "Amoeba Lamp passes QA", "thumbs up for Mycelium Lattice", or equivalent.

## Source Files

- `pixijs_simulation_tracking_system_v1.md` — human-readable QA and implementation tracking.
- `packages/demo/src/demoQaStatus.ts` — machine-readable gallery status.
- The experience definition under `packages/games/src/<id>/` or `packages/simulations/src/<id>/`.

## Workflow

1. Identify the exact `LabExperience.id` from the definition or registry. Do not guess from display name alone if there is ambiguity.
2. In `pixijs_simulation_tracking_system_v1.md`, update the row in "Manual Demo QA Status":
   - set `Manual QA` to `PASSED`
   - set `Last Reviewed` to the current date
   - replace the notes with the user's approval context and any device/performance notes they gave
3. Add the same id to `DEMO_QA_PASSED_IDS` in `packages/demo/src/demoQaStatus.ts`, keeping the list sorted by registry/gallery order.
4. If the experience is a simulation and the user's approval satisfies deferred manual visual/Pi checks, update that simulation section's validation checklist and deferred notes. Do not mark `STATUS: COMPLETE` unless every completion requirement in the tracking doc is satisfied.
5. Run:

```bash
pnpm --filter @hooksjam/pixi-lab-demo typecheck
pnpm --filter @hooksjam/pixi-lab-demo build
```

## Rules

- New demo-capable experiences should appear as needing QA by default. Do not pre-add them to `DEMO_QA_PASSED_IDS`.
- Keep the docs and gallery status in sync in the same change.
- If approval is partial, record the notes in the tracking doc but leave the gallery marker active.
