/**
 * SynthEngine.js
 * Motor de síntesis polifónica aditiva y ambiental.
 * Genera texturas electrónicas coordinadas por MusicalState y los órdenes de Taylor.
 */

import { TaylorVoice } from './TaylorVoice.js';
import { HarmonyEngine } from '../composition/HarmonyEngine.js';

export class SynthEngine {
  /**
   * @param {AudioEngine} audioEngine
   * @param {TaylorEngine} taylorEngine
   * @param {MusicalStateStore} stateStore
   */
  constructor(audioEngine, taylorEngine, stateStore) {
    this.audioEngine = audioEngine;
    this.taylorEngine = taylorEngine;
    this.stateStore = stateStore;

    this.voicesByOrder = new Map(); // orden -> TaylorVoice
    this.ambientNodes = [];
    this.droneGain = null;
    this.isDroneActive = false;
    this.droneInterval = null;

    this._initVoices();
  }

  _initVoices() {
    if (!this.audioEngine || !this.audioEngine.ctx) return;

    const orders = [1, 2, 4, 8, 16];
    for (const ord of orders) {
      const voice = new TaylorVoice(
        this.audioEngine.ctx,
        ord,
        this.taylorEngine,
        this.audioEngine.reverbNode // Se envía al procesador de sala
      );
      this.voicesByOrder.set(ord, voice);
    }

    // Bus de drone armónico ambiental
    this.droneGain = this.audioEngine.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.0001, this.audioEngine.ctx.currentTime);
    if (this.audioEngine.reverbNode) this.droneGain.connect(this.audioEngine.reverbNode);
    if (this.audioEngine.dryGain) this.droneGain.connect(this.audioEngine.dryGain);
  }

  /**
   * Reconstruye las tablas de ondas cuando se actualiza el modelo armónico
   */
  rebuildWavetables() {
    this._initVoices();
  }

  /**
   * Inicia el drone de fondo electrónico interactivo que sigue las secciones
   */
  startAmbientDrone() {
    if (this.isDroneActive) return;
    this.isDroneActive = true;

    // Disparador rítmico/estocástico periódico de texturas electrónicas
    this.droneInterval = setInterval(() => {
      this._tickAmbientPulse();
    }, 2800);
  }

  stopAmbientDrone() {
    this.isDroneActive = false;
    if (this.droneInterval) {
      clearInterval(this.droneInterval);
      this.droneInterval = null;
    }
  }

  _tickAmbientPulse() {
    const state = this.stateStore.getState();
    if (state.synthAmplitude <= 0.01 || state.synthDensity <= 0.01) return;

    const activeOrders = state.taylorOrdersActive || [1];
    if (activeOrders.length === 0) return;

    // Generar acordes de resonancia con la tónica
    const pitches = HarmonyEngine.generateHarmonicResonance(state.tonic, state);

    // Seleccionar según densidad
    const countToPlay = Math.max(1, Math.round(pitches.length * state.synthDensity));

    for (let i = 0; i < countToPlay; i++) {
      const midi = pitches[i % pitches.length];
      const freq = 440 * Math.pow(2, (midi - 69) / 12);

      // Elegir orden de Taylor activo para esta voz
      const order = activeOrders[Math.floor(Math.random() * activeOrders.length)];
      const voice = this.voicesByOrder.get(order) || this.voicesByOrder.get(1);

      if (voice) {
        const dur = 3.5 + Math.random() * 2.5;
        const gain = (state.synthAmplitude / activeOrders.length) * 0.45;
        const pan = (Math.random() * 1.6) - 0.8;
        voice.trigger(freq, dur, gain, pan);
      }
    }
  }

  /**
   * Resuena y acompaña una nota ejecutada en la partitura por el violín.
   * En la sección Chaos, los synthes replican directamente las notas de la partitura
   * distribuidas en los diferentes órdenes de Taylor activos (T1, T2, T4, T8).
   * @param {Object} event - MusicalEvent
   */
  respondToScoreNote(event) {
    const state = this.stateStore.getState();
    if (state.synthAmplitude <= 0.001) return;

    const leadMidi = event.pitch.midi;
    const activeOrders = state.taylorOrdersActive || [1];

    if (state.synthDensity >0.5) {
      // Si la densidad del sintetizador es mayor a 0.5 estos repetiran la partitura
      activeOrders.forEach((order, idx) => {
        const voice = this.voicesByOrder.get(order) || this.voicesByOrder.get(1);
        if (voice) {
          // Desfase polifónico e interválico sutil entre órdenes
          const trans = idx === 0 ? 0 : (idx === 1 ? -12 : (idx === 2 ? 7 : -5));
          const freq = 440 * Math.pow(2, (leadMidi + trans - 69) / 12);
          const durationSec = (event.rhythm.quarterLength || 1.5) * 2.0;
          const gain = (state.synthAmplitude / activeOrders.length) * 0.55;
          const pan = ((idx / (activeOrders.length - 1 || 1)) * 1.6) - 0.8;
          voice.trigger(freq, durationSec, gain, pan);
        }
      });
      return;
    }

    // EN OTRAS SECCIONES: Resonancia armónica modal
    const resonantPitches = HarmonyEngine.generateHarmonicResonance(leadMidi, state);
    const numVoices = state.consonance > 0.8 ? 2 : (state.tension > 0.6 ? 3 : 1);

    for (let i = 0; i < numVoices; i++) {
      const midi = resonantPitches[(i + 1) % resonantPitches.length];
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const order = activeOrders[i % activeOrders.length];
      const voice = this.voicesByOrder.get(order);

      if (voice) {
        const durationSec = (event.rhythm.quarterLength || 2) * 1.5;
        const pan = ((i / numVoices) * 1.4) - 0.7;
        voice.trigger(freq, durationSec, state.synthAmplitude * 0.35, pan);
      }
    }
  }

  /**
   * Programa el fade out de 10 segundos para la sección Retorno,
   * 20 segundos después de haber iniciado, concluyendo la obra.
   * Proporciona feedback visual en tiempo real en la interfaz.
   */
  handleReturnSection() {
    this.cancelReturnFadeOut();

    console.log("Sección Retorno activa. Conclusión de obra programada (Fade out en 20s)...");

    let remainingSeconds = 40;
    const updateCountdown = () => {
      const badge = document.getElementById('movement-badge');
      if (badge && this.stateStore.getState().section === 'return') {
        if (remainingSeconds > 0) {
          badge.textContent = `Retorno: Conclusión de obra en ${remainingSeconds}s`;
          badge.className = "badge badge-warning";
        } else {
          badge.textContent = `Retorno: Desvaneciendo electrónica (Fade out 10s)...`;
          badge.className = "badge badge-accent";
        }
      }
    };

    updateCountdown();
    this.countdownInterval = setInterval(() => {
      remainingSeconds--;
      updateCountdown();
      if (remainingSeconds <= 0) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
      }
    }, 1000);

    this.returnFadeTimer = setTimeout(() => {
      console.log("Iniciando fade out electrónico de 10 segundos...");
      this._executeFadeOut(10.0, () => {
        console.log("Obra Reiteraciones concluida. Silencio electrónico.");
        this.stopAmbientDrone();
        const finishBadge = document.getElementById('movement-badge');
        if (finishBadge) {
          finishBadge.textContent = "Obra Concluida — Silencio Acústico";
          finishBadge.className = "badge badge-success";
        }
      });
    }, 20000); // 20 segundos
  }

  cancelReturnFadeOut() {
    if (this.returnFadeTimer) {
      clearTimeout(this.returnFadeTimer);
      this.returnFadeTimer = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }

  _executeFadeOut(durationSec = 10.0, onComplete = null) {
    const startAmp = this.stateStore.getState().synthAmplitude || 0.15;
    const startTime = performance.now();
    const durationMs = durationSec * 1000;

    this.fadeInterval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1.0, elapsed / durationMs);
      const currentAmp = startAmp * (1.0 - progress);

      this.stateStore.setState({ synthAmplitude: Math.max(0, currentAmp) });

      if (progress >= 1.0) {
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
        this.stateStore.setState({ synthAmplitude: 0.0 });
        if (onComplete) onComplete();
      }
    }, 100);
  }
}

