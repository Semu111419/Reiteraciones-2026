/**
 * HarmonyEngine.js
 * Genera estructuras armónicas y acordes de resonancia para la electrónica
 * a partir de la serie de Fourier del violín y las notas de la partitura.
 */

export class HarmonyEngine {
  // Escalas y modos en semitonos relativos a la tónica
  static SCALES = {
    pentatonica_la: [0, 3, 5, 7, 10], // Menor pentatónica
    dorico_la: [0, 2, 3, 5, 7, 9, 10], // Dórico
    eolico_la: [0, 2, 3, 5, 7, 8, 10], // Menor natural
    lidio_la: [0, 2, 4, 6, 7, 9, 11], // Lidio
    la_mayor_acustica: [0, 2, 4, 6, 7, 9, 10], // Acústica (Lidio Dominante / Escala de armónicos)
    acustica_lidia_dominante: [0, 3, 7,9,10],
    cromatico_extendido: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  };

  /**
   * Cuantiza un pitch MIDI a la escala activa más cercana
   * @param {number} midi
   * @param {string} scaleName
   * @param {number} tonic
   * @returns {number}
   */
  static quantizeToScale(midi, scaleName = "dorico_la", tonic = 69) {
    const scale = HarmonyEngine.SCALES[scaleName] || HarmonyEngine.SCALES.dorico_la;
    const tonicPc = ((tonic % 12) + 12) % 12;
    const notePc = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12);

    // Encontrar grado más cercano en pitch-class
    let bestInterval = scale[0];
    let minDiff = Infinity;
    for (const interval of scale) {
      const pc = (tonicPc + interval) % 12;
      const diff = Math.min(Math.abs(pc - notePc), 12 - Math.abs(pc - notePc));
      if (diff < minDiff) {
        minDiff = diff;
        bestInterval = interval;
      }
    }

    const quantizedPc = (tonicPc + bestInterval) % 12;
    let resultMidi = octave * 12 + quantizedPc;
    // Si la diferencia fue grande, verificar octava contigua
    if (Math.abs(resultMidi - midi) > 6) {
      if (resultMidi < midi) resultMidi += 12;
      else resultMidi -= 12;
    }
    return resultMidi;
  }

  /**
   * Genera un voicing o acorde resonante para la electrónica a partir de una nota de violín
   * @param {number} leadMidi - Altura de la nota del violín
   * @param {Object} state - MusicalState
   * @returns {number[]} Arreglo de alturas MIDI para las voces electrónicas
   */
  static generateHarmonicResonance(leadMidi, state) {
    const consonance = state.consonance !== undefined ? state.consonance : 0.8;
    const tonic = state.tonic || 69;
    const scale = HarmonyEngine.SCALES[state.scaleName] || HarmonyEngine.SCALES.dorico_la;

    // Fondos en registro bajo/medio (pedal fundamental o quinta)
    const voices = [];
    const baseBass = tonic - 24; // LA2 (45) o LA1 (33)
    voices.push(baseBass);

    if (consonance > 0.7) {
      // Armonía abierta, consonante, resonante (quintas y octavas acústicas)
      voices.push(baseBass + 7); // Quinta justa
      voices.push(baseBass + 12); // Octava
      if (consonance > 0.9) {
        voices.push(baseBass + 16); // Tercera mayor (serie armónica armónico 5)
        voices.push(baseBass + 21); // Armónico 7 aprox / sexta
      }
    } else if (consonance > 0.4) {
      // Armonía modal rica (séptimas, novenas)
      voices.push(baseBass + 7);
      voices.push(HarmonyEngine.quantizeToScale(leadMidi - 12, state.scaleName, tonic));
      voices.push(HarmonyEngine.quantizeToScale(leadMidi - 5, state.scaleName, tonic));
    } else {
      // Caos / Tensión: intervalos de semitono, trítono, cluster espectral
      voices.push(baseBass + 6); // Trítono
      voices.push(leadMidi - 1); // Semitono de choque
      voices.push(leadMidi + 6); // Trítono superior
    }

    return voices;
  }
}
