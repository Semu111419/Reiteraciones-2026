/**
 * TransformEngine.js
 * Operaciones de transformación melódica y rítmica:
 * - Transposición (T)
 * - Retrogradación (R)
 * - Inversión interválica simétrica (I)
 * - Desfase / rotación circular (D)
 * - Aumentación rítmica (A)
 * - Disminución rítmica (d)
 * Preservando metadatos y trazabilidad de origen.
 */

export class TransformEngine {
  /**
   * Transpone las notas por un intervalo en semitonos
   * @param {Array<MusicalEvent>} events
   * @param {number} semitones
   * @param {number} minMidi
   * @param {number} maxMidi
   * @returns {Array<MusicalEvent>}
   */
  static transpose(events, semitones = 0, minMidi = 55, maxMidi = 88) {
    if (semitones === 0) return events.map(e => ({ ...e }));

    return events.map(e => {
      let newMidi = e.pitch.midi + semitones;
      // Asegurar que permanezca en registro viable de violín
      while (newMidi < minMidi) newMidi += 12;
      while (newMidi > maxMidi) newMidi -= 12;

      return {
        ...e,
        pitch: {
          ...e.pitch,
          midi: newMidi,
          transposedBy: semitones
        }
      };
    });
  }

  /**
   * Retrograda la secuencia melódica (lectura de atrás hacia adelante)
   * @param {Array<MusicalEvent>} events
   * @returns {Array<MusicalEvent>}
   */
  static retrograde(events) {
    const reversed = [...events].reverse();
    return reversed.map(e => ({
      ...e,
      transformation: 'retrograde'
    }));
  }

  /**
   * Inversión melódica respecto a un eje central (eje por defecto: primera nota o promedio)
   * @param {Array<MusicalEvent>} events
   * @param {number|null} axisMidi
   * @param {number} minMidi
   * @param {number} maxMidi
   * @returns {Array<MusicalEvent>}
   */
  static invert(events, axisMidi = null, minMidi = 55, maxMidi = 88) {
    if (!events.length) return [];
    const axis = axisMidi !== null ? axisMidi : events[0].pitch.midi;

    return events.map(e => {
      const diff = e.pitch.midi - axis;
      let invertedMidi = Math.round(axis - diff);

      while (invertedMidi < minMidi) invertedMidi += 12;
      while (invertedMidi > maxMidi) invertedMidi -= 12;

      return {
        ...e,
        pitch: {
          ...e.pitch,
          midi: invertedMidi,
          invertedAround: axis
        },
        transformation: 'inversion'
      };
    });
  }

  /**
   * Desfase (rotación circular como en cell 31 del notebook original)
   * @param {Array<MusicalEvent>} events
   * @param {number} offsetSteps
   * @returns {Array<MusicalEvent>}
   */
  static phaseShift(events, offsetSteps = 0) {
    const len = events.length;
    if (len <= 1 || offsetSteps === 0) return events.map(e => ({ ...e }));

    const start = ((offsetSteps % len) + len) % len;
    const result = [];
    for (let i = 0; i < len; i++) {
      const idx = (start + i) % len;
      result.push({
        ...events[idx],
        transformation: `phase_shift_${start}`
      });
    }
    return result;
  }

  /**
   * Aumentación / disminución de las duraciones rítmicas
   * @param {Array<MusicalEvent>} events
   * @param {number} factor (ej. 2 para aumentación, 0.5 para disminución)
   * @returns {Array<MusicalEvent>}
   */
  static scaleDuration(events, factor = 1.0) {
    if (factor === 1.0) return events.map(e => ({ ...e }));

    return events.map(e => ({
      ...e,
      rhythm: {
        ...e.rhythm,
        duration: e.rhythm.duration * factor,
        quarterLength: (e.rhythm.quarterLength || e.rhythm.duration) * factor
      },
      transformation: factor > 1 ? 'augmentation' : 'diminution'
    }));
  }
}
