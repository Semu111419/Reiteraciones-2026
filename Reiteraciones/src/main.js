/**
 * main.js
 * Orquestador y punto de entrada central de "Reiteraciones".
 * Conecta las 5 capas arquitectónicas: DSP, Matemáticas, Composición, Partitura y Síntesis.
 */

import { AudioEngine } from './audio/AudioEngine.js';
import { AudioInput } from './audio/AudioInput.js';
import { AudioAnalyzer } from './audio/AudioAnalyzer.js';

import { HarmonicModel } from './math/HarmonicModel.js';
import { SymbolicFunction } from './math/SymbolicFunction.js';
import { DerivativeEngine } from './math/DerivativeEngine.js';
import { CriticalPointAnalyzer } from './math/CriticalPointAnalyzer.js';
import { TaylorEngine } from './math/TaylorEngine.js';

import { MusicalStateStore } from './composition/MusicalStateStore.js';
import { SECTION_STATES } from './composition/CompositionStates.js';
import { CompositionEngine } from './composition/CompositionEngine.js';

import { ScoreModel } from './score/ScoreModel.js';
import { ScoreRenderer } from './score/ScoreRenderer.js';

import { SynthEngine } from './synthesis/SynthEngine.js';

import { PerformanceEngine } from './performance/PerformanceEngine.js';
import { SectionManager } from './performance/SectionManager.js';

import { MathVisualizer } from './ui/MathVisualizer.js';
import { CapturePanel } from './ui/CapturePanel.js';
import { StatePanel } from './ui/StatePanel.js';
import { OscilloscopePopout } from './ui/OscilloscopePopout.js';

class ReiteracionesApp {
  constructor() {
    this.audioEngine = new AudioEngine();
    this.audioInput = null;
    this.audioAnalyzer = null;

    // Modelo inicial de respaldo (LA4 violín)
    this.harmonicModel = HarmonicModel.createDefaultViolinA4();
    this.symbolicFunction = new SymbolicFunction(this.harmonicModel);
    this.derivativeEngine = new DerivativeEngine(this.harmonicModel);
    this.criticalPointAnalyzer = new CriticalPointAnalyzer(this.derivativeEngine);
    this.taylorEngine = new TaylorEngine(this.derivativeEngine);

    // Estado global de la obra (Inicia siempre en Afinación)
    this.stateStore = new MusicalStateStore(SECTION_STATES.tuning);
    this.compositionEngine = new CompositionEngine(this.criticalPointAnalyzer);

    this.scoreModel = null;
    this.scoreRenderer = null;
    this.synthEngine = null;
    this.performanceEngine = null;
    this.sectionManager = null;
    this.mathVisualizer = null;
    this.statePanel = null;
    this.oscilloscopePopout = null;
  }

  async init() {
    // Inicializar contenedores UI
    this._initScoreUI();
    this._initMathVisualizer();
    this._initCapturePanel();

    // Generar partitura inicial
    this._generateInitialScore();

    // Actualizar visualizaciones matemáticas
    this._updateMathView();

    // Controles de audio maestro
    const masterVolSlider = document.getElementById('slider-master-vol');
    if (masterVolSlider) {
      masterVolSlider.addEventListener('input', (e) => {
        if (this.audioEngine.isInitialized) {
          this.audioEngine.setMasterVolume(parseFloat(e.target.value));
        }
      });
    }

    const reverbMixSlider = document.getElementById('slider-reverb-mix');
    if (reverbMixSlider) {
      reverbMixSlider.addEventListener('input', (e) => {
        if (this.audioEngine.isInitialized) {
          this.audioEngine.setReverbMix(parseFloat(e.target.value));
        }
      });
    }

    // Suscripción de MathVisualizer a cambios de derivadas o Taylor
    this.stateStore.subscribe((state) => {
      if (this.mathVisualizer) {
        this.mathVisualizer.setOrders(state.derivativeOrder || 1, state.taylorOrder || 1);
      }
    });

    // Botón para ventana flotante pop-out de osciloscopio tímbrico
    const btnOpenScope = document.getElementById('btn-open-scope');
    if (btnOpenScope) {
      btnOpenScope.addEventListener('click', async () => {
        await this._ensureAudio();
        if (!this.oscilloscopePopout) {
          this.oscilloscopePopout = new OscilloscopePopout(
            this.audioEngine,
            this.synthEngine,
            this.audioAnalyzer
          );
        } else {
          this.oscilloscopePopout.setAudioAnalyzer(this.audioAnalyzer);
        }
        this.oscilloscopePopout.open();
      });
    }

    console.log("Reiteraciones App initialized successfully.");
  }

