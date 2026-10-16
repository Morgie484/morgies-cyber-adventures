/* =========================================================================
   CipherTrace — Sound engine
   Uses the Web Audio API to synthesize retro arcade blips at runtime,
   so there are zero audio asset files to ship. Respects a mute toggle.
   ========================================================================= */

const SFX = (function () {
  "use strict";

  let ctx = null;
  let muted = false;
  const MUTE_KEY = "ciphertrace.muted.v1";

  try {
    muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch (_) { /* ignore */ }

  // AudioContext must be created/resumed after a user gesture (browser rule).
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // Play a single tone.
  function tone(freq, duration, type, when, gainPeak) {
    const ac = ensure();
    if (!ac || muted) return;
    const t0 = ac.currentTime + (when || 0);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    const peak = gainPeak == null ? 0.15 : gainPeak;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  // A little melody = sequence of [freq, duration] steps.
  function sequence(steps, type) {
    let t = 0;
    steps.forEach(([f, d]) => {
      if (f > 0) tone(f, d, type, t);
      t += d;
    });
  }

  const sounds = {
    click:   () => tone(440, 0.05, "square", 0, 0.08),
    select:  () => tone(660, 0.07, "triangle", 0, 0.1),
    start:   () => sequence([[523, 0.08], [659, 0.08], [784, 0.12]], "square"),
    correct: () => sequence([[659, 0.09], [880, 0.09], [1175, 0.16]], "triangle"),
    wrong:   () => sequence([[220, 0.12], [160, 0.2]], "sawtooth"),
    tick:    () => tone(880, 0.04, "square", 0, 0.05),
    win:     () => sequence([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.28]], "triangle"),
    lose:    () => sequence([[392, 0.12], [311, 0.12], [262, 0.1], [196, 0.3]], "sawtooth"),
  };

  function play(name) {
    const fn = sounds[name];
    if (fn) fn();
  }

  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch (_) { /* ignore */ }
    return muted;
  }

  function isMuted() { return muted; }

  // Resume audio on first interaction (helps strict autoplay policies).
  function unlock() { ensure(); }

  return { play, toggleMute, isMuted, unlock };
})();
