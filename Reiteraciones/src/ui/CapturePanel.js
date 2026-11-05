/**
 * CapturePanel.js
 * Interfaz para la fase performativa inicial de afinación y captura espectral del violín.
 */

export class CapturePanel {
  /**
   * @param {HTMLElement} container
   * @param {AudioInput} audioInput
   * @param {AudioAnalyzer} audioAnalyzer
   * @param {(model: HarmonicModel) => void} onModelReady
   */
  constructor(container, audioInput, audioAnalyzer, onModelReady) {
    this.container = container;
    this.audioInput = audioInput;
    this.audioAnalyzer = audioAnalyzer;
    this.onModelReady = onModelReady;

    this.rafId = null;
    this.isAnalyzing = false;

    this._render();
    this._bindEvents();
  }

  _render() {
    this.container.innerHTML = `
      <div class="panel-section capture-box">
        <div class="panel-header">
          <h3>Fase 1: Afinación y Captura Espectral</h3>
          <span class="badge" id="capture-status-badge">Esperando entrada</span>
        </div>

        <div class="capture-controls">
          <button id="btn-mic-start" class="btn btn-primary">
            <span class="icon">🎙️</span> Usar Micrófono en Vivo
          </button>
          <button id="btn-sample-violin" class="btn btn-secondary">
            <span class="icon">🎻</span> Usar Muestra Violín LA (440 Hz)
          </button>
          <button id="btn-analyze" class="btn btn-action" disabled>
            <span class="icon">⚡</span> Capturar Timbre y Generar Obra
          </button>
        </div>

        <div class="tuner-display">
          <div class="tuner-meter">
            <div class="tuner-needle" id="tuner-needle"></div>
            <div class="tuner-center-mark">440 Hz (LA4)</div>
          </div>
          <div class="tuner-readout">
            <span class="readout-item">Frecuencia: <strong id="val-f0" class="num-fixed">-- Hz</strong></span>
            <span class="readout-item">Desviación: <strong id="val-cents" class="num-fixed">-- cents</strong></span>
            <span class="readout-item">Nivel RMS: <strong id="val-rms" class="num-fixed">-- dB</strong></span>
          </div>
        </div>

        <div class="harmonics-preview" id="harmonics-preview">
          <div class="harmonics-title">Armónicos detectados (A_n):</div>
          <div class="harmonics-bars">
            ${Array.from({ length: 10 }, (_, i) => `
              <div class="harmonic-bar-col">
                <div class="harmonic-bar-fill" style="height: 4px; opacity: 0.25;"></div>
                <span class="harmonic-label">n${i + 1}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    this.btnMic = this.container.querySelector('#btn-mic-start');
    this.btnSample = this.container.querySelector('#btn-sample-violin');
    this.btnAnalyze = this.container.querySelector('#btn-analyze');
    this.badge = this.container.querySelector('#capture-status-badge');
    this.valF0 = this.container.querySelector('#val-f0');
    this.valCents = this.container.querySelector('#val-cents');
    this.valRms = this.container.querySelector('#val-rms');
    this.needle = this.container.querySelector('#tuner-needle');
    this.harmonicsPreview = this.container.querySelector('#harmonics-preview');
  }

  _bindEvents() {
    this.btnMic.addEventListener('click', async () => {
      try {
        const sourceNode = await this.audioInput.startMicrophone();
        this.audioAnalyzer.connectSource(sourceNode);
        this._onAudioStarted("Micrófono Activo");
      } catch (err) {
        alert("No se pudo acceder al micrófono. Verifique los permisos en el navegador.");
      }
    });

    this.btnSample.addEventListener('click', () => {
      const sourceNode = this.audioInput.playViolinSample(8.0);
      this.audioAnalyzer.connectSource(sourceNode);
      this._onAudioStarted("Muestra Violín LA4 Activa");
    });

    document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !event.repeat && this.btnAnalyze.disabled == false) {
      // Evita que la barra espaciadora desplace la página.
      event.preventDefault();
      this._performSpectralAnalysis();
      this.btnAnalyze.disabled = true;
      }
    });

    this.btnAnalyze.addEventListener('click', () => {
      this._performSpectralAnalysis();
      this.btnAnalyze.disabled = true;
    });
  }

  _onAudioStarted(badgeText) {
    this.badge.textContent = badgeText;
    this.badge.className = "badge badge-active";
    this.btnAnalyze.disabled = false;
    this.isAnalyzing = true;
    this._startMeterLoop();
  }

  _startMeterLoop() {
    const loop = () => {
      if (!this.isAnalyzing) return;
      const frame = this.audioAnalyzer.getAnalysisFrame();

      // Nivel RMS
      const rmsDb = frame.rms > 0 ? (20 * Math.log10(frame.rms)).toFixed(1) : "-inf";
      this.valRms.textContent = `${rmsDb} dB`;

      if (frame.f0) {
        this.valF0.textContent = `${frame.f0.toFixed(1)} Hz`;
        // Calcular cents respecto a 440 Hz
        const cents = 1200 * Math.log2(frame.f0 / 440);
        const centsClamped = Math.max(-50, Math.min(50, cents));
        this.valCents.textContent = `${cents > 0 ? '+' : ''}${cents.toFixed(0)} cents`;
        // Posición aguja (-50 cents = 10%, 0 = 50%, +50 cents = 90%)
        const needlePos = 50 + (centsClamped / 50) * 40;
        this.needle.style.left = `${needlePos}%`;
        this.needle.style.background = Math.abs(cents) < 8 ? "#00e5a3" : "#ff4d6d";
      } else {
        this.valF0.textContent = "-- Hz";
        this.valCents.textContent = "--";
        this.needle.style.left = "50%";
        this.needle.style.background = "#888";
      }

      this.rafId = requestAnimationFrame(loop);
    };
    loop();
  }

  _performSpectralAnalysis() {
    this.badge.textContent = "Analizando Espectro...";
    this.badge.className = "badge badge-busy";

    setTimeout(() => {
      const model = this.audioAnalyzer.extractHarmonicModel(440, 12);
      this.badge.textContent = "Modelo Armónico Listo";
      this.badge.className = "badge badge-success";

      // Renderizar mini gráfico de armónicos
      this._renderHarmonicsList(model);

      if (this.onModelReady) {
        this.onModelReady(model);
      }
    }, 3000);
  }

  _renderHarmonicsList(model) {
    this.harmonicsPreview.innerHTML = `
      <div class="harmonics-title">Armónicos detectados (A_n):</div>
      <div class="harmonics-bars">
        ${model.harmonics.map(h => `
          <div class="harmonic-bar-col" title="n=${h.index}: ${h.frequency.toFixed(0)}Hz (${(h.amplitude*100).toFixed(0)}%)">
            <div class="harmonic-bar-fill" style="height: ${Math.max(4, h.amplitude * 60)}px;"></div>
            <span class="harmonic-label">n${h.index}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
}
