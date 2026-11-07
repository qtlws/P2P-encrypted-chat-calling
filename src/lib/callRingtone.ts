/**
 * Web Audio API synthesizer for incoming call ringtones and call-waiting beeps.
 * 100% client-side, zero external audio assets, works completely offline.
 */

class CallRingtonePlayer {
  private audioCtx: AudioContext | null = null;
  private ringTimer: ReturnType<typeof setInterval> | null = null;
  private isRinging = false;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /**
   * Plays a single dual-frequency ring tone burst (523Hz + 659Hz, classic warm chime)
   */
  private playRingBurst() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Note 1: C5 (523.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);

      // Note 2: E5 (659.25 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now);

      // Master gain for the burst
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(0.18, now + 0.05);
      masterGain.gain.setValueAtTime(0.18, now + 0.35);
      masterGain.gain.linearRampToValueAtTime(0.01, now + 0.45);
      masterGain.gain.setValueAtTime(0, now + 0.5);

      // Second pulse in the ring
      masterGain.gain.linearRampToValueAtTime(0.22, now + 0.6);
      masterGain.gain.setValueAtTime(0.22, now + 1.1);
      masterGain.gain.linearRampToValueAtTime(0, now + 1.25);

      gain1.gain.setValueAtTime(0.5, now);
      gain2.gain.setValueAtTime(0.5, now);

      osc1.connect(gain1);
      osc2.connect(gain2);
      gain1.connect(masterGain);
      gain2.connect(masterGain);
      masterGain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.3);
      osc2.stop(now + 1.3);
    } catch {
      // Audio autoplay may be constrained before user interaction
    }
  }

  /**
   * Start looping the incoming call ringtone
   */
  public startRingtone() {
    if (this.isRinging) return;
    this.isRinging = true;

    // Play first burst immediately
    this.playRingBurst();

    // Loop burst every 2.8 seconds
    this.ringTimer = setInterval(() => {
      if (this.isRinging) {
        this.playRingBurst();
      }
    }, 2800);
  }

  /**
   * Stop the ringtone immediately
   */
  public stopRingtone() {
    this.isRinging = false;
    if (this.ringTimer) {
      clearInterval(this.ringTimer);
      this.ringTimer = null;
    }
    if (this.audioCtx && this.audioCtx.state === 'running') {
      try {
        this.audioCtx.suspend().catch(() => {});
      } catch {}
    }
  }

  /**
   * Plays a subtle call waiting double-beep (e.g. when already in a call and someone calls)
   */
  public playCallWaitingBeep() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(784, now); // G5 note

      // Beep 1
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
      gain.gain.setValueAtTime(0.15, now + 0.08);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);

      // Beep 2
      gain.gain.setValueAtTime(0, now + 0.18);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.2);
      gain.gain.setValueAtTime(0.15, now + 0.26);
      gain.gain.linearRampToValueAtTime(0, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {}
  }
}

export const callRingtone = new CallRingtonePlayer();
