/**
 * MusicalStateStore.js
 * Capa de estado global reactiva e inmutable.
 * Fuente única de verdad para la composición, la partitura y la síntesis electrónica.
 */

import { SECTION_STATES } from './CompositionStates.js';

export class MusicalStateStore {
  /**
   * @param {Object} initialState
   */
  constructor(initialState = SECTION_STATES.tuning) {
    this.state = JSON.parse(JSON.stringify(initialState));
    this.listeners = new Set();
    this.transitionTimer = null;
  }

  /**
   * Obtiene una instantánea inmutable del estado actual
   * @returns {Object}
   */
  getState() {
    return this.state;
  }

  /**
   * Actualiza el estado de manera inmutable (deep merge) y notifica a los suscriptores
   * @param {Object} partialState
   */
  setState(partialState) {
    this.state = this._deepMerge(this.state, partialState);
    this.notify();
  }

  /**
   * Suscribe un listener a cambios de estado
   * @param {(state: Object) => void} listener
   * @returns {() => void} función para desuscribirse
   */
  subscribe(listener) {
    this.listeners.add(listener);
    // Notificación inmediata al suscribirse
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error("Error in MusicalStateStore listener:", err);
      }
    }
  }

  /**
   * Transición interpolada suave hacia una nueva sección
   * @param {string} targetSectionKey - clave en SECTION_STATES (ej. 'chaos', 'revelation')
   * @param {number} durationSec - duración en segundos
   * @param {() => void} onComplete - callback al finalizar
   */
  transitionToSection(targetSectionKey, durationSec = 4.0, onComplete = null) {
    if (this.transitionTimer) {
      clearInterval(this.transitionTimer);
      this.transitionTimer = null;
    }

    const targetPreset = SECTION_STATES[targetSectionKey];
    if (!targetPreset) {
      console.warn(`Section preset ${targetSectionKey} not found`);
      return;
    }

    if (durationSec <= 0.1) {
      this.setState(targetPreset);
      if (onComplete) onComplete();
      return;
    }

    const startState = JSON.parse(JSON.stringify(this.state));
    const startTime = performance.now();
    const durationMs = durationSec * 1000;

    // Parámetros continuos a interpolar
    const interpolableKeys = ['density', 'complexity', 'tension', 'consonance', 'synthDensity', 'synthAmplitude'];

    const stepIntervalMs = 50; // ~20 updates/segundo

    this.transitionTimer = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);

      // Curva suave s-curve (smoothstep)
      const smoothT = progress * progress * (3 - 2 * progress);

      const intermediate = {};

      for (const key of interpolableKeys) {
        if (typeof startState[key] === 'number' && typeof targetPreset[key] === 'number') {
          intermediate[key] = startState[key] + (targetPreset[key] - startState[key]) * smoothT;
        }
      }

      // Los parámetros estructurales/discretos se actualizan a mitad de camino o al final
      if (progress >= 0.5) {
        intermediate.section = targetPreset.section;
        intermediate.movement = targetPreset.movement;
        intermediate.name = targetPreset.name;
        intermediate.scaleName = targetPreset.scaleName;
        intermediate.derivativeOrder = targetPreset.derivativeOrder;
        intermediate.taylorOrder = targetPreset.taylorOrder;
        intermediate.taylorOrdersActive = targetPreset.taylorOrdersActive;
        intermediate.register = targetPreset.register;
        intermediate.rhythmQuantization = targetPreset.rhythmQuantization;
        intermediate.transformations = targetPreset.transformations;
        intermediate.dynamics = targetPreset.dynamics;
        intermediate.articulation = targetPreset.articulation;
        intermediate.tempo = targetPreset.tempo;
      }

      this.setState(intermediate);

      if (progress >= 1.0) {
        clearInterval(this.transitionTimer);
        this.transitionTimer = null;
        this.setState(targetPreset); // Asegurar valores finales exactos
        if (onComplete) onComplete();
      }
    }, stepIntervalMs);
  }

  _deepMerge(target, source) {
    const output = { ...target };
    if (this._isObject(target) && this._isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this._isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this._deepMerge(target[key], source[key]);
          }
        } else if (Array.isArray(source[key])) {
          output[key] = [...source[key]];
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  _isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
  }
}
