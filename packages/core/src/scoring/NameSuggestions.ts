/**
 * packages/core/src/scoring/NameSuggestions.ts
 *
 * Cross-game player name suggestions.
 * Fetches recent names used by this user from /api/games/names/suggestions.
 * Caches in memory for the session.
 */

export class NameSuggestions {
  private names: string[] = [];
  private loaded = false;

  async load(): Promise<string[]> {
    if (this.loaded) return this.names;
    try {
      const res = await fetch('/api/games/names/suggestions', {
        credentials: 'include',
      });
      if (res.ok) {
        const body = (await res.json()) as { data: string[] };
        this.names = body.data ?? [];
      }
    } catch {
      // offline or not authenticated — fine, return empty
    }
    this.loaded = true;
    return this.names;
  }

  /** Add a name to the in-memory list (server persistence happens via submitScore) */
  addLocal(name: string) {
    if (!name || this.names.includes(name)) return;
    this.names = [name, ...this.names].slice(0, 10);
  }

  get cached() {
    return this.names;
  }
}

export const nameSuggestions = new NameSuggestions();
