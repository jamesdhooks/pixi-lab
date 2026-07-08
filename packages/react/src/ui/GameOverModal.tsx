/**
 * components/games/ui/GameOverModal.tsx
 *
 * Shown when a round ends. Displays score, name input with suggestions,
 * an on-screen keyboard, and a leaderboard snippet.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, RotateCcw } from 'lucide-react';
import Keyboard from 'react-simple-keyboard';
import type { ScoreEntry } from '@hooksjam/pixi-lab-core';
import 'react-simple-keyboard/build/css/index.css';

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
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    await onSubmit(name.trim());
    setSubmitting(false);
    setSubmitted(true);
    setKeyboardOpen(false);
  };

  const handleKeyboardPress = (button: string) => {
    if (button === '{enter}') {
      void handleSubmit();
      return;
    }
    if (button === '{bksp}') {
      setName((current) => current.slice(0, -1));
      return;
    }
    if (button === '{space}') {
      setName((current) => `${current} `.slice(0, 20));
      return;
    }
    if (button.length === 1) {
      setName((current) => `${current}${button}`.slice(0, 20));
    }
  };

  return (
    <div className="absolute left-0 top-0 z-40 flex h-full w-full items-center justify-center bg-slate-950 px-4 py-6 text-white">
      <motion.div
        data-result-panel
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        className="max-h-full w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-cyan-200/20 bg-slate-900 p-8 shadow-2xl shadow-cyan-950/40"
      >
        <div className="mb-7 text-center">
          <Trophy size={52} className="mx-auto mb-3 text-yellow-300" />
          <p className="text-sm font-black uppercase tracking-[0.34em] text-cyan-200/75">Round Complete</p>
          <h2 className="mt-2 text-5xl font-black leading-none text-white">Nice Drop</h2>
          <p className="mt-4 text-7xl font-black leading-none text-yellow-300">{score.toLocaleString()}</p>
          <p className="mt-2 text-lg font-semibold text-white/55">points banked</p>
        </div>

        {!submitted ? (
          <div className="mb-7 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <label className="mb-2 block text-sm font-bold uppercase tracking-widest text-white/55">Enter name</label>
            <input
              type="text"
              value={name}
              onFocus={() => setKeyboardOpen(true)}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleSubmit();
                }
              }}
              maxLength={20}
              placeholder="Enter your name…"
              className="w-full rounded-2xl border border-white/15 bg-slate-950 px-5 py-4 text-2xl font-black text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
            />
            {suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.slice(0, 4).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setName(s);
                      setKeyboardOpen(false);
                    }}
                    className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-sm font-bold transition-colors hover:bg-white/15"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {keyboardOpen && (
              <div data-onscreen-keyboard className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 p-2 [&_.hg-button]:!h-11 [&_.hg-button]:!border-white/10 [&_.hg-button]:!bg-white/[0.08] [&_.hg-button]:!text-base [&_.hg-button]:!font-black [&_.hg-button]:!text-white [&_.hg-theme-default]:!bg-transparent">
                <Keyboard
                  onKeyPress={handleKeyboardPress}
                  layout={{
                    default: [
                      '1 2 3 4 5 6 7 8 9 0',
                      'q w e r t y u i o p',
                      'a s d f g h j k l',
                      'z x c v b n m {bksp}',
                      '{space} {enter}',
                    ],
                  }}
                  display={{ '{bksp}': '⌫', '{enter}': 'Save', '{space}': 'Space' }}
                />
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                void handleSubmit();
              }}
              disabled={!name.trim() || submitting}
              className="mt-4 w-full rounded-2xl bg-yellow-300 py-4 text-xl font-black text-slate-950 transition-colors hover:bg-yellow-200 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save Score'}
            </motion.button>
          </div>
        ) : (
          <p className="mb-7 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 py-4 text-center text-lg font-black text-emerald-200">Score saved.</p>
        )}

        {topScores.length > 0 && (
          <div className="mb-7 border-t border-white/10 pt-4">
            <p className="mb-3 text-sm font-black uppercase tracking-widest text-white/40">Top Scores</p>
            <ol className="space-y-2">
              {topScores.slice(0, 5).map((entry, i) => (
                <li key={i} className="flex justify-between rounded-xl bg-white/[0.04] px-4 py-2 text-base">
                  <span className="font-bold text-white/65">
                    {i + 1}. {entry.playerName ?? 'Unknown'}
                  </span>
                  <span className="font-black text-white">{entry.score.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <motion.button
            data-play-again-button
            whileTap={{ scale: 0.98 }}
            onClick={onRestart}
            className="flex items-center justify-center gap-3 rounded-2xl bg-cyan-300 py-5 text-lg font-black text-slate-950 transition-colors hover:bg-cyan-200"
          >
            <RotateCcw size={22} />
            Play Again
          </motion.button>
          <button
            data-quit-button
            onClick={onQuit}
            className="rounded-2xl border border-white/15 bg-white/[0.06] py-5 text-lg font-black text-white transition-colors hover:bg-white/[0.12]"
          >
            Quit
          </button>
        </div>
      </motion.div>
    </div>
  );
}
