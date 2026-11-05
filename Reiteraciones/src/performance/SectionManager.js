/**
 * SectionManager.js
 * Coordinador de la macroestructura formal de la obra (3 movimientos, 9 secciones).
 */

import { SECTION_KEYS, SECTION_STATES } from '../composition/CompositionStates.js';

export class SectionManager {
  /**
   * @param {MusicalStateStore} stateStore
   * @param {CompositionEngine} compositionEngine
   * @param {PerformanceEngine} performanceEngine
   * @param {SynthEngine} synthEngine
   */
  constructor(stateStore, compositionEngine, performanceEngine, synthEngine) {
    this.stateStore = stateStore;
    this.compositionEngine = compositionEngine;
    this.performanceEngine = performanceEngine;
    this.synthEngine = synthEngine;

    this.currentSectionIndex = 0; // 0 = tuning
    this.canNavigate = false; // Bloqueado hasta completar la captura espectral
  }

  unlockNavigation() {
    this.canNavigate = true;
  }

  getCurrentSectionKey() {
    return SECTION_KEYS[this.currentSectionIndex] || "tuning";
  }

  /**
   * Cambia a una sección específica
   * @param {string} sectionKey
   * @param {number} transitionDurationSec
   */
  goToSection(sectionKey, transitionDurationSec = 1.0) {
    if (!this.canNavigate && sectionKey !== "tuning") {
      console.warn("Navegación bloqueada: complete la captura de afinación primero.");
      return;
    }

    const idx = SECTION_KEYS.indexOf(sectionKey);
    if (idx === -1) return;

    this.currentSectionIndex = idx;

    console.log("Al cambiar de sección el estado del botón de reproducción es: "+this.performanceEngine.state.isPlaying);

    this.performanceEngine.play();

    console.log("Luego de cambiar de sección el estado del botón de reproducción es: "+this.performanceEngine.state.isPlaying);

    // Disparar transición interpolada suave en el StateStore
    this.stateStore.transitionToSection(sectionKey, transitionDurationSec, () => {
      // Regenerar la partitura para el nuevo estado
      this._regenerateScore();
    });

    // En caso de que se necesite respuesta inmediata de partitura
    this._regenerateScore();
  }

  nextSection() {
    if (this.currentSectionIndex < SECTION_KEYS.length - 1) {
      this.currentSectionIndex++;
      this.goToSection(SECTION_KEYS[this.currentSectionIndex]);
    }
  }

  previousSection() {
    if (this.currentSectionIndex > 0) {
      this.currentSectionIndex--;
      this.goToSection(SECTION_KEYS[this.currentSectionIndex]);
    }
  }

  _regenerateScore() {
    const state = this.stateStore.getState();
    const generated = this.compositionEngine.generateScoreForState(state);
    const scoreModel = {
      phrases: generated.phrases,
      sectionName: state.section,
      flattenedEvents: [],
      get totalEvents() { return this.flattenedEvents.length; },
      get totalPhrases() { return this.phrases.length; },
      getEventAt(i) { return this.flattenedEvents[i]; }
    };

    // Aplanar
    generated.phrases.forEach((phrase, pIdx) => {
      phrase.events.forEach((ev, evIdx) => {
        scoreModel.flattenedEvents.push({
          ...ev,
          globalIndex: scoreModel.flattenedEvents.length,
          phraseIndex: pIdx,
          isLastInPhrase: evIdx === phrase.events.length - 1
        });
      });
    });

    this.performanceEngine.setScoreModel(scoreModel);
  }
}
