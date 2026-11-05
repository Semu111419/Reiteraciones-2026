/**
 * OscilloscopePopout.js
 * Ventana emergente (Pop-out Window) con osciloscopio tímbrico multicanal sincronizado en fase y periodo.
 * Muestra superpuestas las ondas del micrófono y de cada voz del sintetizador por separado,
 * revelando la huella tímbrica y amplitud sin desplazamientos horizontales debidos a cambios de tono.
 */

export class OscilloscopePopout {
  /**
   * @param {AudioEngine} audioEngine
   * @param {SynthEngine} synthEngine
   * @param {AudioAnalyzer} audioAnalyzer
   */
  constructor(audioEngine, synthEngine, audioAnalyzer = null) {
    this.audioEngine = audioEngine;
    this.synthEngine = synthEngine;
    this.audioAnalyzer = audioAnalyzer;

    this.popupWindow = null;
    this.canvas = null;
    this.ctx2d = null;
    this.animId = null;

    // Configuración de canales (Violín + 5 órdenes de Taylor)
    this.channels = [
      { id: 'mic', label: 'Violín (Mic / Muestra)', color: '#4aaf0f', enabled: true, order: 0 },
      { id: 'taylor_1', label: 'Taylor T1 (Fundamental)', color: '#0284c7', enabled: true, order: 1 },
      { id: 'taylor_2', label: 'Taylor T2', color: '#06b6d4', enabled: true, order: 2 },
      { id: 'taylor_4', label: 'Taylor T4', color: '#f59e0b', enabled: true, order: 4 },
      { id: 'taylor_8', label: 'Taylor T8', color: '#f97316', enabled: true, order: 8 },
      { id: 'taylor_16', label: 'Taylor T16 (Armónicos)', color: '#a855f7', enabled: true, order: 16 }
    ];

    // Buffers reutilizables
    this.bufferSize = 2048;
    this.tempBuffers = new Map();
    this.channels.forEach(ch => {
      this.tempBuffers.set(ch.id, new Float32Array(this.bufferSize));
    });

    this.scaleY = 3.5;
    this.cyclesToShow = 1.5; // Factor de periodo / ciclos a mostrar
    this.micGainCompensation = 0.22; // Atenuación de calibración para nivelar el micrófono con los synthes

    // Estado persistente de sincronización por canal (fase, periodo y suavizado)
    this.channelStates = new Map();
    this.channels.forEach(ch => {
      this.channelStates.set(ch.id, {
        id: ch.id,
        phase: 0,            // Posición de fase/anclaje (muestras)
        period: 100,         // Periodo en muestras
        smoothedPeriod: 100, // Periodo suavizado exponencialmente
        smoothedPhase: 0,    // Fase suavizada exponencialmente
        rms: 0,
        active: false
      });
    });
  }

  setAudioAnalyzer(analyzer) {
    this.audioAnalyzer = analyzer;
  }

  /**
   * Abre la ventana flotante pop-out o la enfoca si ya está abierta
   */
  open() {
    if (this.popupWindow && !this.popupWindow.closed) {
      this.popupWindow.focus();
      return;
    }

    const width = 880;
    const height = 540;
    const left = Math.max(50, (window.screen.availWidth - width) / 2);
    const top = Math.max(50, (window.screen.availHeight - height) / 2);

    const winFeatures = `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no`;
    this.popupWindow = window.open('', 'ReiteracionesOscilloscope', winFeatures);

    if (!this.popupWindow) {
      alert("La ventana emergente fue bloqueada por el navegador. Por favor permita las ventanas emergentes para este sitio.");
      return;
    }

    this._setupWindowContent();
    this._startRenderLoop();

    this.popupWindow.addEventListener('beforeunload', () => {
      this._stopRenderLoop();
      this.popupWindow = null;
    });
  }