  async _ensureAudio() {
    if (!this.audioEngine.isInitialized) {
      await this.audioEngine.init();
      this._initAudioComponents();
    }
  }

  _initCapturePanel() {
    const captureContainer = document.getElementById('capture-panel-container');
    if (!captureContainer) return;

    // Crear dummy audioInput/analyzer iniciales o proxies
    const proxyInput = {
      startMicrophone: async () => {
        await this._ensureAudio();
        return await this.audioInput.startMicrophone();
      },
      playViolinSample: (dur) => {
        this._ensureAudio().then(() => {
          const src = this.audioInput.playViolinSample(dur);
          this.audioAnalyzer.connectSource(src);
        });
        return null;
      }
    };

    const proxyAnalyzer = {
      connectSource: (src) => {
        if (src && this.audioAnalyzer) this.audioAnalyzer.connectSource(src);
      },
      getAnalysisFrame: () => {
        if (this.audioAnalyzer) return this.audioAnalyzer.getAnalysisFrame();
        return { timeData: new Float32Array(512), freqData: new Float32Array(256), f0: null, rms: 0 };
      },
      extractHarmonicModel: (f0, n) => {
        if (this.audioAnalyzer) return this.audioAnalyzer.extractHarmonicModel(f0, n);
        return this.harmonicModel;
      }
    };

    new CapturePanel(
      captureContainer,
      proxyInput,
      proxyAnalyzer,
      (newModel) => this._onNewHarmonicModel(newModel)
    );
  }

  _initAudioComponents() {
    this.audioInput = new AudioInput(this.audioEngine.ctx);
    this.audioAnalyzer = new AudioAnalyzer(this.audioEngine.ctx);

    this.synthEngine = new SynthEngine(this.audioEngine, this.taylorEngine, this.stateStore);
    this.synthEngine.startAmbientDrone();

    if (this.performanceEngine) {
      this.performanceEngine.synthEngine = this.synthEngine;
    }
    if (this.sectionManager) {
      this.sectionManager.synthEngine = this.synthEngine;
    }

    if (this.oscilloscopePopout) {
      this.oscilloscopePopout.synthEngine = this.synthEngine;
      this.oscilloscopePopout.setAudioAnalyzer(this.audioAnalyzer);
    }
  }

  _initScoreUI() {
    const scoreContainer = document.getElementById('score-sheet-container');
    const infoContainer = document.getElementById('traceability-info');

    this.scoreRenderer = new ScoreRenderer(scoreContainer, {
      onNoteClick: (event) => {
        // Trazabilidad interactiva
        if (this.mathVisualizer) {
          this.mathVisualizer.setHighlightedPoint({
            x: event.source.x,
            y: event.source.y,
            type: event.source.type,
            derivativeOrder: event.source.derivativeOrder
          });
        }
        if (infoContainer) {
          infoContainer.innerHTML = `
            <div class="trace-pill"><strong>Nota:</strong> ${event.pitch.noteName} (MIDI ${event.pitch.midi})</div>
            <div class="trace-pill"><strong>Derivada origen:</strong> f^(${event.source.derivativeOrder})</div>
            <div class="trace-pill"><strong>Punto crítico:</strong> ${event.source.type === 'maximum' ? 'Máximo' : 'Mínimo'} (x: ${event.source.x.toFixed(2)}, y: ${event.source.y.toFixed(2)})</div>
            <div class="trace-pill"><strong>Duración:</strong> ${event.rhythm.quarterLength}♩</div>
            <div class="trace-pill"><strong>Dinámica:</strong> ${event.dynamic}</div>
            <div class="trace-pill"><strong>Articulación:</strong> ${event.articulation}</div>
          `;
        }
      }
    });

    this.performanceEngine = new PerformanceEngine(
      this.scoreModel,
      this.scoreRenderer,
      this.synthEngine,
      () => {
        // Al completar sección, sugerir avance
        if (this.sectionManager) this.sectionManager.nextSection();
      }
    );

    this.sectionManager = new SectionManager(
      this.stateStore,
      this.compositionEngine,
      this.performanceEngine,
      this.synthEngine
    );

    const stateContainer = document.getElementById('state-panel-container');
    if (stateContainer) {
      this.statePanel = new StatePanel(stateContainer, this.stateStore, this.sectionManager, this.performanceEngine);
    }
  }

