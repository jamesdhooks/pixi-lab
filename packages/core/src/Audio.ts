/**
 * packages/core/src/Audio.ts
 *
 * WebAudio singleton. Provides:
 * - Synthesised tones (bounce, pop, impact, click) — no audio files needed
 * - Optional small sample bank with pooled AudioBufferSourceNodes
 * - Mute/unmute
 */

type ToneName = 'bounce' | 'pop' | 'impact' | 'drain' | 'score' | 'click';

const TONE_CONFIG: Record<
  ToneName,
  { freq: number; duration: number; type: OscillatorType; gain: number }
> = {
  bounce: { freq: 440, duration: 0.04, type: 'sine', gain: 0.18 },
  pop: { freq: 880, duration: 0.06, type: 'sine', gain: 0.22 },
  impact: { freq: 200, duration: 0.08, type: 'triangle', gain: 0.3 },
  drain: { freq: 180, duration: 0.15, type: 'sine', gain: 0.25 },
  score: { freq: 660, duration: 0.12, type: 'triangle', gain: 0.28 },
  click: { freq: 1200, duration: 0.03, type: 'square', gain: 0.12 },
};

export class Audio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _muted = false;
  private _enabled = true;

  /** Must be called from a user gesture to satisfy browser autoplay policy */
  resume() {
    if (!this.ctx) {
      this.ctx = new (
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._muted ? 0 : 1;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  playTone(name: ToneName) {
    if (!this._enabled || this._muted || !this.ctx || !this.masterGain) return;

    const cfg = TONE_CONFIG[name];
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = cfg.type;
    osc.frequency.setValueAtTime(cfg.freq, now);

    gainNode.gain.setValueAtTime(cfg.gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + cfg.duration);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + cfg.duration + 0.01);
  }

  /** Play a random pitch within a range — useful for ball spawns */
  playToneAt(freq: number, durationSec = 0.05, type: OscillatorType = 'sine', gain = 0.2) {
    if (!this._enabled || this._muted || !this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + durationSec + 0.01);
  }

  setEnabled(enabled: boolean) {
    this._enabled = enabled;
  }

  setMuted(muted: boolean) {
    this._muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 1;
    }
  }

  get muted() {
    return this._muted;
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
  }
}
