/**
 * SymbolicFunction.js
 * Función continua del timbre f(t) construida a partir del modelo armónico.
 * f(t) = sum_{n=1}^N A_n * sin(n * t + phi_n)
 * donde t está en el dominio adimensional [0, 2*pi]
 */

export class SymbolicFunction {
  /**
   * @param {HarmonicModel} harmonicModel
   */
  constructor(harmonicModel) {
    this.harmonicModel = harmonicModel;
  }

  /**
   * Evalúa f(t) en un punto t (radianes)
   * @param {number} t
   * @returns {number}
   */
  evaluate(t) {
    let sum = 0;
    const harmonics = this.harmonicModel.harmonics;
    for (let i = 0; i < harmonics.length; i++) {
      const h = harmonics[i];
      const n = h.index || (i + 1);
      sum += h.amplitude * Math.sin(n * t + h.phase);
    }
    return sum;
  }

  /**
   * Genera una malla discreta de puntos en [tMin, tMax]
   * @param {number} tMin
   * @param {number} tMax
   * @param {number} numPoints
   * @returns {{x: Float64Array, y: Float64Array}}
   */
  evaluateRange(tMin = 0, tMax = 2 * Math.PI, numPoints = 1000) {
    const x = new Float64Array(numPoints);
    const y = new Float64Array(numPoints);
    const step = (tMax - tMin) / (numPoints - 1);

    for (let i = 0; i < numPoints; i++) {
      const currentT = tMin + i * step;
      x[i] = currentT;
      y[i] = this.evaluate(currentT);
    }
    return { x, y };
  }

  /**
   * Retorna una representación en texto legible de la ecuación
   * @returns {string}
   */
  toEquationString() {
    if (!this.harmonicModel.harmonics.length) return "f(t) = 0";
    return "f(t) = " + this.harmonicModel.harmonics.map((h, i) => {
      const n = h.index || (i + 1);
      const amp = h.amplitude.toFixed(3);
      const phase = h.phase >= 0 ? `+ ${h.phase.toFixed(2)}` : `- ${Math.abs(h.phase).toFixed(2)}`;
      return `${amp}·sin(${n}t ${phase})`;
    }).join(" + ");
  }
}
