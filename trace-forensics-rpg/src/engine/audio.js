// Procedural audio — music & SFX via the Web Audio API. No asset files needed.
// Everything is synthesized, so it works offline and loads instantly.
//
// Browsers block audio until a user gesture; call AudioEngine.unlock() from
// the first click/keypress.

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicTimer = null;
    this.enabled = true;
    this.musicOn = true;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.18;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.master);
  }

  // ---- low-level tone helper ----
  tone({ freq = 440, dur = 0.12, type = "sine", gain = 0.3, when = 0, bus = "sfx", glideTo = null, attack = 0.005, release = 0.06 }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
    osc.connect(g);
    g.connect(bus === "music" ? this.musicGain : this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + release + 0.02);
  }

  noise({ dur = 0.15, gain = 0.3, when = 0, filterFreq = 1200 }) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + when;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(g); g.connect(this.sfxGain);
    src.start(t0);
    src.stop(t0 + dur);
  }

  // ---- SFX ----
  sfx(name) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case "move":      this.tone({ freq: 220, dur: 0.04, type: "square", gain: 0.05 }); break;
      case "select":    this.tone({ freq: 660, dur: 0.08, type: "triangle", gain: 0.25 }); break;
      case "confirm":   this.tone({ freq: 523, dur: 0.1, type: "triangle", gain: 0.25 });
                        this.tone({ freq: 784, dur: 0.12, type: "triangle", gain: 0.25, when: 0.08 }); break;
      case "type":      this.tone({ freq: 1200 + Math.random() * 400, dur: 0.02, type: "square", gain: 0.04 }); break;
      case "enter":     this.tone({ freq: 440, dur: 0.06, type: "square", gain: 0.12 }); break;
      case "diceRoll":  this.noise({ dur: 0.5, gain: 0.12, filterFreq: 2500 }); break;
      case "diceLand":  this.tone({ freq: 180, dur: 0.1, type: "square", gain: 0.3, glideTo: 90 });
                        this.noise({ dur: 0.08, gain: 0.15, filterFreq: 800 }); break;
      case "success":   [523, 659, 784].forEach((f, i) => this.tone({ freq: f, dur: 0.14, type: "triangle", gain: 0.25, when: i * 0.1 })); break;
      case "critSuccess": [523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.16, type: "triangle", gain: 0.3, when: i * 0.09 })); break;
      case "failure":   this.tone({ freq: 300, dur: 0.25, type: "sawtooth", gain: 0.2, glideTo: 150 }); break;
      case "critFail":  this.tone({ freq: 200, dur: 0.4, type: "sawtooth", gain: 0.25, glideTo: 70 }); break;
      case "evidence":  this.tone({ freq: 880, dur: 0.1, type: "sine", gain: 0.25 });
                        this.tone({ freq: 1318, dur: 0.18, type: "sine", gain: 0.25, when: 0.09 }); break;
      case "levelUp":   [392, 523, 659, 784, 1046].forEach((f, i) => this.tone({ freq: f, dur: 0.18, type: "triangle", gain: 0.3, when: i * 0.1 })); break;
      case "unlock":    this.tone({ freq: 440, dur: 0.1, type: "sine", gain: 0.2, glideTo: 1200 }); break;
      case "error":     this.tone({ freq: 160, dur: 0.15, type: "square", gain: 0.2 }); break;
      default: break;
    }
  }

  // ---- Ambient music: a slow arpeggiated minor progression (spooky/arcane) ----
  startMusic() {
    if (!this.ctx || !this.enabled || !this.musicOn) return;
    if (this.musicTimer) return;
    // A minor / F / C / G feel, low and atmospheric.
    const chords = [
      [220.0, 261.6, 329.6], // Am
      [174.6, 220.0, 261.6], // F
      [196.0, 261.6, 329.6], // C-ish
      [196.0, 246.9, 293.7], // G
    ];
    let step = 0;
    const beat = 0.5;
    const tick = () => {
      if (!this.musicOn) return;
      const chord = chords[Math.floor(step / 4) % chords.length];
      const note = chord[step % 3];
      // arpeggio voice
      this.tone({ freq: note, dur: 0.45, type: "triangle", gain: 0.18, bus: "music", attack: 0.02, release: 0.2 });
      // low drone on downbeat
      if (step % 4 === 0) {
        this.tone({ freq: chord[0] / 2, dur: 1.9, type: "sine", gain: 0.12, bus: "music", attack: 0.1, release: 0.6 });
      }
      // sparkle
      if (step % 8 === 6) {
        this.tone({ freq: note * 2, dur: 0.3, type: "sine", gain: 0.06, bus: "music", attack: 0.01, release: 0.2 });
      }
      step++;
    };
    tick();
    this.musicTimer = setInterval(tick, beat * 1000);
  }

  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicOn) this.startMusic();
    else this.stopMusic();
    return this.musicOn;
  }

  toggleAll() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopMusic();
    else if (this.musicOn) this.startMusic();
    return this.enabled;
  }
}

export const audio = new AudioEngine();
