// Small synthesized sound effects (no audio files).

let ctx = null;

/** Create or resume the audio context. Call from a user gesture. */
export function audio() {
  if (typeof window === "undefined" || !window.AudioContext) return null;
  ctx ||= new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq, seconds, type, volume, delay = 0) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, a.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + delay + seconds);
  osc.connect(gain);
  gain.connect(a.destination);
  osc.start(a.currentTime + delay);
  osc.stop(a.currentTime + delay + seconds);
}

/** Chime for a logged answer; rarer tiers sound brighter. */
export function playHit(tier, muted) {
  if (muted) return;
  if (tier === "galaxy") {
    // Top answer: a rising fanfare with a sparkle on top.
    tone(523, 0.14, "triangle", 0.06);
    tone(659, 0.14, "triangle", 0.06, 0.09);
    tone(784, 0.16, "triangle", 0.06, 0.18);
    tone(1047, 0.5, "triangle", 0.07, 0.27);
    tone(1568, 0.35, "sine", 0.03, 0.34);
    tone(2093, 0.3, "sine", 0.02, 0.42);
  } else if (tier === "nebula" || tier === "deepspace") {
    tone(tier === "nebula" ? 620 : 480, 0.12, "sine", 0.04);
  } else {
    tone(360, 0.08, "sine", 0.03);
  }
}

/** Low thud for a rejected answer. */
export function playMiss(muted) {
  if (!muted) tone(140, 0.12, "triangle", 0.03);
}
