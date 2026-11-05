/**
 * DerivativeEngine.js
 * Cálculo analítico exacto de derivadas de cualquier orden para f(t) = sum A_n * sin(n*t + phi_n).
 * d^k/dt^k [ sin(n*t + phi) ] = n^k * sin(n*t + phi + k * pi / 2)
 */

export class DerivativeEngine {
  /**
   * @param {HarmonicModel} harmonicModel
   */
  constructor(harmonicModel) {
    this.harmonicModel = harmonicModel;
  }

  /**
   * Evalúa la derivada de orden k en un punto t
   * @param {number} t
   * @param {number} order k >= 0 (0 = f(t), 1 = f'(t), etc.)
   * @returns {number}
   */
  evaluateDerivative(t, order = 1) {
    if (!Number.isInteger(order) || order < 0) {
      throw new Error("El orden debe ser un entero no negativo");
    }

    let sum = 0;
    const harmonics = this.harmonicModel.harmonics;

    for (let i = 0; i < harmonics.length; i++) {
      const h = harmonics[i];
      const frequency = h.frequency;
      const omega = 2 * Math.PI * frequency;

      const factor = Math.pow(omega, order);
      const phaseShift = (order * Math.PI) / 2;

      sum += h.amplitude * factor *
        Math.sin(omega * t + h.phase + phaseShift);
    }

    return sum;
  }

  /**
   * Evalúa un rango de puntos [tMin, tMax] para la derivada de orden k
   * @param {number} order
   * @param {number} tMin
   * @param {number} tMax
   * @param {number} numPoints
   * @returns {{x: Float64Array, y: Float64Array, min: number, max: number}}
   */
  evaluateRange(order = 1, tMin = 0, tMax = 2 * Math.PI, numPoints = 1000) {
    const x = new Float64Array(numPoints);
    const y = new Float64Array(numPoints);
    const step = (tMax - tMin) / (numPoints - 1);

    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < numPoints; i++) {
      const currentT = tMin + i * step;
      x[i] = currentT;
      const val = this.evaluateDerivative(currentT, order);
      y[i] = val;
      if (val < min) min = val;
      if (val > max) max = val;
    }

    return { x, y, min, max };
  }

  /**
   * Obtiene la función normalizada entre -1 y 1 (como en el notebook original)
   * @param {Float64Array} y
   * @param {number} min
   * @param {number} max
   * @returns {Float64Array}
   */
  normalizeArray(y, min, max) {
    const range = max - min || 1e-6;
    const normalized = new Float64Array(y.length);
    for (let i = 0; i < y.length; i++) {
      normalized[i] = (2 * (y[i] - min) / range) - 1;
    }
    return normalized;
  }
}
