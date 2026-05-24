/**
 * packages/core/src/scoring/HighScoreProvider.ts
 *
 * Interface for the high score system.
 * Default implementation calls the /api/games/scores endpoint.
 * Can be swapped for a localStorage-only impl for offline / preview scenes.
 */
import type { ScoreEntry } from '../types';

export interface SubmitScoreInput {
  gameId: string;
  score: number;
  playerName?: string;
  meta?: Record<string, unknown>;
}

export interface HighScoreProvider {
  /** Submit a score. Resolves when persisted. */
  submitScore(input: SubmitScoreInput): Promise<ScoreEntry>;
  /** Get top N scores for a game. */
  topScores(gameId: string, limit?: number): Promise<ScoreEntry[]>;
  /** Get current user's best score for a game. */
  myBest(gameId: string): Promise<ScoreEntry | null>;
}

/**
 * API-backed provider — the default in production.
 * React shell wires this up via GameRuntime.
 */
export class ApiHighScoreProvider implements HighScoreProvider {
  async submitScore(input: SubmitScoreInput): Promise<ScoreEntry> {
    const res = await fetch('/api/games/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`Score submit failed: ${res.status}`);
    const body = (await res.json()) as { data: ScoreEntry };
    return body.data;
  }

  async topScores(gameId: string, limit = 20): Promise<ScoreEntry[]> {
    const res = await fetch(`/api/games/scores/${gameId}?limit=${limit}`, {
      credentials: 'include',
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data: ScoreEntry[] };
    return body.data ?? [];
  }

  async myBest(gameId: string): Promise<ScoreEntry | null> {
    const res = await fetch(`/api/games/scores/${gameId}/me`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: ScoreEntry | null };
    return body.data ?? null;
  }
}

/**
 * Offline / preview provider — no network, no auth required.
 * Used by GameTile preview scenes.
 */
export class NoopHighScoreProvider implements HighScoreProvider {
  async submitScore(_input: SubmitScoreInput): Promise<ScoreEntry> {
    return {
      gameId: _input.gameId,
      score: _input.score,
      playerName: _input.playerName,
      meta: _input.meta,
      createdAt: new Date(),
    };
  }

  async topScores(_gameId: string): Promise<ScoreEntry[]> {
    return [];
  }

  async myBest(_gameId: string): Promise<ScoreEntry | null> {
    return null;
  }
}