  _initMathVisualizer() {
    const canvas = document.getElementById('math-canvas');
    if (canvas) {
      this.mathVisualizer = new MathVisualizer(
        canvas,
        this.symbolicFunction,
        this.derivativeEngine,
        this.taylorEngine,
        this.criticalPointAnalyzer
      );
      this.mathVisualizer.draw();
    }
  }

  _generateInitialScore() {
    const state = this.stateStore.getState();
    const generated = this.compositionEngine.generateScoreForState(state);
    this.scoreModel = new ScoreModel(generated.phrases, state.section);
    this.scoreRenderer.render(this.scoreModel, 0);
    this.performanceEngine.scoreModel = this.scoreModel;
  }

  _onNewHarmonicModel(model) {
    console.log("[Capture] Modelo recibido:", model);
    console.log("[Capture] Armónicos recibidos:", model?.harmonics);
    console.log("[Capture] ¿Es el modelo predeterminado?",
        model === this.harmonicModel);
    this.harmonicModel = model;
    this.symbolicFunction = new SymbolicFunction(this.harmonicModel);
    this.derivativeEngine = new DerivativeEngine(this.harmonicModel);
    this.criticalPointAnalyzer = new CriticalPointAnalyzer(this.derivativeEngine);
    this.taylorEngine = new TaylorEngine(this.derivativeEngine);
    this.compositionEngine = new CompositionEngine(this.criticalPointAnalyzer);

    // Mantener SectionManager conectado al motor actualizado.
    if (this.sectionManager) {
        this.sectionManager.compositionEngine = this.compositionEngine;
    }

    if (this.synthEngine) {
      this.synthEngine.taylorEngine = this.taylorEngine;
      this.synthEngine.rebuildWavetables();
    }

    if (this.mathVisualizer) {
      this.mathVisualizer.symbolicFunction = this.symbolicFunction;
      this.mathVisualizer.derivativeEngine = this.derivativeEngine;
      this.mathVisualizer.taylorEngine = this.taylorEngine;
      this.mathVisualizer.criticalPointAnalyzer = this.criticalPointAnalyzer;
    }

    // Desbloquear navegación formal tras capturar el sonido del violín
    this.sectionManager.unlockNavigation();
    if (this.statePanel) {
      this.statePanel.unlockSections();
    }

    // Pasar automáticamente a sección 'birth' con la partitura generada
    this.sectionManager.goToSection('birth');
    this._updateMathView();
  }

  _updateMathView() {
    if (this.mathVisualizer) {
      const state = this.stateStore.getState();
      this.mathVisualizer.setOrders(state.derivativeOrder || 1, state.taylorOrder || 1);
    }
    const eqLabel = document.getElementById('equation-display');
    if (eqLabel && this.symbolicFunction) {
      eqLabel.textContent = this.symbolicFunction.toEquationString();
      console.log("Ecuación simbólica: "+eqLabel.textContent);
    }
  }
}

// Inicializar la aplicación al cargar la ventana
window.addEventListener('DOMContentLoaded', () => {
  const app = new ReiteracionesApp();
  app.init();
  window.reiteracionesApp = app; // Acceso para depuración si se desea
});
