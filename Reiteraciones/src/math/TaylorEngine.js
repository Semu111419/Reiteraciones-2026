/**
 * TaylorEngine.js
 * Cálculo de polinomios y series de Taylor para aproximar f(t):
 * T_N(x; a) = sum_{k=0}^N ( f^{(k)}(a) / k! ) * (x - a)^k
 */

export class TaylorEngine {
  /**
   * @param {DerivativeEngine} derivativeEngine
   */
  constructor(derivativeEngine) {
    this.derivativeEngine = derivativeEngine;
    this._factorialCache = [1, 1];
  }

  factorial(n) {
    if (n < 0) return 1;
    while (this._factorialCache.length <= n) {
      const len = this._factorialCache.length;
      this._factorialCache.push(this._factorialCache[len - 1] * len);
    }
    return this._factorialCache[n];
  }

  /**
   * Calcula los coeficientes de Taylor c_k = f^{(k)}(a) / k! para k = 0 ... N
   * @param {number} order N (ej. 1, 2, 4, 8, 16)
   * @param {number} a - Centro de expansión
   * @returns {Float64Array}
   */
  getCoefficients(order = 1, a = 0) {
    const coeffs = new Float64Array(order + 1);
    for (let k = 0; k <= order; k++) {
      const dVal = this.derivativeEngine.evaluateDerivative(a, k);
      coeffs[k] = dVal / this.factorial(k);
    }
    return coeffs;
  }

  /**
   * Evalúa T_N(x; a) en un punto x
   * @param {number} x
   * @param {number} order N
   * @param {number} a
   * @returns {number}
   */
  evaluate(x, order = 1, a = 0) {
    const coeffs = this.getCoefficients(order, a);
    let result = 0;
    const dx = x - a;
    let power = 1;
    for (let k = 0; k <= order; k++) {
      result += coeffs[k] * power;
      power *= dx;
    }
    return result;
  }

  /**
   * Evalúa un rango [xMin, xMax] para graficación y generación de wavetable
   * @param {number} order
   * @param {number} a
   * @param {number} xMin
   * @param {number} xMax
   * @param {number} numPoints
   * @returns {{x: Float64Array, y: Float64Array, error: Float64Array}}
   */
  evaluateRange(order = 1, a = 0, xMin = -Math.PI, xMax = Math.PI, numPoints = 1000) {
    const coeffs = this.getCoefficients(order, a);
    const x = new Float64Array(numPoints);
    const y = new Float64Array(numPoints);
    const error = new Float64Array(numPoints);
    const step = (xMax - xMin) / (numPoints - 1);

    for (let i = 0; i < numPoints; i++) {
      const currentX = xMin + i * step;
      x[i] = currentX;

      let val = 0;
      const dx = currentX - a;
      let power = 1;
      for (let k = 0; k <= order; k++) {
        val += coeffs[k] * power;
        power *= dx;
      }
      y[i] = val;

      // Error respecto a f(x)
      const trueF = this.derivativeEngine.evaluateDerivative(currentX, 0);
      error[i] = Math.abs(trueF - val);
    }

    return { x, y, error };
  }

  /**
   * Genera un buffer de onda de un ciclo normalizado para síntesis por tabla de ondas
   * @param {number} order
   * @param {number} a
   * @param {number} length
   * @returns {Float32Array}
   */
  generatePeriodicWavetable(order = 1, a = 0, length = 2048) {
    const table = new Float32Array(length);
    let maxAbs = 0;

    // Evaluamos en un periodo [0, 2pi]
    for (let i = 0; i < length; i++) {
      const phase = (i / length) * 2 * Math.PI;
      const v = this.evaluate(phase, order, a);
      table[i] = v;
      const absV = Math.abs(v);
      if (absV > maxAbs) maxAbs = absV;
    }

    // Normalizar a [-1, 1] y suavizar extremos si el polinomio diverge en los bordes
    const scale = maxAbs > 0 ? 0.95 / maxAbs : 1;
    for (let i = 0; i < length; i++) {
      // Ventana Tukey para prevenir clics por discontinuidad en los bordes del polinomio
      const edge = Math.min(i, length - 1 - i);
      const taper = edge < 64 ? Math.sin((edge / 64) * (Math.PI / 2)) : 1.0;
      table[i] = Math.max(-1, Math.min(1, table[i] * scale * taper));
    }

    return table;
  }
}
