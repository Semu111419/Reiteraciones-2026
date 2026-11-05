/**
 * CompositionStates.js
 * Presets formales para las 9 secciones de la obra en 3 movimientos.
 * Fuente canónica de parámetros musicales según BRIEF TÉCNICO.
 */

export const SECTION_STATES = {
  // === MOVIMIENTO I — NACIMIENTO ===
  tuning: {
    name: "Afinación",
    movement: 1,
    section: "tuning",
    sectionIndex: 1,
    character: "Acústico / Performativo",
    tempo: 50, // BPM formal constante
    density: 0.0,
    complexity: 0.0,
    tension: 0.0,
    consonance: 0.0,
    derivativeOrder: 0,
    activeDerivatives: [0],
    taylorOrder: 0,
    taylorOrdersActive: [],
    synthDensity: 0.0,
    synthAmplitude: 0.0,
    scaleName: "la_mayor_acustica",
    tonic: 69, // A4 (440 Hz)
    register: { minMidi: 55, maxMidi: 83, centerMidi: 69 },
    rhythmQuantization: {
      allowedDurations: [4, 2],
      subdivision: 1.0,
      irregularity: 0.0
    },
    transformations: {
      transposition: 0,
      retrograde: 0,
      inversion: 0,
      phaseOffset: 0,
      augmentation: 0,
      diminution: 0
    },
    dynamics: { min: 0.2, max: 0.4, curve: "soft" },
    articulation: { allowed: ["legato"], variability: 0.0 }
  },

  birth: {
    name: "Nacimiento",
    movement: 1,
    section: "birth",
    sectionIndex: 2,
    character: "Emergente, frágil, espacioso",
    tempo: 80, // BPM formal constante
    density: 1,
    complexity: 1,
    tension: 0,
    consonance: 1,
    derivativeOrder: 1,
    activeDerivatives: [0],
    taylorOrder: 16,
    taylorOrdersActive: [1,2],
    synthDensity: 0.5,
    synthAmplitude: 0.20, //volumen del syntgh
    scaleName: "pentatonica_la",
    tonic: 69,
    register: { minMidi: 60, maxMidi: 74, centerMidi: 69 },
    rhythmQuantization: {
      allowedDurations: [4],
      subdivision: 0.5,
      irregularity: 0.05
    },
    transformations: {
      transposition: 0,
      retrograde: 0,
      inversion: 0,
      phaseOffset: 0,
      augmentation: 0,
      diminution: 0
    },
    dynamics: { min: 0.2, max: 0.5, curve: "mezzo" },
    articulation: { allowed: ["legato", "sustain"], variability: 0.1 }
  },

  contemplation: {
    name: "Contemplación",
    movement: 1,
    section: "contemplation",
    sectionIndex: 3,
    character: "Meditativo, resonante, armónico",
    tempo: 52, // BPM formal constante
    density: 0.25,
    complexity: 0.25,
    tension: 0.20,
    consonance: 0.95,
    derivativeOrder: 2,
    activeDerivatives: [0, 1, 2],
    taylorOrder: 2,
    taylorOrdersActive: [1, 2],
    synthDensity: 0.30,
    synthAmplitude: 0.35,
    scaleName: "dorico_la",
    tonic: 69,
    register: { minMidi: 57, maxMidi: 76, centerMidi: 69 },
    rhythmQuantization: {
      allowedDurations: [4, 2, 1.5, 1],
      subdivision: 0.5,
      irregularity: 0.1
    },
    transformations: {
      transposition: 0,
      retrograde: 0,
      inversion: 0,
      phaseOffset: 0.1,
      augmentation: 1,
      diminution: 1
    },
    dynamics: { min: 0.3, max: 0.6, curve: "espressivo" },
    articulation: { allowed: ["legato", "sostenuto"], variability: 0.15 }
  },

  // === MOVIMIENTO II — TRANSFORMACIÓN ===
  accumulation: {
    name: "Acumulación",
    movement: 2,
    section: "accumulation",
    sectionIndex: 4,
    character: "Energético, insistente, acelerado",
    tempo: 76, // BPM formal constante
    density: 0.55,
    complexity: 0.50,
    tension: 0,
    consonance: 0.75,
    derivativeOrder: 4,
    activeDerivatives: [0, 1, 2, 3, 4],
    taylorOrder: 4,
    taylorOrdersActive: [2, 4],
    synthDensity: 0.51,
    synthAmplitude: 0.45,
    scaleName: "eolico_la",
    tonic: 69,
    register: { minMidi: 55, maxMidi: 81, centerMidi: 69 },
    rhythmQuantization: {
      allowedDurations: [2, 1.5, 1, 0.75, 0.5],
      subdivision: 0.25,
      irregularity: 0.3
    },
    transformations: {
      transposition: 2,
      retrograde: 0.3,
      inversion: 0.2,
      phaseOffset: 0.25,
      augmentation: 1.5,
      diminution: 0.75
    },
    dynamics: { min: 0.4, max: 0.75, curve: "crescendo" },
    articulation: { allowed: ["detaché", "accentato", "legato"], variability: 0.4 }
  },

  expansion: {
    name: "Expansión",
    movement: 2,
    section: "expansion",
    sectionIndex: 5,
    character: "Amplio, brillante, polifónico",
    tempo: 130, // BPM formal constante
    density: 0.7,
    complexity: 0,
    tension: 1,
    consonance: 0.65,
    derivativeOrder: 6,
    activeDerivatives: [3, 4,],
    taylorOrder: 8,
    taylorOrdersActive: [2, 4, 8],
    synthDensity: 0.70,
    synthAmplitude: 0.55,
    scaleName: "lidio_la",
    tonic: 73,
    register: { minMidi: 56, maxMidi: 86, centerMidi: 69 },
    rhythmQuantization: {
      allowedDurations: [4,2,1],
      subdivision: 0.25,
      irregularity: 1
    },
    transformations: {
      transposition: 0,
      retrograde: 0.5,
      inversion: 0.5,
      phaseOffset: 0.5,
      augmentation: 2,
      diminution: 1
    },
    dynamics: { min: 0.5, max: 0.85, curve: "plana" },
    articulation: { allowed: [], variability: 0 }
  },

  chaos: {
    name: "Caos",
    movement: 2,
    section: "chaos",
    sectionIndex: 6,
    character: "Saturado, polirrítmico, coexistencia múltiple",
    tempo: 100, // BPM formal constante
    density: 0.5,
    complexity: 1.0,
    tension: 1,
    consonance: 0.1,
    derivativeOrder: 8,
    activeDerivatives: [2, 4,5, 6, 8],
    taylorOrder: 8,
    taylorOrdersActive: [1, 2, 4, 8],
    synthDensity: 0.95,
    synthAmplitude: 0.70,
    scaleName: "cromatico_extendido",
    tonic: 69,
    register: { minMidi: 55, maxMidi: 88, centerMidi: 69 },
    rhythmQuantization: {
      allowedDurations: [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25],
      subdivision: 0.25,
      irregularity: 0.95
    },
    transformations: {
      transposition: -7,
      retrograde: 1.0,
      inversion: 1.0,
      phaseOffset: 0.75,
      augmentation: 2,
      diminution: 0.5
    },
    dynamics: { min: 0.6, max: 1.0, curve: "plana" },
    articulation: { allowed: ["martellato", "staccatissimo", "col_legno_synth"], variability: 0 }
  },

  // === MOVIMIENTO III — CONVERGENCIA ===
  convergence: {
    name: "Convergencia",
    movement: 3,
    section: "convergence",
    sectionIndex: 7,
    character: "Transicional, pacificación, reconexión motívica",
    tempo: 72, // BPM formal constante
    density: 0.50,
    complexity: 0.45,
    tension: 1,
    consonance: 0.75,
    derivativeOrder: 3,
    activeDerivatives: [0, 1, 2, 4],
    taylorOrder: 8,
    taylorOrdersActive: [4, 8],
    synthDensity: 0.51,
    synthAmplitude: 0.45,
    scaleName: "dorico_la",
    tonic: 69,
    register: { minMidi: 55, maxMidi: 81, centerMidi: 69 },
    rhythmQuantization: {
      allowedDurations: [3, 2, 1.5, 1, 0.5],
      subdivision: 0.5,
      irregularity: 0.3
    },
    transformations: {
      transposition: 0,
      retrograde: 0.2,
      inversion: 0.2,
      phaseOffset: 0.2,
      augmentation: 1,
      diminution: 1
    },
    dynamics: { min: 0.35, max: 0.65, curve: "diminuendo" },
    articulation: { allowed: ["legato", "tenuto"], variability: 0.2 }
  },

  revelation: {
    name: "Revelación",
    movement: 3,
    section: "revelation",
    sectionIndex: 8,
    character: "Sublime, máxima consonancia, T16 converge a f(t)",
    tempo: 100, // BPM formal constante
    density: 1,
    complexity: 1,
    tension: 1,
    consonance: 1,
    derivativeOrder: 2,
    activeDerivatives: [0, 1, 2,8],
    taylorOrder: 16,
    taylorOrdersActive: [1,2,4,8,16],
    synthDensity: 0.6,
    synthAmplitude: 0.8,
    scaleName: "acustica_lidia_dominante",
    tonic: 69,
    register: { minMidi: 57, maxMidi: 81, centerMidi: 69 },
    rhythmQuantization: {
      allowedDurations: [4, 3, 2],
      subdivision: 1,
      irregularity: 0
    },
    transformations: {
      transposition: 0,
      retrograde: 0,
      inversion: 0,
      phaseOffset: 0,
      augmentation: 1,
      diminution: 1
    },
    dynamics: { min: 0.4, max: 0.75, curve: "plana" },
    articulation: { allowed: ["legato"], variability: 0.1 }
  },

  return: {
    name: "Retorno",
    movement: 3,
    section: "return",
    sectionIndex: 9,
    character: "Sereno, íntimo, desvanecimiento, violín solista",
    tempo: 46, // BPM formal constante
    density: 0.12,
    complexity: 0.10,
    tension: 0,
    consonance: 0.95,
    derivativeOrder: 16,
    activeDerivatives: [0,1,2,3,4,5],
    taylorOrder: 16,
    taylorOrdersActive: [16],
    synthDensity: 0.10,
    synthAmplitude: 0.10, // Fade gradual a 0
    scaleName: "pentatonica_la",
    tonic: 69,
    register: { minMidi: 55, maxMidi: 76, centerMidi: 69 },
    rhythmQuantization: {
      allowedDurations: [4, 2],
      subdivision: 1.0,
      irregularity: 0.0
    },
    transformations: {
      transposition: 0,
      retrograde: 0,
      inversion: 0,
      phaseOffset: 0,
      augmentation: 1,
      diminution: 1
    },
    dynamics: { min: 0.1, max: 0.3, curve: "morendo" },
    articulation: { allowed: ["sul_tasto"," "," "," "], variability: 0.8 }
  }
};

export const SECTION_KEYS = [
  "tuning", "birth", "contemplation",
  "accumulation", "expansion", "chaos",
  "convergence", "revelation", "return"
];
