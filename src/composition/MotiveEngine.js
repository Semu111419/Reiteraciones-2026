/**
 * MotiveEngine.js
 * Identificación, abstracción y preservación de motivos musicales a partir de secuencias de eventos.
 * Extrae la identidad interválica relativa y el perfil rítmico para transformaciones ulteriores.
 */

export class MotiveEngine {
  /**
   * Extrae un motivo a partir de un arreglo de eventos musicales
   * @param {Array<MusicalEvent>} events
   * @param {string} id
   * @returns {Object} Motive
   */
  static extractMotive(events, id = "motive_0") {
    if (!events || events.length === 0) return null;

    const pitches = events.map(e => e.pitch.midi);
    const durations = events.map(e => e.rhythm.duration);

    // Calcular vector de intervalos relativos consecutivos
    const intervals = [];
    for (let i = 0; i < pitches.length - 1; i++) {
      intervals.push(pitches[i + 1] - pitches[i]);
    }

    // Contorno melódico (+1: sube, -1: baja, 0: repite)
    const contour = intervals.map(iv => Math.sign(iv));

    return {
      id,
      events: events.map(e => ({ ...e })),
      pitches,
      intervals,
      durations,
      contour,
      length: events.length,
      tonic: pitches[0],
      sourceDerivative: events[0].source ? events[0].source.derivativeOrder : 0
    };
  }

  /**
   * Reconstruye una secuencia de eventos aplicando un motivo a una nota inicial dada
   * @param {Object} motive
   * @param {number} startMidi
   * @param {number} minMidi
   * @param {number} maxMidi
   * @returns {Array<MusicalEvent>}
   */
  static instantiateMotive(motive, startMidi = 69, minMidi = 55, maxMidi = 88) {
    if (!motive || !motive.events.length) return [];

    const newEvents = [];
    let currentPitch = startMidi;

    for (let i = 0; i < motive.length; i++) {
      const baseEvent = motive.events[i];
      let clampedPitch = currentPitch;
      while (clampedPitch < minMidi) clampedPitch += 12;
      while (clampedPitch > maxMidi) clampedPitch -= 12;

      newEvents.push({
        ...baseEvent,
        pitch: {
          ...baseEvent.pitch,
          midi: clampedPitch
        },
        motiveId: motive.id,
        motiveIndex: i
      });

      if (i < motive.intervals.length) {
        currentPitch += motive.intervals[i];
      }
    }

    return newEvents;
  }
}
