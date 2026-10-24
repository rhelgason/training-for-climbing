/**
 * Sound, buzz, and keep-the-screen-on for the interval timer. Every one of
 * these is a browser nicety that may be missing or refused (iOS needs a tap
 * before audio, desktop has no vibration), so each fails silently.
 */

let ctx: AudioContext | null = null;

/** Create (or resume) the audio context. Call from a tap so iOS allows it. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, ms: number, gain = 0.25): void {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = ctx.currentTime;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.02);
  } catch {
    // Audio is a nicety.
  }
}

function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not every device vibrates.
  }
}

export type Cue = 'tick' | 'go' | 'stop' | 'done';

export function playCue(cue: Cue, sound: boolean): void {
  if (cue === 'tick') {
    if (sound) tone(660, 90);
    buzz(40);
  } else if (cue === 'go') {
    if (sound) tone(990, 260, 0.35);
    buzz(200);
  } else if (cue === 'stop') {
    if (sound) tone(440, 320, 0.35);
    buzz([120, 60, 120]);
  } else {
    if (sound) {
      tone(660, 150);
      setTimeout(() => tone(880, 150), 170);
      setTimeout(() => tone(1100, 300), 340);
    }
    buzz([100, 50, 100, 50, 300]);
  }
}

type WakeLock = { release: () => Promise<void> };

/** Keep the screen awake while the timer runs. Returns a release function. */
export async function holdWakeLock(): Promise<() => void> {
  try {
    const nav = navigator as unknown as {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLock> };
    };
    const lock = await nav.wakeLock?.request('screen');
    return () => void lock?.release().catch(() => undefined);
  } catch {
    return () => undefined;
  }
}
