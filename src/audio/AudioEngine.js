/**
 * AudioEngine.js
 * Maestro del contexto Web Audio, ruteo de señal y reverb espacial.
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.reverbNode = null;
    this.dryGain = null;
    this.wetGain = null;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass({ latencyHint: 'interactive' });

    // Master bus
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

    // Limitador / Compresor de seguridad para evitar saturación
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-3, this.ctx.currentTime);
    compressor.knee.setValueAtTime(6, this.ctx.currentTime);
    compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    // Sistema de Reverb Espacial (Impulso sintético de sala de concierto)
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this._buildConcertHallImpulse(3.2, 2.4);

    this.dryGain = this.ctx.createGain();
    this.wetGain = this.ctx.createGain();
    this.dryGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    this.wetGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

    // Conexiones de salida
    this.dryGain.connect(compressor);
    this.reverbNode.connect(this.wetGain);
    this.wetGain.connect(compressor);
    compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.isInitialized = true;
  }

  /**
   * Genera un impulso acústico sintético de sala de concierto de alta calidad
   */
  _buildConcertHallImpulse(durationSec = 3.0, decay = 2.0) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * durationSec);
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length;
      // Curva exponencial de decaimiento natural
      const env = Math.exp(-n * decay * 4);
      // Ruido blanco filtrado estéreo
      left[i] = ((Math.random() * 2 - 1) * env);
      right[i] = ((Math.random() * 2 - 1) * env);
    }
    return impulse;
  }

  setMasterVolume(val) {
    if (!this.masterGain || !this.ctx) return;
    this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, val)), this.ctx.currentTime, 0.05);
  }

  setReverbMix(wetAmount) {
    if (!this.wetGain || !this.dryGain || !this.ctx) return;
    const wet = Math.max(0, Math.min(1, wetAmount));
    this.wetGain.gain.setTargetAtTime(wet * 0.7, this.ctx.currentTime, 0.05);
    this.dryGain.gain.setTargetAtTime(1.0 - wet * 0.3, this.ctx.currentTime, 0.05);
  }
}
