/**
 * MathVisualizer.js
 * Visualización en tiempo real sobre Canvas:
 * - Función periódica tímbrica f(t)
 * - Derivadas analíticas f^(k)(t)
 * - Puntos críticos (máximos y mínimos con trazabilidad)
 * - Aproximación de la serie de Taylor T_N(x; a)
 */

export class MathVisualizer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {SymbolicFunction} symbolicFunction
   * @param {DerivativeEngine} derivativeEngine
   * @param {TaylorEngine} taylorEngine
   * @param {CriticalPointAnalyzer} criticalPointAnalyzer
   */
  constructor(canvas, symbolicFunction, derivativeEngine, taylorEngine, criticalPointAnalyzer) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.symbolicFunction = symbolicFunction;
    this.derivativeEngine = derivativeEngine;
    this.taylorEngine = taylorEngine;
    this.criticalPointAnalyzer = criticalPointAnalyzer;

    this.activeDerivativeOrder = 1;
    this.activeTaylorOrder = 2;
    this.highlightedPoint = null; // { x, y, order, type }

    this._setupDPI();
  }

  _setupDPI() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = (rect.width || 800) * dpr;
    this.canvas.height = (rect.height || 260) * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width || 800;
    this.height = rect.height || 260;
  }

  setHighlightedPoint(point) {
    this.highlightedPoint = point;
    this.draw();
  }

  setOrders(derivativeOrder, taylorOrder) {
    this.activeDerivativeOrder = derivativeOrder;
    this.activeTaylorOrder = taylorOrder;
    this.draw();
  }

  draw() {
    if (!this.width) this._setupDPI();
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // Fondo técnico estilo partitura contemporánea
    ctx.fillStyle = "#12141a";
    ctx.fillRect(0, 0, w, h);

    // Malla de coordenadas
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    const gridCols = 8;
    const gridRows = 4;
    for (let c = 1; c < gridCols; c++) {
      const gx = (w / gridCols) * c;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let r = 1; r < gridRows; r++) {
      const gy = (h / gridRows) * r;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    // Eje horizontal central
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const xMin = 0;
    const xMax = 0.0045;
    const numPoints = 600;

    // 1. Dibujar f(t) base del violín (azul cian tenue)
    ctx.strokeStyle = "rgba(0, 180, 255, 0.45)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < numPoints; i++) {
      const t = xMin + (i / (numPoints - 1)) * (xMax - xMin);
      const val = this.derivativeEngine.evaluateDerivative(t, 0);
      // Mapear y [-2, 2] a canvas
      const px = (i / (numPoints - 1)) * w;
      const py = (h / 2) - (val * (h * 0.15));
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // 2. Dibujar Derivada Activa f^(k)(t) (verde/ámbar esmeralda)
    if (this.activeDerivativeOrder > 0) {
      const dOrder = this.activeDerivativeOrder;
      const analysis = this.criticalPointAnalyzer.analyzeOrder(dOrder, numPoints);
      const curve = analysis.curve;

      ctx.strokeStyle = "#00e5a3";
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      for (let i = 0; i < numPoints; i++) {
        const px = (i / (numPoints - 1)) * w;
        const py = (h / 2) - (curve.normalizedY[i] * (h * 0.38));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Puntos críticos sobre la derivada
      analysis.points.forEach((pt) => {
        const px = (pt.x / (0.0045)) * w;
        const py = (h / 2) - (pt.y * (h * 0.38));

        ctx.fillStyle = pt.type === 'maximum' ? '#ff4d6d' : '#4cc9f0';
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // 3. Dibujar Aproximación de Taylor T_N(x; a) (dorado / magenta)
    if (this.activeTaylorOrder > 0) {
      ctx.strokeStyle = "#f72585";
      ctx.lineWidth = 2.0;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();

      const aCenter = 0.00225; // Expansión alrededor del centro del periodo
      let started = false;
      for (let i = 0; i < numPoints; i++) {
        const t = xMin + (i / (numPoints - 1)) * (xMax - xMin);
        const tVal = this.taylorEngine.evaluate(t, this.activeTaylorOrder, aCenter);
        const px = (i / (numPoints - 1)) * w;
        const py = (h / 2) - (tVal * (h * 0.15));

        if (py >= -50 && py <= h + 50) {
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 4. Resaltar punto crítico seleccionado si existe (trazabilidad interactiva)
    if (this.highlightedPoint) {
      const pt = this.highlightedPoint;
      const px = (pt.x / (0.0045)) * w;
      const py = (h / 2) - (pt.y * (h * 0.38));

      ctx.save();
      ctx.strokeStyle = "#ffe600";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = "#ffe600";
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.fillText(`Pt (${pt.type}) f^(${pt.derivativeOrder})`, Math.min(w - 120, px + 12), py - 10);
      ctx.restore();
    }

    // Leyenda técnica
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(0, 180, 255, 0.8)";
    ctx.fillText("— f(t) Timbre", 14, 20);

    ctx.fillStyle = "#00e5a3";
    ctx.fillText(`— f^(${this.activeDerivativeOrder})(t) Derivada`, 110, 20);

    ctx.fillStyle = "#f72585";
    ctx.fillText(`··· T_${this.activeTaylorOrder}(t) Taylor`, 240, 20);
  }
}
