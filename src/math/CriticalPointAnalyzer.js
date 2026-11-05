/**
 * CriticalPointAnalyzer.js
 * Localización y clasificación de puntos críticos (máximos y mínimos) de las funciones y derivadas.
 * Preserva trazabilidad completa (x, y, tipo, orden de derivada, índice original).
 */

export class CriticalPointAnalyzer {
  /**
   * @param {DerivativeEngine} derivativeEngine
   */
  constructor(derivativeEngine) {
    this.derivativeEngine = derivativeEngine;
  }

  /**
   * Encuentra los puntos críticos para una derivada de orden k
   * @param {number} order - Orden de derivada (0 = f, 1 = f', etc.)
   * @param {number} numPoints - Resolución de muestreo (default: 1000, como en notebook)
   * @returns {{
   *   order: number,
   *   points: Array<{
   *     index: number,
   *     x: number,
   *     y: number,
   *     rawY: number,
   *     type: 'maximum'|'minimum',
   *     derivativeOrder: number
   *   }>,
   *   deltas: number[],
   *   curve: { x: Float64Array, y: Float64Array, normalizedY: Float64Array }
   * }}
   */
  analyzeOrder(order = 0, numPoints = 1000) {
    const { x, y, min, max } = this.derivativeEngine.evaluateRange(order, 0, 0.0045, numPoints);
    const normalizedY = this.derivativeEngine.normalizeArray(y, min, max);

    const points = [];

    // Localizar máximos y mínimos locales preservando orden cronológico en x
    for (let i = 1; i < numPoints - 1; i++) {
      const prev = normalizedY[i - 1];
      const curr = normalizedY[i];
      const next = normalizedY[i + 1];

      if (curr > prev && curr > next) {
        points.push({
          index: points.length,
          sampleIndex: i,
          x: x[i],
          y: curr, // normalizado [-1, 1]
          rawY: y[i],
          type: 'maximum',
          derivativeOrder: order
        });
      } else if (curr < prev && curr < next) {
        points.push({
          index: points.length,
          sampleIndex: i,
          x: x[i],
          y: curr, // normalizado [-1, 1]
          rawY: y[i],
          type: 'minimum',
          derivativeOrder: order
        });
      }
    }

    // Calcular deltas de x entre puntos consecutivos: dx_i = x_{i+1} - x_i
    const deltas = [];
    for (let i = 0; i < points.length - 1; i++) {
      deltas.push(points[i + 1].x - points[i].x);
    }
    // Para el último punto, delta aproximado cíclico en [0, 2pi]
    if (points.length > 0) {
      const lastDx = (2 * Math.PI - points[points.length - 1].x) + points[0].x;
      deltas.push(lastDx > 0 ? lastDx : 1.0);
    }

    return {
      order,
      points,
      deltas,
      curve: { x, y, normalizedY }
    };
  }

  /**
   * Analiza un conjunto de órdenes simultáneamente (ej. órdenes 0 a maxOrder)
   * @param {number} maxOrder
   * @returns {Map<number, ReturnType<typeof this.analyzeOrder>>}
   */
  analyzeOrdersUpTo(maxOrder = 4) {
    const results = new Map();
    for (let o = 0; o <= maxOrder; o++) {
      results.set(o, this.analyzeOrder(o));
    }
    return results;
  }
}
