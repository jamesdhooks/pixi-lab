/**
 * components/games/ui/GameOverModal.tsx
 *
 * Shown when the game ends. Displays score, name input with suggestions,
 * and a leaderboard snippet.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, RotateCcw } from 'lucide-react';
import type { ScoreEntry } from '@hooksjam/pixi-lab-core';

interface GameOverModalProps {
  score: number;
  suggestions: string[];
  topScores: ScoreEntry[];
  onSubmit: (name: string) => void | Promise<void>;
  onRestart: () => void;
  onQuit: () => void;
}

export function GameOverModal({
  score,
  suggestions,
  topScores,
  onSubmit,
  onRestart,
  onQuit,
}: GameOverModalProps) {
  const [name, setName] = useState(suggestions[0] ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    await onSubmit(name.trim());
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="mx-4 w-full max-w-sm rounded-3xl border border-white/20 bg-white/10 p-6 text-white shadow-2xl"
      >
        <div className="mb-4 text-center">
          <Trophy size={32} className="mx-auto mb-2 text-yellow-400" />
          <h2 className="text-2xl font-bold">Game Over</h2>
          <p className="mt-1 text-4xl font-black text-yellow-300">{score.toLocaleString()}</p>
        </div>

        {!submitted ? (
          <div className="mb-4">
            <label className="mb-1 block text-xs text-white/60">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleSubmit();
                }
              }}
              maxLength={20}
              placeholder="Enter your name…"
              className="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/40"
            />
            {suggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestions.slice(0, 4).map((s) => (
                  <button
                    key={s}
                    onClick={() => setName(s)}
                    className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs transition-colors hover:bg-white/20"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                void handleSubmit();
              }}
              disabled={!name.trim() || submitting}
              className="mt-3 w-full rounded-xl bg-yellow-400 py-2.5 font-bold text-black transition-colors hover:bg-yellow-300 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save Score'}
            </motion.button>
          </div>
        ) : (
          <p className="mb-4 text-center text-sm text-green-300">Score saved! 🎉</p>
        )}

        {/* Top scores snippet */}
        {topScores.length > 0 && (
          <div className="mb-4 border-t border-white/10 pt-3">
            <p className="mb-2 text-xs text-white/50">Top Scores</p>
            <ol className="space-y-1">
              {topScores.slice(0, 5).map((entry, i) => (
                <li key={i} className="flex justify-between text-xs">
                  <span className="text-white/60">
                    {i + 1}. {entry.playerName ?? 'Unknown'}
                  </span>
                  <span className="font-semibold text-white">{entry.score.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onRestart}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/15 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/25"
          >
            <RotateCcw size={14} />
            Play Again
          </motion.button>
          <button
            onClick={onQuit}
            className="flex-1 text-sm text-white/50 transition-colors hover:text-white"
          >
            Quit
          </button>
        </div>
      </motion.div>
    </div>
  );
}
