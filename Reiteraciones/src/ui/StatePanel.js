/**
 * StatePanel.js
 * Visualizador y controlador formal del MusicalState y Performance.
 * Permite supervisar y modificar en vivo la macroforma y parámetros compositivos.
 */

import { SECTION_KEYS, SECTION_STATES } from '../composition/CompositionStates.js';

export class StatePanel {
  /**
   * @param {HTMLElement} container
   * @param {MusicalStateStore} stateStore
   * @param {SectionManager} sectionManager
   * @param {PerformanceEngine} performanceEngine
   */
  constructor(container, stateStore, sectionManager, performanceEngine) {
    this.container = container;
    this.stateStore = stateStore;
    this.sectionManager = sectionManager;
    this.performanceEngine = performanceEngine;
    this.hasCapturedAudio = false;

    this._render();
    this._bindEvents();

    this.stateStore.subscribe((state) => this._updateStateDisplay(state));
    this.performanceEngine.subscribe((pState) => this._updatePerformanceDisplay(pState));
  }

  unlockSections() {
    this.hasCapturedAudio = true;
    this.container.querySelectorAll('.section-tab').forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('section-locked');
      const secKey = btn.dataset.sec;
      btn.title = SECTION_STATES[secKey]?.character || '';
    });
  }

  _render() {
    this.container.innerHTML = `
      <div class="panel-section state-box">
        <div class="panel-header">
          <h3>Macroestructura Formal (3 Movimientos / 9 Secciones)</h3>
          <span class="badge" id="movement-badge">Movimiento I</span>
        </div>

        <!-- Barra de navegación formal -->
        <div class="sections-timeline" id="sections-timeline">
          ${SECTION_KEYS.map((key) => {
            const sec = SECTION_STATES[key];
            const isLocked = !this.hasCapturedAudio ;
            return `
              <button class="section-tab ${isLocked ? 'section-locked' : ''}" data-sec="${key}" title="${isLocked ? 'Requiere afinación previa' : sec.character}" ${isLocked ? 'disabled' : ''}>
                <span class="sec-num">${sec.sectionIndex}</span>
                <span class="sec-name">${sec.name}</span>
              </button>
            `;
          }).join('')}
        </div>

        <!-- Controles de Transporte e Interpretación -->
        <div class="performance-bar">
          <div class="perf-buttons">
            <button id="btn-play-toggle" class="btn btn-secondary btn-sm">▶ Auto Play</button>
          </div>
          <div class="tempo-control">
            <span class="tempo-title">Tempo:</span>
            <span class="tempo-display"><strong id="tempo-val">50</strong> BPM</span>
          </div>
          <div class="perf-status">
            <span>Frase: <strong id="val-phrase-idx">1</strong></span>
            <span>Nota: <strong id="val-event-idx">1</strong></span>
          </div>
        </div>

        <!-- Monitores de parámetros compositivos interpolables -->
        <div class="musical-state-grid">
          <div class="param-card">
            <span class="param-title">Densidad</span>
            <div class="param-bar-bg"><div class="param-bar-fill" id="bar-density"></div></div>
            <span class="param-val" id="text-density">0.25</span>
          </div>
          <div class="param-card">
            <span class="param-title">Complejidad</span>
            <div class="param-bar-bg"><div class="param-bar-fill" id="bar-complexity"></div></div>
            <span class="param-val" id="text-complexity">0.20</span>
          </div>
          <div class="param-card">
            <span class="param-title">Tensión</span>
            <div class="param-bar-bg"><div class="param-bar-fill" id="bar-tension"></div></div>
            <span class="param-val" id="text-tension">0.15</span>
          </div>
          <div class="param-card">
            <span class="param-title">Consonancia</span>
            <div class="param-bar-bg"><div class="param-bar-fill" id="bar-consonance"></div></div>
            <span class="param-val" id="text-consonance">0.90</span>
          </div>
          <div class="param-card">
            <span class="param-title">Derivadas (f^(k))</span>
            <span class="param-badge" id="text-derivative">f, f'</span>
          </div>
          <div class="param-card">
            <span class="param-title">Orden Taylor</span>
            <span class="param-badge" id="text-taylor">T_1</span>
          </div>
          <div class="param-card">
            <span class="param-title">Escala Activa</span>
            <span class="param-badge" id="text-scale">dorico_la</span>
          </div>
        </div>
      </div>
    `;

    this.movBadge = this.container.querySelector('#movement-badge');
    this.barDensity = this.container.querySelector('#bar-density');
    this.textDensity = this.container.querySelector('#text-density');
    this.barComplexity = this.container.querySelector('#bar-complexity');
    this.textComplexity = this.container.querySelector('#text-complexity');
    this.barTension = this.container.querySelector('#bar-tension');
    this.textTension = this.container.querySelector('#text-tension');
    this.barConsonance = this.container.querySelector('#bar-consonance');
    this.textConsonance = this.container.querySelector('#text-consonance');
    this.textDerivative = this.container.querySelector('#text-derivative');
    this.textTaylor = this.container.querySelector('#text-taylor');
    this.textScale = this.container.querySelector('#text-scale');

    this.valPhraseIdx = this.container.querySelector('#val-phrase-idx');
    this.valEventIdx = this.container.querySelector('#val-event-idx');
    this.btnPlayToggle = this.container.querySelector('#btn-play-toggle');
    this.tempoVal = this.container.querySelector('#tempo-val');
  }

  _bindEvents() {
    // Tabs de secciones
    this.btnPlayToggle.disabled=true;
    this.container.querySelectorAll('.section-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const secKey = btn.dataset.sec;
        if (!this.hasCapturedAudio && secKey !== 'tuning') {
          return;
        }
        this.sectionManager.goToSection(secKey);
      });
    });

    // Función compartida por el botón Play y la barra espaciadora
    const togglePlayback = () => {
      if (this.sectionManager.currentSectionIndex === 0) {
        this.btnPlayToggle.disabled=true;
        console.log("boton inhabilitado"+this.sectionManager.currentSectionIndex);
        return;
      }

      if (this.performanceEngine.state.isPlaying) {
        this.btnPlayToggle.disabled=false;
        console.log("pausa"+this.sectionManager.currentSectionIndex);
        this.performanceEngine.pause();
      } else {
        this.btnPlayToggle.disabled=false;
        console.log("play"+this.sectionManager.currentSectionIndex);
        this.performanceEngine.play();
      }
    };
    
    this.btnPlayToggle.addEventListener('click',  togglePlayback);

    document.addEventListener('keydown', (event) => {
    const target = event.target;
    const isTyping =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable;

    if (event.code === 'Space' && !event.repeat && !isTyping) {
      event.preventDefault();
      togglePlayback();
    }

    
  });
  

    // Tecla Espacio para que el violinista avance notas cómodamente
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
        e.preventDefault();
        this.performanceEngine.nextEvent();
      } else if (e.code === 'ArrowRight') {
        this.performanceEngine.nextEvent();
      } else if (e.code === 'ArrowLeft') {
        this.performanceEngine.previousEvent();
      }
    });
  }

  _updateStateDisplay(state) {
    // Actualizar tabs activas
    this.container.querySelectorAll('.section-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sec === state.section);
    });

    // Movimiento
    const movNames = ["", "I: To see a World in a Grain of sand, And a Heaven in a Wild Flower,", "II: Hold Infinity in the palm of your hand", "III: And Eternity in an hour”"];
    this.movBadge.textContent = `Movimiento ${movNames[state.movement] || state.movement}`;

    // Tempo formal no editable
    if (this.tempoVal && state.tempo) {
      this.tempoVal.textContent = state.tempo;
      if (this.performanceEngine && this.performanceEngine.state) {
        this.performanceEngine.state.tempoBpm = state.tempo;
      }
    }

    // Barras
    if (this.barDensity) {
      this.barDensity.style.width = `${(state.density * 100).toFixed(0)}%`;
      this.textDensity.textContent = state.density.toFixed(2);
    }
    if (this.barComplexity) {
      this.barComplexity.style.width = `${(state.complexity * 100).toFixed(0)}%`;
      this.textComplexity.textContent = state.complexity.toFixed(2);
    }
    if (this.barTension) {
      this.barTension.style.width = `${(state.tension * 100).toFixed(0)}%`;
      this.textTension.textContent = state.tension.toFixed(2);
    }
    if (this.barConsonance) {
      this.barConsonance.style.width = `${(state.consonance * 100).toFixed(0)}%`;
      this.textConsonance.textContent = state.consonance.toFixed(2);
    }

    if (this.textDerivative) {
      const actives = state.activeDerivatives || [0];
      this.textDerivative.textContent = actives.map(d => d === 0 ? 'f' : `f^(${d})`).join(', ');
    }

    if (this.textTaylor) {
      const tOrders = state.taylorOrdersActive || [state.taylorOrder || 1];
      this.textTaylor.textContent = tOrders.map(o => `T_${o}`).join(' + ');
    }

    if (this.textScale) {
      this.textScale.textContent = state.scaleName || "dorico_la";
    }
  }

  _updatePerformanceDisplay(pState) {
    if (this.valPhraseIdx) this.valPhraseIdx.textContent = pState.phraseIndex + 1;
    if (this.valEventIdx) this.valEventIdx.textContent = pState.eventIndex + 1;

    if (this.btnPlayToggle) {
      this.btnPlayToggle.textContent = pState.isPlaying ? "⏸ Pausar" : "▶ Auto Play";
      this.btnPlayToggle.classList.toggle('btn-active-play', pState.isPlaying);
    }
  }
}
