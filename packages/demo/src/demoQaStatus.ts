/**
 * Machine-readable companion to `pixijs_simulation_tracking_system_v1.md`.
 *
 * Add ids here only after James explicitly approves the demo during manual QA.
 * Unlisted demo-capable experiences are shown with a "QA" marker in the gallery.
 */
export const DEMO_QA_PASSED_IDS: readonly string[] = [
];

export function hasPassedDemoQa(experienceId: string): boolean {
  return DEMO_QA_PASSED_IDS.includes(experienceId);
}
