/**
 * AudioInput.js
 * Manejo de entradas de audio: micrófono en vivo y generador de muestra de violín A4.
 */

export class AudioInput {
  /**
   * @param {AudioContext} audioContext
   */
  constructor(audioContext) {
    this.ctx = audioContext;
    this.mediaStream = null;
    this.micSourceNode = null;
    this.sampleSourceNode = null;
    this.activeSource = null; // 'mic' | 'sample' | null
    this.status = 'idle'; // 'idle' | 'active' | 'ready' | 'error'
    this.statusListeners = new Set();
  }

  onStatusChange(listener) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  _setStatus(status) {
    this.status = status;
    for (const l of this.statusListeners) l(this.status);
  }

  /**
   * Solicita acceso al micrófono y conecta la entrada
   * @returns {Promise<MediaStreamAudioSourceNode>}
   */
  async startMicrophone() {
    this.stopActive();
    this._setStatus('requesting');

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      this.micSourceNode = this.ctx.createMediaStreamSource(this.mediaStream);
      this.activeSource = 'mic';
      this._setStatus('active');
      return this.micSourceNode;
    } catch (err) {
      console.error("Error accessing microphone:", err);
      this._setStatus('error');
      throw err;
    }
  }

  /**
   * Genera y reproduce un buffer de audio de violín afinando LA4 (440 Hz)
   * con transitorio de fricción de arco y armónicos realistas.
   * @param {number} durationSec (default: 4.0)
   * @returns {AudioBufferSourceNode}
   */
  playViolinSample(durationSec = 4.0) {
    this.stopActive();

    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    const f0 = 440.0;
    const harmonics = [
      { n: 1, a: 1.0,  p: 0.0 },
      { n: 2, a: 0.82, p: -0.7 },
      { n: 3, a: 0.65, p: 1.1 },
      { n: 4, a: 0.48, p: -1.9 },
      { n: 5, a: 0.35, p: 0.5 },
      { n: 6, a: 0.25, p: -1.2 },
      { n: 7, a: 0.18, p: 2.1 },
      { n: 8, a: 0.12, p: -0.3 }
    ];

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Envolvente de arco de violín: ataque suave (0.3s), sustain con microvibrato, decaimiento suave
      let env = 1.0;
      if (t < 0.35) {
        env = (t / 0.35); // Ataque de frotado
      } else if (t > durationSec - 0.5) {
        env = Math.max(0, (durationSec - t) / 0.5); // Release
      }

      // Sutil vibrato humano (5.5 Hz, ~8 cents)
      const vibrato = 1.0 + 0.005 * Math.sin(2 * Math.PI * 5.5 * t);
      const currentF0 = f0 * vibrato;

      let sampleVal = 0;
      for (const h of harmonics) {
        sampleVal += h.a * Math.sin(2 * Math.PI * (currentF0 * h.n) * t + h.p);
      }

      // Pequeño ruido de fricción de cerda de arco (bow noise filtrado)
      const bowNoise = (Math.random() * 2 - 1) * 0.04 * (t < 0.6 ? 1.5 : 0.6);

      data[i] = (sampleVal * 0.22 + bowNoise) * env;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true; // Para mantener la nota sonando mientras se afina
    source.start();

    this.sampleSourceNode = source;
    this.activeSource = 'sample';
    this._setStatus('active');

    return source;
  }

  stopActive() {
    if (this.sampleSourceNode) {
      try { this.sampleSourceNode.stop(); } catch (e) {}
      try { this.sampleSourceNode.disconnect(); } catch (e) {}
      this.sampleSourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.micSourceNode) {
      try { this.micSourceNode.disconnect(); } catch (e) {}
      this.micSourceNode = null;
    }

    this.activeSource = null;
    this._setStatus('idle');
  }
}
