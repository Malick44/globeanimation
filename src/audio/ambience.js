/**
 * Procedural Cinematic Ambience & Audio Synthesizer (Web Audio API)
 * Generates rich, license-free atmospheric drone and spatial whoosh for exported videos
 */

class AmbienceSynthesizer {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.osc1 = null;
    this.osc2 = null;
    this.filter = null;
    this.destination = null;
    this.isPlaying = false;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    this.destination = this.ctx.createMediaStreamDestination();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

    // Route to speakers AND to media stream recorder
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.connect(this.destination);

    // Low-pass filter for warm cinematic drone
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(140, this.ctx.currentTime);
    this.filter.Q.setValueAtTime(3, this.ctx.currentTime);
    this.filter.connect(this.masterGain);

    // Sub oscillator 1 (Root D1 ~ 36.7Hz)
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sine';
    this.osc1.frequency.setValueAtTime(36.7, this.ctx.currentTime);
    this.osc1.connect(this.filter);
    this.osc1.start();

    // Harmonic oscillator 2 (Fifth A1 ~ 55.0Hz)
    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'triangle';
    this.osc2.frequency.setValueAtTime(55.0, this.ctx.currentTime);
    const osc2Gain = this.ctx.createGain();
    osc2Gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    this.osc2.connect(osc2Gain);
    osc2Gain.connect(this.filter);
    this.osc2.start();
  }

  start(volume = 0.5) {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume * 0.4), now + 1.2);
    this.isPlaying = true;
  }

  stop() {
    if (!this.ctx || !this.isPlaying) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    this.isPlaying = false;
  }

  getAudioTrack() {
    if (!this.ctx) this.init();
    return this.destination?.stream?.getAudioTracks()[0] || null;
  }
}

export const ambience = new AmbienceSynthesizer();
