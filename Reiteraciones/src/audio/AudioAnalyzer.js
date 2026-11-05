/**
 * AudioAnalyzer.js
 * Análisis espectral en tiempo real, detección de frecuencia fundamental (YIN / autocorrelación)
 * y extracción de armónicos para construir el HarmonicModel.
 */

import { HarmonicModel } from '../math/HarmonicModel.js';

export class AudioAnalyzer {
  /**
   * @param {AudioContext} audioContext
   */
  constructor(audioContext) {
    this.ctx = audioContext;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 	8192;
    this.analyser.smoothingTimeConstant = 0.8;

    this.timeData = new Float32Array(this.analyser.fftSize);
    this.freqData = new Float32Array(this.analyser.frequencyBinCount);
  }

  /**
   * Conecta una fuente de audio (MediaStreamAudioSourceNode o AudioBufferSourceNode) al analizador
   * @param {AudioNode} sourceNode
   */
  connectSource(sourceNode) {
    sourceNode.connect(this.analyser);
  }

  /**
   * Desconecta la fuente
   * @param {AudioNode} sourceNode
   */
  disconnectSource(sourceNode) {
    try {
      sourceNode.disconnect(this.analyser);
    } catch (e) {
      // Ignorar si ya estaba desconectado
    }
  }

  /**
   * Obtiene los datos temporales y de frecuencia actuales para visualización
   */
  getAnalysisFrame() {
    this.analyser.getFloatTimeDomainData(this.timeData);
    this.analyser.getFloatFrequencyData(this.freqData);

    const f0 = this.detectFundamentalFrequency(this.timeData, this.ctx.sampleRate);
    const rms = this.calculateRMS(this.timeData);

    return {
      timeData: this.timeData,
      freqData: this.freqData,
      f0,
      rms
    };
  }

  calculateRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * Detección de f0 por autocorrelación normalizada (optimizado para cuerda LA 440 Hz)
   * @param {Float32Array} buffer
   * @param {number} sampleRate
   * @returns {number|null} f0 en Hz o null si no hay tono claro
   */
  detectFundamentalFrequency(buffer, sampleRate) {
    const minFreq = 180;  // Debajo de G3
    const maxFreq = 1000; // Arriba de B5
    const minPeriod = Math.floor(sampleRate / maxFreq);
    const maxPeriod = Math.floor(sampleRate / minFreq);

    let bestR = -1;
    let bestPeriod = -1;

    // Autocorrelación normalizada
    for (let lag = minPeriod; lag <= maxPeriod; lag++) {
      let sum = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < buffer.length - lag; i += 2) {
        sum += buffer[i] * buffer[i + lag];
        normA += buffer[i] * buffer[i];
        normB += buffer[i + lag] * buffer[i + lag];
      }

      const r = sum / (Math.sqrt(normA * normB) || 1);

      if (r > bestR && r > 0.65) {
        bestR = r;
        bestPeriod = lag;
      }
    }

    if (bestPeriod > 0 && bestR > 0.68) {
      return sampleRate / bestPeriod;
    }
    return null;
  }

  /**
   * Extrae la serie de armónicos de la señal actual
   * @param {number} targetF0 (default: 440 Hz)
   * @param {number} maxHarmonics (default: 12)
   * @returns {HarmonicModel}
   */
  extractHarmonicModel(targetF0 = 440, maxHarmonics = 12) {
    this.analyser.getFloatFrequencyData(this.freqData);
    this.analyser.getFloatTimeDomainData(this.timeData);

    const binWidth = this.ctx.sampleRate / this.analyser.fftSize;
    const f0 = targetF0 || 440;
    const harmonics = [];

    for (let n = 1; n <= maxHarmonics; n++) {
      const expectedFreq = n * f0;
      if (expectedFreq > this.ctx.sampleRate / 2) break;

      // Buscar el pico en una vecindad alrededor de expectedFreq
      const centerBin = Math.round(expectedFreq / binWidth);
      const searchRadius = Math.max(2, Math.round(f0 * 0.15 / binWidth));
      const startBin = Math.max(1, centerBin - searchRadius);
      const endBin = Math.min(this.freqData.length - 1, centerBin + searchRadius);

      let peakBin = centerBin;
      let peakDb = -Infinity;

      for (let b = startBin; b <= endBin; b++) {
        if (this.freqData[b] > peakDb) {
          peakDb = this.freqData[b];
          peakBin = b;
        }
      }

      // Convertir dB a amplitud lineal
      const amplitude = Math.pow(10, peakDb / 20);
      const actualFreq = peakBin * binWidth;

      // Fase aproximada por correlación con seno/coseno en la ventana de tiempo
      const phase = this._estimatePhaseAtFreq(this.timeData, actualFreq, this.ctx.sampleRate);

      harmonics.push({
        index: n,
        frequency: actualFreq,
        amplitude: Math.max(0.001, amplitude),
        phase: phase
      });
    }

    const model = new HarmonicModel(f0, harmonics);
    model.normalizeAmplitudes();
    return model;
  }

  _estimatePhaseAtFreq(timeBuffer, freq, sampleRate) {
    let re = 0;
    let im = 0;
    const omega = 2 * Math.PI * freq / sampleRate;
    const len = Math.min(timeBuffer.length, 1024);

    for (let i = 0; i < len; i++) {
      const angle = omega * i;
      re += timeBuffer[i] * Math.cos(angle);
      im += timeBuffer[i] * Math.sin(angle);
    }

    return Math.atan2(im, re);
  }
}
