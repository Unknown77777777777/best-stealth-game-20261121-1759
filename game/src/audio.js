// The Quiet Gallery — synthesized sound, no audio files.
// Everything is built from oscillators through one WebAudio graph: soft
// footstep ticks, a guard alert sting, a pickup chime, a coin clink, a
// success fanfare and a low ambient hum for the empty museum at night.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.humNodes = null;
    this.lastStep = 0;
  }

  // Browsers only allow audio after a user gesture; call from one.
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startHum();
    } catch (e) {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  // One short oscillator blip with an exponential fade.
  blip(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) { /* audio is cosmetic; never break the game */ }
  }

  // A soft tick under the thief's feet; quieter and duller while sneaking.
  footstep(sneaking) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (now - this.lastStep < 90) return;
    this.lastStep = now;
    this.blip(sneaking ? 140 : 190, 0.06, 'triangle', sneaking ? 0.05 : 0.11);
  }

  // Two-note dissonant sting when the alarm goes up.
  alertSting() {
    this.blip(233, 0.28, 'sawtooth', 0.16);
    this.blip(220, 0.34, 'sawtooth', 0.16, 0.09);
    this.blip(466, 0.22, 'square', 0.06, 0.05);
  }

  // A guard growing suspicious: one low questioning note.
  suspiciousNote() {
    this.blip(330, 0.16, 'sine', 0.1, 0, 262);
  }

  // Bright two-note chime for pocketing an artifact.
  pickupChime() {
    this.blip(880, 0.14, 'sine', 0.14);
    this.blip(1318, 0.22, 'sine', 0.12, 0.08);
  }

  // Metallic clink as a thrown coin lands.
  coinClink() {
    this.blip(2400, 0.05, 'square', 0.05);
    this.blip(1800, 0.09, 'sine', 0.08, 0.03);
  }

  // Ascending fanfare when a level is cleared.
  fanfare() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => this.blip(f, 0.3, 'triangle', 0.13, i * 0.11));
  }

  // A caught sting: low and final.
  caughtSting() {
    this.blip(196, 0.5, 'sawtooth', 0.18, 0, 98);
    this.blip(147, 0.6, 'sawtooth', 0.14, 0.12, 73);
  }

  // The museum at night: a barely-there 55 Hz hum with a slow swell.
  startHum() {
    if (!this.ctx || this.humNodes) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 55;
      gain.gain.value = 0.035;
      lfo.type = 'sine';
      lfo.frequency.value = 0.07;
      lfoGain.gain.value = 0.015;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start();
      lfo.start();
      this.humNodes = { osc, lfo };
    } catch (e) { /* hum is optional */ }
  }
}
