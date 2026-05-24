/**
 * packages/core/src/utils/nanoid.ts
 *
 * Tiny ID generator — avoids importing the full nanoid package
 * just for body IDs.
 */
let counter = 0;

export function nanoid(): string {
  return `${Date.now().toString(36)}-${(++counter).toString(36)}`;
}
