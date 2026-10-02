/**
 * Procedural Cinematic Ambience & Audio Synthesizer (Web Audio API)
 * Generates rich, license-free atmospheric drone and spatial whoosh for exported videos
 */

/**
 * Build the warm low-passed drone (D1 + A1) feeding `output`
 */
function buildDrone(ctx, output) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(140, ctx.currentTime);
  filter.Q.setValueAtTime(3, ctx.currentTime);
  filter.connect(output);

  // Sub oscillator 1 (Root D1 ~ 36.7Hz)
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(36.7, ctx.currentTime);
  osc1.connect(filter);
  osc1.start();

  // Harmonic oscillator 2 (Fifth A1 ~ 55.0Hz)
  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(55.0, ctx.currentTime);
  const osc2Gain = ctx.createGain();
  osc2Gain.gain.setValueAtTime(0.4, ctx.currentTime);
  osc2.connect(osc2Gain);
  osc2Gain.connect(filter);
  osc2.start();

  return { filter, osc1, osc2 };
}

/**
 * Schedule a band-passed noise whoosh into `output` starting at `now`
 */
function scheduleWhoosh(ctx, output, now, duration) {
  const bufferSize = Math.floor(ctx.sampleRate * Math.min(6, duration));
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const whiteNoise = ctx.createBufferSource();
  whiteNoise.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 3.5;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.28, now + duration * 0.45);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  filter.frequency.setValueAtTime(180, now);
  filter.frequency.exponentialRampToValueAtTime(1200, now + duration * 0.45);
  filter.frequency.exponentialRampToValueAtTime(240, now + duration);

  whiteNoise.connect(filter);
  filter.connect(gain);
  gain.connect(output);

  whiteNoise.start(now);
  whiteNoise.stop(now + duration + 0.2);
}

/**
 * Render the ambience bed (+ optional whoosh) offline into an AudioBuffer of exactly `durationSeconds`,
 * so exported audio is sample-accurate regardless of how long video frames take to render
 */
export async function renderAmbienceOffline({ durationSeconds, volume = 0.5, whooshDuration = 0, sampleRate = 48000 }) {
  const length = Math.max(1, Math.ceil(durationSeconds * sampleRate));
  const ctx = new OfflineAudioContext(2, length, sampleRate);

  const master = ctx.createGain();
  const level = Math.max(0.001, volume * 0.4);
  const fadeOut = Math.min(0.8, durationSeconds * 0.2);
  master.gain.setValueAtTime(0.001, 0);
  master.gain.exponentialRampToValueAtTime(level, Math.min(1.2, durationSeconds * 0.5));
  master.gain.setValueAtTime(level, durationSeconds - fadeOut);
  master.gain.exponentialRampToValueAtTime(0.0001, durationSeconds);
  master.connect(ctx.destination);

  buildDrone(ctx, master);
  if (whooshDuration > 0) scheduleWhoosh(ctx, master, 0, whooshDuration);

  return ctx.startRendering();
}

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

    const { filter, osc1, osc2 } = buildDrone(this.ctx, this.masterGain);
    this.filter = filter;
    this.osc1 = osc1;
    this.osc2 = osc2;
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

  triggerWhoosh(duration = 4.0) {
    if (!this.ctx) this.init();
    try {
      scheduleWhoosh(this.ctx, this.masterGain, this.ctx.currentTime, duration);
    } catch (e) {
      console.warn('Whoosh synthesis error:', e);
    }
  }
}

export const ambience = new AmbienceSynthesizer();
