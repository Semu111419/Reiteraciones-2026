/**
 * ScoreModel.js
 * Modelo formal de la partitura de violín.
 * Organiza los eventos generados por CompositionEngine en sistemas, frases y compases libres con cesuras.
 */

export class ScoreModel {
  /**
   * @param {Array<Object>} phrases
   * @param {string} sectionName
   */
  constructor(phrases = [], sectionName = "birth") {
    this.phrases = phrases;
    this.sectionName = sectionName;
    this.flattenedEvents = [];

    this._buildFlatList();
  }

  _buildFlatList() {
    this.flattenedEvents = [];
    this.phrases.forEach((phrase, phraseIdx) => {
      phrase.events.forEach((ev, evIdx) => {
        this.flattenedEvents.push({
          ...ev,
          globalIndex: this.flattenedEvents.length,
          phraseIndex: phraseIdx,
          isLastInPhrase: evIdx === phrase.events.length - 1
        });
      });
    });
  }

  get totalEvents() {
    return this.flattenedEvents.length;
  }

  get totalPhrases() {
    return this.phrases.length;
  }

  getEventAt(globalIndex) {
    return this.flattenedEvents[globalIndex] || null;
  }
}
