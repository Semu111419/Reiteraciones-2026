/**
 * HarmonicModel.js
 * Representa el modelo espectral derivado del análisis acústico del violín.
 */

export class HarmonicModel {
  /**
   * @param {number} fundamentalFrequency - Frecuencia fundamental f0 en Hz (ej. 440)
   * @param {Array<{index: number, frequency: number, amplitude: number, phase: number}>} harmonics
   */
  constructor(fundamentalFrequency = 440, harmonics = []) {
    this.fundamentalFrequency = fundamentalFrequency;
    this.harmonics = harmonics;
    this.timestamp = Date.now();
  }

  /**
   * Crea un modelo sintético por defecto (timbre característico de violín afinando cuerda LA)
   * Útil para inicialización instantánea o fallback sin micrófono.
   */
  static createDefaultViolinA4() {
    const f0 = 440.0;
    // Perfil armónico rico de cuerda de violín con arco en LA4
    const defaultHarmonics = [
      { index: 1, frequency: f0 * 1, amplitude: 1.00, phase: 0.0 },
      { index: 2, frequency: f0 * 2, amplitude: 0.78, phase: -0.85 },
      { index: 3, frequency: f0 * 3, amplitude: 0.62, phase: 1.24 },
      { index: 4, frequency: f0 * 4, amplitude: 0.45, phase: -2.10 },
      { index: 5, frequency: f0 * 5, amplitude: 0.38, phase: 0.65 },
      { index: 6, frequency: f0 * 6, amplitude: 0.28, phase: -1.45 },
      { index: 7, frequency: f0 * 7, amplitude: 0.22, phase: 2.30 },
      { index: 8, frequency: f0 * 8, amplitude: 0.18, phase: -0.40 },
      { index: 9, frequency: f0 * 9, amplitude: 0.12, phase: 1.10 },
      { index: 10, frequency: f0 * 10, amplitude: 0.08, phase: -2.75 }
    ];
    return new HarmonicModel(f0, defaultHarmonics);
  }

  /**
   * Normaliza amplitudes para que la máxima sea 1.0
   */
  normalizeAmplitudes() {
    if (!this.harmonics.length) return;
    const maxAmp = Math.max(...this.harmonics.map(h => Math.abs(h.amplitude))) || 1;
    this.harmonics = this.harmonics.map(h => ({
      ...h,
      amplitude: h.amplitude / maxAmp
    }));
  }

  clone() {
    return new HarmonicModel(
      this.fundamentalFrequency,
      this.harmonics.map(h => ({ ...h }))
    );
  }

  toJSON() {
    return {
      fundamentalFrequency: this.fundamentalFrequency,
      harmonics: this.harmonics,
      timestamp: this.timestamp
    };
  }
}
