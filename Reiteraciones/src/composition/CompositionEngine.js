/**
 * CompositionEngine.js
 * Orquestador compositivo principal.
 * Convierte el análisis matemático (puntos críticos y derivadas) y el MusicalState
 * en la partitura estructurada en frases y cesuras para el violín.
 */

import { HarmonyEngine } from './HarmonyEngine.js';
import { RhythmEngine } from './RhythmEngine.js';
import { TransformEngine } from './TransformEngine.js';
import { MotiveEngine } from './MotiveEngine.js';

export class CompositionEngine {
  /**
   * @param {CriticalPointAnalyzer} criticalPointAnalyzer
   */
  constructor(criticalPointAnalyzer) {
    this.criticalPointAnalyzer = criticalPointAnalyzer;
    this.primaryMotive = null; // Motivo generador M que se preserva a lo largo de la obra
  }

  /**
   * Genera el material musical completo para el estado actual de la obra
   * @param {Object} state - Estado actual de MusicalStateStore
   * @returns {{
   *   phrases: Array<{
   *     id: number,
   *     events: Array<Object>,
   *     caesura: boolean
   *   }>,
   *   allEvents: Array<Object>,
   *   primaryMotive: Object
   * }}
   */
  generateScoreForState(state) {
    if (state.section === "tuning") {
      return { phrases: [], allEvents: [], primaryMotive: null };
    }

    const activeOrders = state.activeDerivatives || [0];
    const rawEventsByOrder = [];

    // 1. Extraer puntos críticos y mapear a eventos para cada derivada activa
    for (const order of activeOrders) {
      const analysis = this.criticalPointAnalyzer.analyzeOrder(order);
      const events = this._mapPointsToEvents(analysis, state);
      if (events.length > 0) {
        rawEventsByOrder.push({ order, events });
      }
    }

    if (rawEventsByOrder.length === 0) {
      return { phrases: [], allEvents: [], primaryMotive: null };
    }

    // 2. Establecer motivo primario en Nacimiento si aún no existe
    if (!this.primaryMotive && rawEventsByOrder[0]) {
      const seedEvents = rawEventsByOrder[0].events.slice(0, Math.min(5, rawEventsByOrder[0].events.length));
      this.primaryMotive = MotiveEngine.extractMotive(seedEvents, "motive_primario");
    }

    // 3. Aplicar transformaciones según el estado formal
    const assembledEvents = [];
    const tConfig = state.transformations || {};

    for (let i = 0; i < rawEventsByOrder.length; i++) {
      let evList = rawEventsByOrder[i].events;

      // Si la sección requiere usar el motivo recurrente
      if ((state.section === "convergence" || state.section === "revelation" || state.section === "return") && this.primaryMotive) {
        const startPitch = evList[0] ? evList[0].pitch.midi : state.tonic;
        const motiveInstance = MotiveEngine.instantiateMotive(
          this.primaryMotive,
          startPitch,
          state.register.minMidi,
          state.register.maxMidi
        );
        // Interpolar o concatenar
        evList = [...motiveInstance, ...evList.slice(motiveInstance.length)];
      }

      // Transposición
      if (tConfig.transposition && tConfig.transposition !== 0) {
        evList = TransformEngine.transpose(evList, tConfig.transposition, state.register.minMidi, state.register.maxMidi);
      }

      // Inversión (en caos o transformaciones activas)
      if (tConfig.inversion && tConfig.inversion > 0.3) {
        evList = TransformEngine.invert(evList, state.register.centerMidi || 69, state.register.minMidi, state.register.maxMidi);
      }

      // Retrogradación
      if (tConfig.retrograde && tConfig.retrograde > 0.4) {
        evList = TransformEngine.retrograde(evList);
      }

      // Desfase
      if (tConfig.phaseOffset && tConfig.phaseOffset > 0.1) {
        const shiftSteps = Math.round(evList.length * tConfig.phaseOffset);
        evList = TransformEngine.phaseShift(evList, shiftSteps);
      }

      // Aumentación / disminución
      if (tConfig.augmentation && tConfig.augmentation !== 1.0) {
        evList = TransformEngine.scaleDuration(evList, tConfig.augmentation);
      } else if (tConfig.diminution && tConfig.diminution !== 1.0) {
        evList = TransformEngine.scaleDuration(evList, tConfig.diminution);
      }

      assembledEvents.push(...evList);
    }

    // 4. Filtrar por densidad (density 0.0 - 1.0 controla cuántos eventos se seleccionan)
    const targetCount = Math.max(3, Math.round(assembledEvents.length * Math.min(1.0, Math.max(0.15, state.density))));
    const filteredEvents = this._selectByDensity(assembledEvents, targetCount);

    // 5. Agrupar en frases con cesuras
    const phraseSize = state.section === "birth" ? 4 : (state.section === "chaos" ? 7 : 5);
    const phrases = [];
    let currentPhraseEvents = [];

    filteredEvents.forEach((ev, idx) => {
      ev.phraseId = phrases.length;
      currentPhraseEvents.push(ev);

      if (currentPhraseEvents.length >= phraseSize || idx === filteredEvents.length - 1) {
        phrases.push({
          id: phrases.length,
          events: currentPhraseEvents,
          caesura: true // Cesura estructural al final de cada frase
        });
        currentPhraseEvents = [];
      }
    });

    return {
      phrases,
      allEvents: filteredEvents,
      primaryMotive: this.primaryMotive
    };
  }

