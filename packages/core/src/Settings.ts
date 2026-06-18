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

    // Load persisted overrides, but validate them against the current field schema.
    // Browser storage can outlive registry/setting migrations, so stale values must
    // not leak into scenes or be re-persisted after the user touches any control.
    const stored = this.load();
    this.data = { ...defaults, ...stored } as T;
    this.sanitizeAll();
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.data[key];
  }

  set<K extends keyof T>(key: K, value: T[K]) {
    const field = this.fields.find((f) => f.key === (key as string));
    if (!field) return;

    this.data[key] = this.sanitizeValue(field, value) as T[K];
    this.persist();
    for (const cb of this.listeners) {
      cb(key, this.data[key] as SettingsValue);
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

  private sanitizeAll() {
    const allowedKeys = new Set(this.fields.map((field) => field.key));

    for (const key of Object.keys(this.data)) {
      if (!allowedKeys.has(key)) {
        delete this.data[key as keyof T];
      }
    }

    for (const field of this.fields) {
      this.data[field.key as keyof T] = this.sanitizeValue(
        field,
        this.data[field.key as keyof T],
      ) as T[keyof T];
    }
  }

  private sanitizeValue(field: SettingsField, value: unknown): SettingsValue {
    switch (field.type) {
      case 'number': {
        const numeric = typeof value === 'number' && Number.isFinite(value) ? value : Number(field.default);
        const fallback = Number.isFinite(numeric) ? numeric : 0;
        return Math.max(field.min ?? -Infinity, Math.min(field.max ?? Infinity, fallback));
      }
      case 'boolean':
        return typeof value === 'boolean' ? value : Boolean(field.default);
      case 'select': {
        const stringValue = typeof value === 'string' ? value : String(field.default ?? '');
        if (!field.options?.length || field.options.some((option) => option.value === stringValue)) {
          return stringValue;
        }
        return field.options[0]?.value ?? String(field.default ?? '');
      }
      case 'string':
        return typeof value === 'string' ? value : String(field.default ?? '');
      default:
        return field.default;
    }
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
