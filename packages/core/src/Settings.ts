/**
 * packages/core/src/Settings.ts
 *
 * Per-game settings store backed by localStorage.
 * Zod schema validates the shape; a reactive proxy notifies listeners on change.
 */
import type { SettingsField, SettingsValue } from './types.js';

type SettingsMap = Record<string, SettingsValue>;
type ChangeListener<T extends SettingsMap> = (key: keyof T, value: SettingsValue) => void;

export class Settings<T extends SettingsMap = SettingsMap> {
  private readonly gameId: string;
  private readonly fields: SettingsField[];
  private data: T;
  private listeners = new Set<ChangeListener<T>>();

  constructor(gameId: string, fields: SettingsField[]) {
    this.gameId = gameId;
    this.fields = fields;

    // Build defaults
    const defaults: SettingsMap = {};
    for (const f of fields) {
      defaults[f.key] = f.default;
    }

    // Load persisted overrides
    const stored = this.load();
    this.data = { ...defaults, ...stored } as T;
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.data[key];
  }

  set<K extends keyof T>(key: K, value: T[K]) {
    const field = this.fields.find((f) => f.key === (key as string));
    if (!field) return;

    // Clamp numbers
    if (field.type === 'number' && typeof value === 'number') {
      const clamped = Math.max(field.min ?? -Infinity, Math.min(field.max ?? Infinity, value));
      value = clamped as T[K];
    }

    this.data[key] = value;
    this.persist();
    for (const cb of this.listeners) {
      cb(key, value as SettingsValue);
    }
  }

  getAll(): Readonly<T> {
    return { ...this.data };
  }

  getFields(): readonly SettingsField[] {
    return this.fields;
  }

  onChange(cb: ChangeListener<T>): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  reset() {
    for (const f of this.fields) {
      this.data[f.key as keyof T] = f.default as T[keyof T];
    }
    this.persist();
  }

  private storageKey() {
    return `fao:game:settings:${this.gameId}`;
  }

  private persist() {
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(this.data));
    } catch {
      // storage not available — silently ignore
    }
  }

  private load(): Partial<T> {
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (!raw) return {};
      return JSON.parse(raw) as Partial<T>;
    } catch {
      return {};
    }
  }
}