  _setupWindowContent() {
    const doc = this.popupWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Osciloscopio Tímbrico Multicanal — Reiteraciones</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background: #090d16;
            color: #f1f5f9;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
            user-select: none;
          }
          header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 18px;
            background: #0f172a;
            border-bottom: 1px solid #1e293b;
          }
          .title-area h2 {
            font-size: 14px;
            letter-spacing: 0.8px;
            text-transform: uppercase;
            font-weight: 700;
            color: #38bdf8;
          }
          .title-area p {
            font-size: 11px;
            color: #94a3b8;
            margin-top: 2px;
          }
          .controls-area {
            display: flex;
            align-items: center;
            gap: 14px;
            font-size: 11px;
          }
          .gain-control {
            display: flex;
            align-items: center;
            gap: 5px;
            color: #cbd5e1;
          }
          .gain-control label {
            white-space: nowrap;
          }
          .gain-control input[type="range"] {
            width: 75px;
            cursor: pointer;
          }
          .btn-action {
            background: #1e293b;
            color: #f8fafc;
            border: 1px solid #334155;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .btn-action:hover {
            background: #334155;
            border-color: #475569;
          }
          .scope-stage {
            flex: 1;
            position: relative;
            background: radial-gradient(circle at center, #0f172a 0%, #060911 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }
          canvas {
            display: block;
            width: 100%;
            height: 100%;
          }
          .legend-bar {
            display: flex;
            flex-wrap: wrap;
            gap: 8px 14px;
            padding: 8px 18px;
            background: #0b1120;
            border-top: 1px solid #1e293b;
            font-size: 11px;
            align-items: center;
          }
          .channel-pill {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            border-radius: 4px;
            background: rgba(30, 41, 59, 0.6);
            border: 1px solid #1e293b;
            cursor: pointer;
            transition: opacity 0.15s ease, border-color 0.15s ease;
          }
          .channel-pill.disabled {
            opacity: 0.35;
            border-color: transparent;
          }
          .color-dot {
            width: 9px;
            height: 9px;
            border-radius: 50%;
            display: inline-block;
            box-shadow: 0 0 8px currentColor;
          }
          .scope-info-overlay {
            position: absolute;
            top: 12px;
            right: 14px;
            font-family: monospace;
            font-size: 11px;
            color: #64748b;
            pointer-events: none;
            background: rgba(15, 23, 42, 0.7);
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid rgba(51, 65, 85, 0.4);
          }
        </style>
      </head>
      <body>
        <header>
          <div class="title-area">
            <h2>Osciloscopio Tímbrico Multicanal</h2>
            <p>Sincronización por fase y periodo · Amplitud pura sin variación horizontal</p>
          </div>
          <div class="controls-area">
            <div class="gain-control">
              <label for="gain-slider">Sensibilidad:</label>
              <input type="range" id="gain-slider" min="0.5" max="6.0" step="0.1" value="3.5">
              <span id="gain-label">3.5x</span>
            </div>
            <div class="gain-control">
              <label for="mic-gain-slider">Comp. Mic:</label>
              <input type="range" id="mic-gain-slider" min="0.05" max="1.50" step="0.01" value="0.22">
              <span id="mic-gain-label">0.22x</span>
            </div>
            <div class="gain-control">
              <label for="period-slider">Periodo (Ciclos):</label>
              <input type="range" id="period-slider" min="0.5" max="5.0" step="0.1" value="1.5">
              <span id="period-label">1.5c</span>
            </div>
            <button id="btn-toggle-all" class="btn-action">Ocultar Todo</button>
          </div>
        </header>

        <main class="scope-stage">
          <canvas id="scope-canvas"></canvas>
          <div class="scope-info-overlay" id="scope-info">Normalización de Fase: Activa</div>
        </main>

        <footer class="legend-bar" id="channels-legend">
          <!-- Canales inyectados dinámicamente -->
        </footer>
      </body>
      </html>
    `);
    doc.close();

    this.canvas = doc.getElementById('scope-canvas');
    this.ctx2d = this.canvas.getContext('2d');

    // Manejar redimensionamiento
    const resizeCanvas = () => {
      if (!this.canvas) return;
      const dpr = this.popupWindow.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx2d.scale(dpr, dpr);
      this.canvasCssWidth = rect.width;
      this.canvasCssHeight = rect.height;
    };
    this.popupWindow.addEventListener('resize', resizeCanvas);
    setTimeout(resizeCanvas, 50);

    // Controles de sensibilidad
    const gainSlider = doc.getElementById('gain-slider');
    const gainLabel = doc.getElementById('gain-label');
    gainSlider.addEventListener('input', (e) => {
      this.scaleY = parseFloat(e.target.value);
      gainLabel.textContent = `${this.scaleY.toFixed(1)}x`;
    });

    // Control de compensación del micrófono
    const micGainSlider = doc.getElementById('mic-gain-slider');
    const micGainLabel = doc.getElementById('mic-gain-label');
    micGainSlider.addEventListener('input', (e) => {
      this.micGainCompensation = parseFloat(e.target.value);
      micGainLabel.textContent = `${this.micGainCompensation.toFixed(2)}x`;
    });

    // Control de escala de periodo (ciclos mostrados)
    const periodSlider = doc.getElementById('period-slider');
    const periodLabel = doc.getElementById('period-label');
    periodSlider.addEventListener('input', (e) => {
      this.cyclesToShow = parseFloat(e.target.value);
      periodLabel.textContent = `${this.cyclesToShow.toFixed(1)}c`;
    });

    // Toggle all
    const btnToggleAll = doc.getElementById('btn-toggle-all');
    let allOn = true;
    btnToggleAll.addEventListener('click', () => {
      allOn = !allOn;
      btnToggleAll.textContent = allOn ? "Ocultar Todo" : "Mostrar Todo";
      this.channels.forEach(ch => {
        ch.enabled = allOn;
        const pill = doc.getElementById(`pill-${ch.id}`);
        if (pill) pill.classList.toggle('disabled', !allOn);
      });
    });

    // Construir barra de canales
    const legend = doc.getElementById('channels-legend');
    legend.innerHTML = '';
    this.channels.forEach(ch => {
      const pill = doc.createElement('div');
      pill.className = `channel-pill ${ch.enabled ? '' : 'disabled'}`;
      pill.id = `pill-${ch.id}`;
      pill.innerHTML = `
        <span class="color-dot" style="background-color: ${ch.color}; color: ${ch.color};"></span>
        <span>${ch.label}</span>
      `;
      pill.addEventListener('click', () => {
        ch.enabled = !ch.enabled;
        pill.classList.toggle('disabled', !ch.enabled);
      });
      legend.appendChild(pill);
    });
  }

  _startRenderLoop() {
    this._stopRenderLoop();
    const render = () => {
      if (!this.popupWindow || this.popupWindow.closed) return;
      this._drawFrame();
      this.animId = this.popupWindow.requestAnimationFrame(render);
    };
    this.animId = this.popupWindow.requestAnimationFrame(render);
  }

  _stopRenderLoop() {
    if (this.animId && this.popupWindow) {
      try {
        this.popupWindow.cancelAnimationFrame(this.animId);
      } catch (e) {}
      this.animId = null;
    }
  }

  /**
   * Obtiene el nodo AnalyserNode correspondiente a un canal
   */
  _getChannelAnalyser(channelId) {
    if (channelId === 'mic') {
      if (this.audioAnalyzer && this.audioAnalyzer.analyser) {
        return this.audioAnalyzer.analyser;
      }
      return null;
    }

    // Taylor voices (ordenes 1, 2, 4, 8, 16)
    if (this.synthEngine && this.synthEngine.voicesByOrder) {
      const order = parseInt(channelId.replace('taylor_', ''), 10);
      const voice = this.synthEngine.voicesByOrder.get(order);
      if (voice && voice.analyser) {
        return voice.analyser;
      }
    }

    return null;
  }

  /**
   * Obtiene la frecuencia fundamental conocida de un canal, si está disponible
   */
  _getKnownFrequency(channelId) {
    if (channelId === 'mic') {
      if (this.audioAnalyzer && typeof this.audioAnalyzer.getAnalysisFrame === 'function') {
        const frame = this.audioAnalyzer.getAnalysisFrame();
        if (frame && frame.f0 && frame.f0 > 50 && frame.f0 < 3000) {
          return frame.f0;
        }
      }
      return null;
    }

    if (this.synthEngine && this.synthEngine.voicesByOrder) {
      const order = parseInt(channelId.replace('taylor_', ''), 10);
      const voice = this.synthEngine.voicesByOrder.get(order);
      if (voice && voice.currentFreq && voice.currentFreq > 20) {
        return voice.currentFreq;
      }
    }

    return null;
  }

  /**
   * Encuentra el anclaje de fase con histéresis y continuidad temporal persistente
   * @param {Float32Array} buffer
   * @param {Object} state - Estado persistente del canal
   * @param {number} period - Periodo actual en muestras
   * @returns {number} índice continuo de anclaje de fase
   */
  _findStablePhaseAnchor(buffer, state, period) {
    const len = buffer.length;
    let sumSq = 0;
    for (let i = 0; i < len; i++) sumSq += buffer[i] * buffer[i];
    const rms = Math.sqrt(sumSq / len);

    // Si es silencio o muy débil, conservar fase previa
    if (rms < 0.003) {
      state.active = false;
      return state.smoothedPhase;
    }
    state.active = true;

    // Umbral de histéresis proporcional al RMS
    const hysteresis = Math.max(0.002, Math.min(0.04, rms * 0.15));
    const effectivePeriod = Math.max(16, period || 100);

    // Estrategia 1: Ventana de búsqueda alrededor de la fase previa proyectada
    const searchCenter = Math.round(state.smoothedPhase);
    const searchRadius = Math.round(effectivePeriod * 0.35);
    const windowStart = Math.max(1, searchCenter - searchRadius);
    const windowEnd = Math.min(Math.floor(len / 2), searchCenter + searchRadius);

    let bestCrossing = -1;
    let bestSlope = -1;

    // Buscar cruce ascendente limpio con histéresis en la ventana esperada
    for (let i = windowStart; i < windowEnd; i++) {
      if (buffer[i - 1] <= -hysteresis && buffer[i] >= hysteresis) {
        const slope = buffer[i] - buffer[i - 1];
        if (slope > bestSlope) {
          bestSlope = slope;
          bestCrossing = i;
        }
      }
    }

    // Estrategia 2: Si no hubo cruce con histéresis estricta cerca de la ventana esperada,
    // buscar el cruce principal de mayor pendiente dentro del primer ciclo
    if (bestCrossing < 0) {
      const scanLimit = Math.min(Math.floor(len / 2), Math.round(effectivePeriod * 1.5));
      for (let i = 1; i < scanLimit; i++) {
        if (buffer[i - 1] <= 0 && buffer[i] > 0) {
          const slope = buffer[i] - buffer[i - 1];
          if (slope > bestSlope) {
            bestSlope = slope;
            bestCrossing = i;
          }
        }
      }
    }

    if (bestCrossing >= 0) {
      // Ajuste sub-muestra por interpolación lineal para máxima estabilidad
      const y0 = buffer[bestCrossing - 1];
      const y1 = buffer[bestCrossing];
      const fractionalOffset = (y1 - y0 !== 0) ? -y0 / (y1 - y0) : 0;
      const accuratePhase = (bestCrossing - 1) + Math.max(0, Math.min(1, fractionalOffset));

      // Suavizado exponencial del anclaje de fase (β ≈ 0.22)
      state.smoothedPhase = (state.smoothedPhase * 0.78) + (accuratePhase * 0.22);
      state.phase = accuratePhase;
      return state.smoothedPhase;
    }

    return state.smoothedPhase;
  }

  /**
   * Estima la longitud del periodo fundamental T en muestras usando YIN / autocorrelación mejorada
   * evitando múltiplos o submúltiplos mediante penalización y detección de primer valle
   */
  _estimatePeriodLength(buffer, sampleRate = 44100) {
    const len = buffer.length;
    const minPeriod = Math.max(14, Math.floor(sampleRate / 2400)); // ~2400 Hz
    const maxPeriod = Math.min(Math.floor(len / 3), Math.floor(sampleRate / 60)); // ~60 Hz

    if (maxPeriod <= minPeriod) return 100;

    // Diferencia cuadrática acumulada (YIN base d_t)
    const d = new Float32Array(maxPeriod + 1);
    for (let tau = minPeriod; tau <= maxPeriod; tau++) {
      let sum = 0;
      const step = 2; // Reducción de carga computacional
      const span = maxPeriod;
      for (let i = 0; i < span; i += step) {
        const diff = buffer[i] - buffer[i + tau];
        sum += diff * diff;
      }
      d[tau] = sum;
    }

    // Normalización de media acumulada (CMNDF de YIN)
    const cmndf = new Float32Array(maxPeriod + 1);
    cmndf[minPeriod] = 1;
    let runningSum = 0;

    for (let tau = minPeriod; tau <= maxPeriod; tau++) {
      runningSum += d[tau];
      cmndf[tau] = runningSum > 0 ? (d[tau] * (tau - minPeriod + 1)) / runningSum : 1;
    }

    // Encontrar el primer mínimo absoluto bajo un umbral de confianza (evita octavas falsas)
    const threshold = 0.20;
    let bestTau = -1;

    for (let tau = minPeriod + 1; tau < maxPeriod; tau++) {
      if (cmndf[tau] < threshold) {
        while (tau + 1 < maxPeriod && cmndf[tau + 1] < cmndf[tau]) {
          tau++;
        }
        bestTau = tau;
        break;
      }
    }

    // Fallback: mínimo global si ninguno estuvo bajo el umbral
    if (bestTau < 0) {
      let minVal = 999999;
      for (let tau = minPeriod; tau <= maxPeriod; tau++) {
        if (cmndf[tau] < minVal) {
          minVal = cmndf[tau];
          bestTau = tau;
        }
      }
    }

    if (bestTau > 0 && bestTau < maxPeriod) {
      // Interpolación parabólica para precisión de muestra fraccionaria
      const s0 = cmndf[bestTau - 1];
      const s1 = cmndf[bestTau];
      const s2 = cmndf[bestTau + 1];
      const denom = (2 * s1 - s0 - s2);
      const delta = denom !== 0 ? (s2 - s0) / (2 * denom) : 0;
      return bestTau + Math.max(-0.5, Math.min(0.5, delta));
    }

    return bestTau > 0 ? bestTau : 100;
  }

  _drawFrame() {
    if (!this.canvas || !this.ctx2d) return;

    const w = this.canvasCssWidth || 800;
    const h = this.canvasCssHeight || 400;
    const ctx = this.ctx2d;
    const sampleRate = (this.audioEngine && this.audioEngine.ctx) ? this.audioEngine.ctx.sampleRate : 44100;

    // Limpiar fondo con efecto de persistencia sutil (glow)
    ctx.fillStyle = '#060911';
    ctx.fillRect(0, 0, w, h);

    // Dibujar rejilla de referencia reticular (Grid de osciloscopio)
    this._drawGrid(ctx, w, h);

    // Modo de composición para superposición aditiva y luminosa
    ctx.globalCompositeOperation = 'screen';

    // Determinar periodo maestro a partir del canal más activo como respaldo
    let fallbackPeriod = 100;

    for (const ch of this.channels) {
      if (!ch.enabled) continue;
      const analyser = this._getChannelAnalyser(ch.id);
      if (!analyser) continue;

      const buf = this.tempBuffers.get(ch.id);
      analyser.getFloatTimeDomainData(buf);

      const knownFreq = this._getKnownFrequency(ch.id);
      if (knownFreq && knownFreq > 20) {
        fallbackPeriod = sampleRate / knownFreq;
        break;
      }
    }

    // Dibujar cada canal habilitado superpuesto con su propio seguimiento de sincronización
    this.channels.forEach(ch => {
      if (!ch.enabled) return;
      const analyser = this._getChannelAnalyser(ch.id);
      if (!analyser) return;

      const buf = this.tempBuffers.get(ch.id);
      const isMic = (ch.id === 'mic');
      const state = this.channelStates.get(ch.id);

      this._renderWaveform(ctx, buf, w, h, ch.color, state, isMic, sampleRate, fallbackPeriod);
    });

    ctx.globalCompositeOperation = 'source-over';
  }

  _drawGrid(ctx, w, h) {
    ctx.strokeStyle = '#131e33';
    ctx.lineWidth = 1;

    // Retícula vertical (divisiones de fase)
    const vDivs = 10;
    for (let i = 1; i < vDivs; i++) {
      const x = (w / vDivs) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Retícula horizontal (niveles de amplitud)
    const hDivs = 8;
    for (let j = 1; j < hDivs; j++) {
      const y = (h / hDivs) * j;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Eje central de referencia cero
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }

  /**
   * Dibuja la curva de onda de un canal individual con remuestreo continuo,
   * interpolación sub-muestra y anclaje persistente
   */
  _renderWaveform(ctx, buffer, w, h, color, state, isMic = false, sampleRate = 44100, fallbackPeriod = 100) {
    if (!state) return;

    const centerY = h / 2;
    // Si es el micrófono, aplicamos la compensación para nivelar su escala a la de los synthes
    const gainFactor = isMic ? this.micGainCompensation : 1.0;
    const maxAmplitudeH = (h / 2) * 0.88 * this.scaleY * gainFactor;

    // 1. Obtener periodo fundamental: prioridad a frecuencia conocida
    let targetPeriod = null;
    const knownFreq = this._getKnownFrequency(state.id || (isMic ? 'mic' : ''));
    if (knownFreq && knownFreq > 20) {
      targetPeriod = sampleRate / knownFreq;
    } else {
      // Estimar periodo con detector YIN
      const detected = this._estimatePeriodLength(buffer, sampleRate);
      targetPeriod = (detected > 16) ? detected : fallbackPeriod;
    }

    // Suavizado exponencial del periodo (α ≈ 0.15 para fluidez sin saltos bruscos)
    if (targetPeriod && targetPeriod > 10) {
      state.period = targetPeriod;
      state.smoothedPeriod = (state.smoothedPeriod * 0.85) + (targetPeriod * 0.15);
    }
    const effectivePeriod = Math.max(16, state.smoothedPeriod);

    // 2. Anclaje de fase estable con histéresis y persistencia
    const phaseAnchor = this._findStablePhaseAnchor(buffer, state, effectivePeriod);

    // 3. Cantidad de muestras a abarcar en el ancho de pantalla
    const totalSamplesToSpan = effectivePeriod * this.cyclesToShow;
    if (totalSamplesToSpan <= 1) return;

    // 4. Renderizado con remuestreo continuo e interpolación lineal
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    const numPoints = Math.min(Math.round(w), 1024);
    const bufLen = buffer.length;
    let started = false;

    for (let p = 0; p <= numPoints; p++) {
      const frac = p / numPoints;
      const x = frac * w;

      // Posición continua en el buffer con base en la fase anclada
      const exactIndex = phaseAnchor + (frac * totalSamplesToSpan);
      if (exactIndex >= bufLen - 1) break;
      if (exactIndex < 0) continue;

      // Interpolación lineal entre muestras vecinas
      const idxFloor = Math.floor(exactIndex);
      const idxCeil = Math.min(bufLen - 1, idxFloor + 1);
      const t = exactIndex - idxFloor;
      const interpolatedSample = buffer[idxFloor] * (1 - t) + buffer[idxCeil] * t;

      const y = centerY - (interpolatedSample * maxAmplitudeH);

      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
    ctx.shadowBlur = 0; // Restaurar
  }
}
