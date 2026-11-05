/**
 * PerformanceEngine.js
 * Control de la ejecución temporal e interpretativa de la obra.
 * Mantiene PerformanceState independiente de MusicalState.
 * Soporta tempo libre por frases (guiado por el violinista) y reproducción asistida.
 */

export class PerformanceEngine {
  /**
   * @param {ScoreModel} scoreModel
   * @param {ScoreRenderer} scoreRenderer
   * @param {SynthEngine} synthEngine
   * @param {(sectionKey: string) => void} onSectionComplete
   */
  constructor(scoreModel, scoreRenderer, synthEngine, onSectionComplete = null) {
    this.scoreModel = scoreModel;
    this.scoreRenderer = scoreRenderer;
    this.synthEngine = synthEngine;
    this.onSectionComplete = onSectionComplete;

    this.state = {
      movement: 1,
      section: "tuning",
      phraseIndex: 0,
      eventIndex: 0,
      elapsedTime: 0,
      isPlaying: false,
      tempoBpm: 50,
      mode: 'manual' // 'manual' (intérprete) o 'auto'
    };

    this.timer = null;
    this.listeners = new Set();
  }

  setScoreModel(scoreModel) {
    this.scoreModel = scoreModel;
    this.state.eventIndex = 0;
    this.state.phraseIndex = 0;
    this.scoreRenderer.render(this.scoreModel, 0);
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const l of this.listeners) l(this.state);
  }

  /**
   * Avanza a la siguiente nota (llamado manualmente por el intérprete o automáticamente)
   */
  nextEvent() {
    if (!this.scoreModel || this.scoreModel.totalEvents === 0) return;
      
    const currentEv = this.scoreModel.getEventAt(this.state.eventIndex);

    // Activar resonancia de síntesis electrónica para esta nota
    if (currentEv && this.synthEngine) {
      this.synthEngine.respondToScoreNote(currentEv);
    }

    // Actualizar visual en partitura
    this.scoreRenderer.setActiveNote(this.state.eventIndex);

    // Preparar siguiente índice
    if (this.state.eventIndex < this.scoreModel.totalEvents - 1) {
      this.state.eventIndex++;
      const nextEv = this.scoreModel.getEventAt(this.state.eventIndex);
      if (nextEv) {
        this.state.phraseIndex = nextEv.phraseIndex;
      }
    } else {
      // Fin de la sección actual
      if (this.onSectionComplete) {
        this.onSectionComplete(this.state.section);
      }
    }

    this.notify();
  }

  /**
   * Retrocede a la nota anterior
   */
  previousEvent() {
    if (!this.scoreModel || this.state.eventIndex <= 0) return;
    this.state.eventIndex--;
    const prevEv = this.scoreModel.getEventAt(this.state.eventIndex);
    if (prevEv) {
      this.state.phraseIndex = prevEv.phraseIndex;
    }
    this.scoreRenderer.setActiveNote(this.state.eventIndex);
    this.notify();
  }

  /**
   * Inicia avance automático
   */
  play() {
    if (this.state.isPlaying) return;
    this.state.isPlaying = true;
    this.state.mode = 'auto';
    this._scheduleNextStep();
    this.notify();
  }

  pause() {
    this.state.isPlaying = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.notify();
  }

  _scheduleNextStep() {
    if (!this.state.isPlaying || !this.scoreModel) return;

    const ev = this.scoreModel.getEventAt(this.state.eventIndex);
    const ql = (ev && ev.rhythm && ev.rhythm.quarterLength) ? ev.rhythm.quarterLength : 1.5;
    const msPerBeat = (60 / this.state.tempoBpm) * 1000;
    let stepDelayMs = ql * msPerBeat;

    // Si es cesura al final de frase, añadir tiempo de pausa respiratoria
    if (ev && ev.isLastInPhrase) {
      stepDelayMs += msPerBeat * 1.5;
    }

    this.timer = setTimeout(() => {
      this.nextEvent();
      this._scheduleNextStep();
    }, stepDelayMs);
  }
}
