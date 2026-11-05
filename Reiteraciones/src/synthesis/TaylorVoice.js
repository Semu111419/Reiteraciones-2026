/**
 * TaylorVoice.js
 * Voz individual de síntesis basada en una aproximación de Taylor T_N(t; a).
 * Utiliza PeriodicWave generada analíticamente a partir de los coeficientes de Taylor.
 */

export class TaylorVoice {
  /**
   * @param {AudioContext} audioContext
   * @param {number} order - Orden de Taylor (1, 2, 4, 8, 16)
   * @param {TaylorEngine} taylorEngine
   * @param {AudioNode} destinationNode - Nodo de envío (reverb / master)
   */
  constructor(audioContext, order, taylorEngine, destinationNode) {
    this.ctx = audioContext;
    this.order = order;
    this.taylorEngine = taylorEngine;
    this.destination = destinationNode;

    this.osc = null;
    this.gainNode = null;
    this.filterNode = null;
    this.panNode = null;
    this.periodicWave = null;
    this.isPlaying = false;
    this.currentFreq = null; // Frecuencia fundamental actual para sincronización de osciloscopio

    // Bus individual para análisis de osciloscopio en tiempo real
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.3;

    // Nodo de salida para esta voz que alimenta tanto al destino como a su Analyser
    this.voiceOut = this.ctx.createGain();
    this.voiceOut.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this.voiceOut.connect(this.destination);
    this.voiceOut.connect(this.analyser);

    this._buildPeriodicWave();
  }

  _buildPeriodicWave() {
    // Calculamos los armónicos resultantes de la wavetable de Taylor
    const tableLength = 2048;
    const wavetable = this.taylorEngine.generatePeriodicWavetable(this.order, 0, tableLength);

    // Transformada discreta de Fourier para obtener coeficientes reales e imaginarios
    const numHarmonics = Math.min(64, Math.floor(tableLength / 2));
    const real = new Float32Array(numHarmonics);
    const imag = new Float32Array(numHarmonics);

    for (let k = 1; k < numHarmonics; k++) {
      let sumRe = 0;
      let sumIm = 0;
      for (let n = 0; n < tableLength; n++) {
        const angle = (2 * Math.PI * k * n) / tableLength;
        sumRe += wavetable[n] * Math.cos(angle);
        sumIm += wavetable[n] * Math.sin(angle);
      }
      real[k] = sumRe / tableLength;
      imag[k] = sumIm / tableLength;
    }

    try {
      this.periodicWave = this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    } catch (e) {
      // Fallback a onda sinusoidal estándar si ocurre algún error
      console.warn(`Fallback for Taylor wave order ${this.order}`);
    }
  }

  /**
   * Dispara una nota o textura con esta aproximación de Taylor
   * @param {number} freq - Frecuencia en Hz
   * @param {number} duration - Duración estimada en segundos
   * @param {number} targetGain - Ganancia (0.0 a 1.0)
   * @param {number} pan - Posición estéreo (-1 a 1)
   */
  trigger(freq, duration = 3.0, targetGain = 0.2, pan = 0) {
    const now = this.ctx.currentTime;

    this.currentFreq = freq;
    this.isPlaying = true;

    // Crear nodos
    const osc = this.ctx.createOscillator();
    if (this.periodicWave) {
      osc.setPeriodicWave(this.periodicWave);
    } else {
      osc.type = this.order <= 2 ? 'sine' : (this.order <= 4 ? 'triangle' : 'sawtooth');
    }
    osc.frequency.setValueAtTime(freq, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);

    // Envolvente suave estilo órgano/cuerda frotada
    const attack = Math.min(1.2, duration * 0.3);
    const release = Math.min(2.0, duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, targetGain), now + attack);
    gain.gain.setValueAtTime(Math.max(0.001, targetGain), now + duration - release);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    // Filtro paso-bajo sutil para calidez tímbrica
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const cutoff = Math.min(8000, freq * (2 + Math.log2(this.order + 1) * 2));
    filter.frequency.setValueAtTime(cutoff, now);

    // Paneo estéreo
    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, now);

    // Ruteo
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.voiceOut);

    osc.start(now);
    osc.stop(now + duration + 0.1);

    osc.onended = () => {
      if (this.currentFreq === freq) {
        this.currentFreq = null;
        this.isPlaying = false;
      }
    };
  }
}
