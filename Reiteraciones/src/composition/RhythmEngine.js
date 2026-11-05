/**
 * RhythmEngine.js
 * Mapeo y cuantización de diferencias espaciales dx = x_{i+1} - x_i a duraciones musicales discretas.
 * Integra compatibilidad con VexFlow y flexibilidad rítmica dependiente de MusicalState.
 */

export class RhythmEngine {
  /**
   * Mapeo de duración en negras (quarterLengths) a notación estándar de Vexflow
   */
  static DURATION_TO_VEX = [
    { ql: 4.0, vex: "w", dots: 0, name: "Redonda" },
    { ql: 3.0, vex: "h", dots: 1, name: "Blanca con puntillo" },
    { ql: 2.0, vex: "h", dots: 0, name: "Blanca" },
    { ql: 1.5, vex: "q", dots: 1, name: "Negra con puntillo" },
    { ql: 1.0, vex: "q", dots: 0, name: "Negra" },
    { ql: 0.75, vex: "8", dots: 1, name: "Corchea con puntillo" },
    { ql: 0.5, vex: "8", dots: 0, name: "Corchea" },
    { ql: 0.25, vex: "16", dots: 0, name: "Semicorchea" }
  ];

  /**
   * Cuantiza una lista de deltas dx a duraciones musicales según la configuración de estado
   * @param {number[]} deltas - Arreglo de diferencias x_{i+1} - x_i
   * @param {Object} rhythmQuantization - Configuración de MusicalState
   * @param {number} scaleFactor - Factor de velocidad (default: 2.0, como en notebook)
   * @returns {Array<{duration: number, quarterLength: number, vexDuration: string, dots: number}>}
   */
  static quantizeDeltas(deltas, rhythmQuantization, scaleFactor = 2.0) {
    const allowed = (rhythmQuantization && rhythmQuantization.allowedDurations) || [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];
    const irregularity = (rhythmQuantization && rhythmQuantization.irregularity) || 0;

    return deltas.map((dx, index) => {
      // Escalamiento base del intervalo
      let rawVal = dx * scaleFactor;

      // Introducir irregularidad según el parámetro de Caos / Tensión
      if (irregularity > 0.05) {
        const jitter = (Math.sin(index * 3.7 + dx * 10) * 0.5) * irregularity;
        rawVal = Math.max(0.2, rawVal + jitter);
      }

      // Encontrar la duración permitida más cercana
      let closest = allowed[0];
      let minDiff = Math.abs(allowed[0] - rawVal);
      for (let i = 1; i < allowed.length; i++) {
        const diff = Math.abs(allowed[i] - rawVal);
        if (diff < minDiff) {
          minDiff = diff;
          closest = allowed[i];
        }
      }

      // Mapear a especificación de Vexflow
      const vexInfo = RhythmEngine.findVexflowSpec(closest);

      return {
        duration: closest,
        quarterLength: closest,
        vexDuration: vexInfo.vex,
        dots: vexInfo.dots,
        rawDx: dx
      };
    });
  }

  static findVexflowSpec(quarterLength) {
    let best = RhythmEngine.DURATION_TO_VEX[4]; // Default: negra
    let minDiff = Infinity;
    for (const item of RhythmEngine.DURATION_TO_VEX) {
      const diff = Math.abs(item.ql - quarterLength);
      if (diff < minDiff) {
        minDiff = diff;
        best = item;
      }
    }
    return best;
  }
}
