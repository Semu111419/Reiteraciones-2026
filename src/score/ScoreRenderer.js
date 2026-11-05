/**
 * ScoreRenderer.js
 * Renderizado de partitura continua para violín solista.
 * Muestra todas las frases de la sección activa en sistemas encadenados de pentagrama,
 * ocupando el área principal de la pantalla con alto contraste visual (fondo claro, notación nítida).
 * Soporta VexFlow 4.x con modo Voice.Mode.SOFT (senza misura), cesuras, cursor activo y trazabilidad.
 */

export class ScoreRenderer {
  /**
   * @param {HTMLElement} containerElement
   * @param {Object} options
   */
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = {
      systemWidth: 1040,
      notesPerSystem: 0, // ~8 notas por sistema para espaciado editorial óptimo
      ...options
    };
    this.scoreModel = null;
    this.activeEventIndex = -1;
    this.onNoteClick = options.onNoteClick || null;
    this.renderedNotesMap = new Map(); // globalIndex -> SVGElement
  }

  /**
   * Carga y renderiza el ScoreModel completo de la sección
   * @param {ScoreModel} scoreModel
   * @param {number} activeIndex
   */
  render(scoreModel, activeIndex = -1) {
    this.scoreModel = scoreModel;
    this.activeEventIndex = activeIndex;
    this.container.innerHTML = "";
    this.renderedNotesMap.clear();

    if (!scoreModel || scoreModel.totalEvents === 0) {
      this.container.innerHTML = `
        <div class="score-placeholder">
          <div class="score-tuning-prompt">
            <span class="tuning-icon">𝄞</span>
            <h3>Fase de Afinación — La cuerda LA al aire</h3>
            <p class="tuning-sub">Toque la cuerda LA en el violín o presione "Usar Muestra Violín LA" y luego "Capturar Timbre" para generar la partitura a partir del timbre del instrumento.</p>
          </div>
        </div>
      `;
      return;
    }

    // Cabecera formal de la partitura (estilo editorial de concierto)
    const sectionNames = {
      tuning: 'Afinación',
      birth: 'Nacimiento',
      contemplation:'Contemplación',
      accumulation: 'Acumulación',
      expansion: 'Expansión',
      chaos: 'Caos',
      convergence: 'Convergencia',
      revelation: 'Revelación',
      return: 'Retorno'  
    };

    const originalSection = (scoreModel.sectionName || '').trim().toLowerCase();

    const translatedSection =
      sectionNames[originalSection] || scoreModel.sectionName || '';

    const scoreHeader = document.createElement('div');
    scoreHeader.className = 'score-editorial-header';

    scoreHeader.innerHTML = `
      <div class="editorial-title">REITERACIONES</div>
      <div class="editorial-subtitle">
        Sección: <strong>${translatedSection}</strong> — Violín Solista
      </div>
      <div class="editorial-indication">
        Senza misura, flessibile · Calderón (𝄐) entre frases
      </div>
    `;

this.container.appendChild(scoreHeader);

    // Contenedor de sistemas continuos
    const systemsContainer = document.createElement('div');
    systemsContainer.className = 'score-systems-flow';
    this.container.appendChild(systemsContainer);

    // Comprobar si VexFlow está disponible
    if (typeof window.Vex !== 'undefined' && window.Vex.Flow) {
      try {
        this._renderContinuousVexflow(systemsContainer);
        return;
      } catch (err) {
        console.error("Vexflow rendering error, switching to native renderer:", err);
      }
    }

    // Fallback nativo SVG
    this._renderNativeSVG(systemsContainer);
  }

  _scrollPageToScore() {
  // Evitar que la página se reposicione repetidamente.
  if (this._pageAlignedToScore) return;

  const scoreStage = document.querySelector('.score-main-stage');
  if (!scoreStage) return;

  const rect = scoreStage.getBoundingClientRect();

  // Desplazar la página para colocar el escenario arriba.
  const targetY = window.scrollY + rect.top;

  window.scrollTo({
    top: targetY,
    behavior: 'smooth'
  });

  this._pageAlignedToScore = false;
}

  /**
   * Mantiene visible verticalmente el sistema de la nota activa.
   * No modifica el desplazamiento horizontal.
   */
  _scrollToActiveNote(svgNote) {
    if (!svgNote) return;

    // Contenedor que tiene el desplazamiento de la partitura.
    const container = this.container;
    if (!container) return;

    const noteRect = svgNote.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const margin = 150; // Margen vertical de seguridad.

    // Posición de la nota relativa al área visible del contenedor.
    const noteTop = noteRect.top - containerRect.top;
    const noteBottom = noteRect.bottom - containerRect.top;

    const visibleTop = margin;
    const visibleBottom = container.clientHeight - margin;

    // Solo desplazar si la nota se aproxima a los bordes.
    if (noteTop < visibleTop) {
      container.scrollTop -= visibleTop - noteTop;
    } else if (noteBottom > visibleBottom) {
      container.scrollTop += 2*(noteBottom - visibleBottom);
    }
  }

  /**
   * Resalta la nota activa (cursor de interpretación en verde)
   * Congelando el movimiento automático de la partitura
   * @param {number} index
   */
  setActiveNote(index) {
    this.activeEventIndex = index;
    this.container.querySelectorAll('.active-score-note').forEach(el => {
      el.classList.remove('active-score-note');
    }); 

    const targetEl = this.renderedNotesMap.get(index);
    if (targetEl) {
      targetEl.classList.add('active-score-note');
      // Movimiento automático congelado según requerimiento: sin scrollIntoView
    }
    
    const activeSvgNote = this.renderedNotesMap.get(index);

    if (activeSvgNote) {
      this._scrollPageToScore();
      this._scrollToActiveNote(activeSvgNote);
}
  }

  /**
   * Renderizado continuo en sistemas usando VexFlow 4
   */
  _renderContinuousVexflow(container) {
    const VF = window.Vex.Flow;
    const allEvents = this.scoreModel.flattenedEvents;
    const totalEvents = allEvents.length;

    // Calcular el ancho disponible y el número de notas por sistema.
    const measuredWidth = container.clientWidth - 40;

    const containerWidth = Math.max(
      760,
      measuredWidth > 0 ? measuredWidth : this.options.systemWidth
    );

    // Respetar la configuración del constructor cuando sea válida.
    // Si no se especifica, calcular una cantidad según el ancho.
    const configuredNotes = Number(this.options.notesPerSystem);

    const notesPerSystem =
      Number.isInteger(configuredNotes) && configuredNotes >= 1
        ? configuredNotes
        : Math.max(6, Math.min(20, Math.floor(containerWidth / 100)));
    // Dividir los eventos en sistemas (renglones continuos)
    const systems = [];
    for (let i = 0; i < totalEvents; i += notesPerSystem) {
      systems.push(allEvents.slice(i, i + notesPerSystem));
    }

    let lastDynamic = null;

    systems.forEach((sysEvents, sysIdx) => {
      const sysDiv = document.createElement('div');
      sysDiv.className = 'score-system-row';
      container.appendChild(sysDiv);

      const staveHeight = 200;
      const renderer = new VF.Renderer(sysDiv, VF.Renderer.Backends.SVG);
      renderer.resize(containerWidth, staveHeight);
      const context = renderer.getContext();

      // Ajuste de colores claros para editorial de partitura: tinta negra sobre papel claro
      context.setFont('Bravura, Arial', 10, '').setBackgroundFillStyle('transparent');
      context.setFillStyle('#111827');
      context.setStrokeStyle('#111827');

      // Crear Stave para este sistema con margen optimizado
      const stave = new VF.Stave(15, 20, containerWidth+50);
      stave.addClef('treble'); // Clave de sol en cada sistema

      // Barline final en el último sistema
      if (sysIdx === systems.length - 1) {
        stave.setEndBarType(VF.Barline.type.END);
      } else {
        stave.setEndBarType(VF.Barline.type.SINGLE);
      }

      stave.setContext(context).draw();

      // Generar VexFlow StaveNotes
      const vfNotes = [];
      const noteMapLocal = [];
      const noteRenderInfo = [];
      const dynamicPositions = [];

      sysEvents.forEach((ev) => {
        const vexKey = (ev.pitch && ev.pitch.vexKey) ? ev.pitch.vexKey : 'a/4';
        const dur = (ev.rhythm && ev.rhythm.vexDuration) ? ev.rhythm.vexDuration : 'q';

        try {
          const staveNote = new VF.StaveNote({
            clef: 'treble',
            keys: [vexKey],
            duration: dur,
            auto_stem: false
          });

          // 1. DETERMINACIÓN ESTRICTA DE PLICA Y CABEZA DE NOTA:
          // En clave de sol, B4 (MIDI 71) es la línea media.
          // Notas < 71: plica hacia ARRIBA (1). Cabeza abajo -> articulación en BELOW (4).
          // Notas >= 71: plica hacia ABAJO (-1). Cabeza arriba -> articulación en ABOVE (3).
          const keyMatch = vexKey.match(/^([a-g])(?:[#b]+)?\/(-?\d+)$/i);

          let isStemUp = true;

          if (keyMatch) {
            const letter = keyMatch[1].toLowerCase();
            const octave = Number(keyMatch[2]);

            const diatonicSteps = {
              c: 0,
              d: 1,
              e: 2,
              f: 3,
              g: 4,
              a: 5,
              b: 6
            };

            const notePosition = octave * 7 + diatonicSteps[letter];
            const middleLinePosition = 4 * 7 + diatonicSteps.b;

            isStemUp = notePosition < middleLinePosition;
          } else if (ev.pitch?.midi != null) {
            // Alternativa si la clave no se puede interpretar.
            isStemUp = ev.pitch.midi < 71;
          }

          const stemDir = isStemUp ? 1 : -1;
          staveNote.setStemDirection(stemDir);

          // La articulación se coloca al lado opuesto de la plica.
          const HEAD_POSITION = isStemUp ? 4 : 3;

          // Alteraciones
          if (ev.pitch.accidental === '#' || (ev.pitch.step && ev.pitch.step.includes('#'))) {
            staveNote.addModifier(new VF.Accidental('#'), 0);
          } else if (ev.pitch.accidental === 'b' || (ev.pitch.step && ev.pitch.step.includes('b'))) {
            staveNote.addModifier(new VF.Accidental('b'), 0);
          }

          // Puntillos
          if (ev.rhythm.dots && ev.rhythm.dots > 0) {
            staveNote.addDotToAll();
          }

          // 2. ARTICULACIONES VISIBLES SOBRE LA CABEZA DE LA NOTA
          const art = (ev.articulation || '').toLowerCase();
          let artCode = null;
          let techniqueText = null;

          if (art === 'staccato' || art === 'spiccato') {
            artCode = 'a.';
          } else if (art === 'staccatissimo') {
            artCode = 'av';
          } else if (art === 'accentato') {
            artCode = 'a>';
          } else if (art === 'marcato' || art === 'martellato') {
            artCode = 'a^';
          } else if (art === 'tenuto' || art === 'sostenuto' || art === 'sustain') {
            artCode = 'a-'; // Línea de sostenuto / tenuto
          } else if (['sul_tasto', 'flautando', 'col_legno_synth', 'col_legno', 'perdendosi', 'molto_legato'].includes(art)) {
            artCode = 'a-';
            techniqueText = art.replace(/_/g, ' ');
          }

          if (artCode) {
            const artModifier = new VF.Articulation(artCode).setPosition(HEAD_POSITION);
            staveNote.addModifier(artModifier, 0);
          }

          if (techniqueText) {
            const techAnnotation = new VF.Annotation(techniqueText)
              .setVerticalJustification(1) // TOP
              .setTextLine(1)
              .setFont("Times New Roman, serif", 11, "italic");
            staveNote.addModifier(techAnnotation, 0);
          }

         // 3. Registrar dinámicas para dibujarlas manualmente
          if (ev.dynamic && ev.dynamic !== lastDynamic) {
            dynamicPositions.push({
              note: staveNote,
              text: ev.dynamic
            });

            ev.hasDynamicChange = true;
            lastDynamic = ev.dynamic;
          } else {
            ev.hasDynamicChange = false;
          }

          // 4. Indicación visual de calderón al final de frase (reemplaza cesura)
          if (ev.isLastInPhrase) {
            const fermata = new VF.Articulation('a@a').setPosition(3); // 3 = ABOVE
            staveNote.addModifier(fermata, 0);
          }

          vfNotes.push(staveNote);
          noteMapLocal.push(ev);

          noteRenderInfo.push({
            event: ev,
            stemDir,
            duration: String(dur),
            isLastInPhrase: Boolean(ev.isLastInPhrase)
          });


        } catch (noteErr) {
          console.warn("Error creating StaveNote:", vexKey, dur, noteErr);
        }
      });

      if (vfNotes.length > 0) {
        try {
          // Utilizar Voice en modo SOFT para compás libre.
          const voice = new VF.Voice({
            num_beats: Math.max(4, vfNotes.length * 2),
            beat_value: 4
          }).setMode(VF.Voice.Mode.SOFT);

          voice.addTickables(vfNotes);

          const leftNotationMargin = 70;
          const rightNotationMargin = 30;

          const notationWidth = Math.max(
            100,
            containerWidth - leftNotationMargin - rightNotationMargin
          );

          const formatter = new VF.Formatter();

          formatter.joinVoices([voice]);
          formatter.format([voice], notationWidth);

          // 1. Calcular los grupos de notas que llevarán barras.
          const beamGroups = this._createBeamGroups(
            vfNotes,
            noteRenderInfo
          );

          // 2. Crear las barras ANTES de dibujar las notas.
          // false conserva las direcciones de plica asignadas.
          const beams = [];

          beamGroups.forEach(group => {
            try {
              beams.push(new VF.Beam(group, false));
            } catch (beamErr) {
              console.warn(
                "Error creating beam group:",
                beamErr
              );
            }
          });
          

          // 3. Dibujar la voz con las barras ya creadas.
          voice.draw(context, stave);

          // 4. Dibujar las barras de agrupación.
          beams.forEach(beam => {
            try {
              beam.setContext(context).draw();
            } catch (beamErr) {
              console.warn(
                "Error drawing beam:",
                beamErr
              );
            }
          });

          // 5. Dibujar dinámicas a una altura uniforme
          const dynamicY = stave.getYForLine(4) + 30;

          context.setFont(
            "Times New Roman, Georgia, serif",
            14,
            "bold",
            "italic"
          );

          dynamicPositions.forEach(({ note, text }) => {
            const x = note.getAbsoluteX();

            // Coordenada vertical de la cabeza de la nota
            const noteY = note.getYs()[0];

            // Desfase respecto a la línea central del pentagrama
            const middleLineY = stave.getYForLine(2);
            const offset = (noteY - middleLineY) * 0.25;

            context.fillText(text, x - 15, dynamicY + offset+10);
          });

          // 6. Mapear elementos SVG para interactividad.
          const svgNotes = sysDiv.querySelectorAll('.vf-stavenote');

          svgNotes.forEach((svgEl, idx) => {
            const ev = noteMapLocal[idx];
            if (!ev) return;

            this.renderedNotesMap.set(ev.globalIndex, svgEl);

            svgEl.style.cursor = 'pointer';
            svgEl.setAttribute('data-note-index', ev.globalIndex);

            svgEl.addEventListener('click', () => {
              if (this.onNoteClick) this.onNoteClick(ev);
              this.setActiveNote(ev.globalIndex);
            });
          });
        } catch (formatErr) {
          console.error("Error formatting voice in system:", formatErr);
        }
      }
    });

    if (this.activeEventIndex >= 0) {
      this.setActiveNote(this.activeEventIndex);
    }
  }

/**
 * Agrupa notas consecutivas que pueden compartir barras.
 * Respeta los cambios de dirección de plica y los finales de frase.
 */
_createBeamGroups(notes, noteRenderInfo) {
  const groups = [];
  let currentGroup = [];

  const isBeamable = (duration) => {
    // Admite corcheas, semicorcheas y figuras menores.
    // Las negras y figuras más largas no se agrupan.
    const normalized = String(duration).replace(/[dD]+$/, '');
    const denominator = Number.parseInt(normalized, 10);

    return (
      /^(8|16|32|64|128)$/.test(normalized) &&
      denominator >= 8
    );
  };

  const flushGroup = () => {
    if (currentGroup.length >= 2) {
      groups.push(currentGroup);
    }

    currentGroup = [];
  };

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const info = noteRenderInfo[i];

    if (!info || !isBeamable(info.duration)) {
      flushGroup();
      continue;
    }

    if (currentGroup.length > 0) {
      const previousInfo =
        noteRenderInfo[currentGroup[currentGroup.length - 1].index];

      const sameStemDirection =
        previousInfo.stemDir === info.stemDir;

      const previousEndsPhrase =
        previousInfo.isLastInPhrase;

      if (!sameStemDirection || previousEndsPhrase) {
        flushGroup();
      }
    }

    currentGroup.push({
      note,
      index: i
    });

    // El calderón marca el final del grupo de frase.
    if (info.isLastInPhrase) {
      flushGroup();
    }
  }

  flushGroup();

  return groups.map(group => group.map(item => item.note));
}
  
  /**
   * Renderizado nativo SVG de máxima fidelidad (fallback independiente)
   */
  _renderNativeSVG(container) {
    const allEvents = this.scoreModel.flattenedEvents;
    const sysDiv = document.createElement('div');
    sysDiv.className = 'native-svg-score';

    const w = 1000;
    const notesPerRow = 8;
    const rowHeight = 120;
    const numRows = Math.ceil(allEvents.length / notesPerRow);
    const h = numRows * rowHeight + 40;

    let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" xmlns="http://www.w3.org/2000/svg">`;

    let nativeLastDynamic = null;

    for (let r = 0; r < numRows; r++) {
      const topY = r * rowHeight + 40;
      // 5 líneas del pentagrama
      for (let l = 0; l < 5; l++) {
        const ly = topY + l * 10;
        svg += `<line x1="40" y1="${ly}" x2="${w - 40}" y2="${ly}" stroke="#2d3748" stroke-width="1.2" />`;
      }
      // Clave de sol símbolo
      svg += `<text x="50" y="${topY + 36}" font-family="serif" font-size="36" fill="#1a202c">𝄞</text>`;

      const slice = allEvents.slice(r * notesPerRow, (r + 1) * notesPerRow);
      const stepX = (w - 180) / Math.max(1, slice.length);

      slice.forEach((ev, i) => {
        const nx = 120 + i * stepX;
        // Calcular posición vertical respecto a línea central B4 (MIDI 71 = topY + 20)
        const midi = ev.pitch.midi;
        const semitoneFromB4 = midi - 71;
        const ny = (topY + 20) - (semitoneFromB4 * 3.5);

        // Dinámica cambiante debajo
        let dynSvg = '';
        if (ev.dynamic && ev.dynamic !== nativeLastDynamic) {
          dynSvg = `<text x="${nx - 8}" y="${topY + 68}" font-family="serif" font-size="13" font-style="italic" font-weight="bold" fill="#0f172a">${ev.dynamic}</text>`;
          nativeLastDynamic = ev.dynamic;
        }

        // Articulación sobre/junto a la cabeza de la nota
        const headUp = midi >= 71;
        const artY = headUp ? ny - 8 : ny + 10;
        let artChar = '';
        if (ev.articulation === 'staccato' || ev.articulation === 'spiccato') artChar = '•';
        else if (ev.articulation === 'tenuto' || ev.articulation === 'sostenuto') artChar = '—';
        else if (ev.articulation === 'accentato') artChar = '>';
        else if (ev.articulation === 'marcato') artChar = '^';

        svg += `
          <g class="native-note-g" data-idx="${ev.globalIndex}" style="cursor: pointer;">
            <ellipse cx="${nx}" cy="${ny}" rx="6" ry="4.5" fill="#0f172a" transform="rotate(-20 ${nx} ${ny})" />
            <line x1="${nx + 5}" y1="${ny}" x2="${nx + 5}" y2="${ny - 28}" stroke="#0f172a" stroke-width="1.8" />
            ${artChar ? `<text x="${nx - 4}" y="${artY}" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0f172a">${artChar}</text>` : ''}
            ${dynSvg}
            <text x="${nx - 8}" y="${topY + 54}" font-family="monospace" font-size="10" fill="#64748b">${ev.pitch.noteName}</text>
            ${ev.isLastInPhrase ? `<text x="${nx - 6}" y="${topY - 6}" font-family="serif" font-size="22" fill="#0f172a">𝄐</text>` : ''}
          </g>
        `;
      });
    }

    svg += `</svg>`;
    sysDiv.innerHTML = svg;
    container.appendChild(sysDiv);

    // Eventos de clic
    sysDiv.querySelectorAll('.native-note-g').forEach(el => {
      const idx = parseInt(el.getAttribute('data-idx'), 10);
      const ev = allEvents[idx];
      this.renderedNotesMap.set(idx, el);
      el.addEventListener('click', () => {
        if (this.onNoteClick && ev) this.onNoteClick(ev);
        this.setActiveNote(idx);
      });
    });

    if (this.activeEventIndex >= 0) {
      this.setActiveNote(this.activeEventIndex);
    }
  }
}