  _mapPointsToEvents(analysis, state) {
    const { points, deltas, order } = analysis;
    if (!points || points.length === 0) return [];

    const minMidi = (state.register && state.register.minMidi) || 55;
    const maxMidi = (state.register && state.register.maxMidi) || 83;
    const tonic = state.tonic || 69;
    const scaleName = state.scaleName || "dorico_la";

    // Cuantización de ritmos según deltas
    const rhythms = RhythmEngine.quantizeDeltas(deltas, state.rhythmQuantization);

    const events = [];

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const r = rhythms[i] || rhythms[rhythms.length - 1] || { duration: 2, vexDuration: "h", dots: 0 };

      // Normalizar y [-1, 1] a [0, 1]
      const normY01 = (pt.y + 1) / 2;

      // Escalar al registro MIDI
      const rawMidi = Math.round(normY01 * (maxMidi - minMidi) + minMidi);

      // Cuantizar al grado modal de la escala activa
      const quantizedMidi = HarmonyEngine.quantizeToScale(rawMidi, scaleName, tonic);

      // Metadatos de notación y trazabilidad
      const noteName = this._midiToNoteName(quantizedMidi);

      events.push({
        id: `ev_${order}_${pt.index}_${i}`,
        pitch: {
          midi: quantizedMidi,
          noteName: noteName.name,
          step: noteName.step,
          accidental: noteName.accidental,
          octave: noteName.octave,
          vexKey: noteName.vexKey
        },
        rhythm: {
          duration: r.duration,
          quarterLength: r.quarterLength,
          vexDuration: r.vexDuration,
          dots: r.dots
        },
        source: {
          derivativeOrder: order,
          criticalPointIndex: pt.index,
          x: pt.x,
          y: pt.y,
          rawY: pt.rawY,
          type: pt.type
        },
        dynamic: this._assignDynamic(state.dynamics, pt.type,pt.index),
        articulation: this._assignArticulation(state.articulation, pt.type,pt.index)
      });
    }

    return events;
  }

  _selectByDensity(events, targetCount) {
    if (events.length <= targetCount) return events;
    const step = events.length / targetCount;
    const result = [];
    for (let i = 0; i < targetCount; i++) {
      const index = Math.min(events.length - 1, Math.floor(i * step));
      result.push(events[index]);
    }
    return result;
  }

  _assignDynamic(dynConfig, pointType,index) {
    if (!dynConfig) return "mf";
    if (dynConfig.curve === "soft") return pointType === "maximum" ? "mp" : "p";
    if (dynConfig.curve === "con_fuoco") return pointType === "maximum" ? "ff" : "f";
    if (dynConfig.curve === "morendo") return "pp";
    if (dynConfig.curve === "plana") return "f";
    if (dynConfig.curve === "mezzo") return "mp";
    return pointType === "maximum" ? "f" : "p";
  }

  _assignArticulation(artConfig, pointType,index) {
    if (!artConfig || !artConfig.allowed || artConfig.allowed.length === 0) return "legato";
    //if(artConfig.allowed=="sul_tasto"&&index>=1)return null;
    return artConfig.allowed[pointType === "maximum" ? 0 : Math.min(1, artConfig.allowed.length - 1)];
  }

  _midiToNoteName(midi) {
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const baseSteps = ["c", "c", "d", "d", "e", "f", "f", "g", "g", "a", "a", "b"];
    const accidentals = ["", "#", "", "#", "", "", "#", "", "#", "", "#", ""];
    const pitchClass = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    return {
      name: `${noteNames[pitchClass]}${octave}`,
      step: baseSteps[pitchClass],
      accidental: accidentals[pitchClass],
      octave: octave,
      vexKey: `${baseSteps[pitchClass]}/${octave}`
    };
  }
}
