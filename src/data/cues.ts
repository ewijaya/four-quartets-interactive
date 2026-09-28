import type { Cue } from "../lib/model";

/**
 * Scene cues: moments in the text that change the elemental scene behind it.
 * Anchored by short lemmas (≤ 6 words) and resolved like annotations; with the
 * sample text they fall back to their hint lines. A cue is active from its line
 * until the `until` line (or for a short stretch after it when none is given).
 */
export const CUES: Cue[] = [
  // Burnt Norton · air
  { id: "bn-pool", quartet: "BN", movement: 1, lemma: "filled with water out of sunlight", hint: 37, event: "pool", until: { lemma: "Then a cloud passed", hint: 41 } },
  { id: "bn-kingfisher", quartet: "BN", movement: 4, lemma: "After the kingfisher's wing", hint: 8, event: "kingfisher" },
  { id: "bn-shaft", quartet: "BN", movement: 5, lemma: "Sudden in a shaft of sunlight", hint: 32, event: "shaft", until: { lemma: "Stretching before and after", hint: 38 } },

  // East Coker · earth
  { id: "ec-dance", quartet: "EC", movement: 1, lemma: "In that open field", hint: 24, event: "dance", until: { lemma: "Dung and death", hint: 47 } },
  { id: "ec-november", quartet: "EC", movement: 2, lemma: "What is the late November doing", hint: 1, event: "wind", until: { lemma: "before the ice-cap reigns", hint: 17 } },
  { id: "ec-dark", quartet: "EC", movement: 3, lemma: "O dark dark dark", hint: 1, event: "dark", until: { lemma: "the darkness of God", hint: 13 } },
  { id: "ec-sea", quartet: "EC", movement: 5, lemma: "the vast waters", hint: 37, event: "sea" },

  // The Dry Salvages · water
  { id: "ds-sea", quartet: "DS", movement: 1, lemma: "The sea is all about us", hint: 15, event: "sea" },
  { id: "ds-fog", quartet: "DS", movement: 1, lemma: "the silent fog", hint: 36, event: "fog", until: { lemma: "The bell", hint: 50 } },
  { id: "ds-bell", quartet: "DS", movement: 1, lemma: "The tolling bell", hint: 37, event: "bell" },
  { id: "ds-lady", quartet: "DS", movement: 4, lemma: "whose shrine stands on the promontory", hint: 1, event: "shrine", until: { lemma: "Perpetual angelus", hint: 15 } },

  // Little Gidding · fire
  { id: "lg-midwinter", quartet: "LG", movement: 1, lemma: "Midwinter spring is its own season", hint: 1, event: "midwinter", until: { lemma: "Zero summer", hint: 20 } },
  { id: "lg-dark-dove", quartet: "LG", movement: 2, lemma: "dark dove with the flickering tongue", hint: 28, event: "darkdove", until: { lemma: "the blowing of the horn", hint: 95 } },
  { id: "lg-dove", quartet: "LG", movement: 4, lemma: "The dove descending breaks the air", hint: 1, event: "dove", until: { lemma: "fire by fire", hint: 7 } },
  { id: "lg-rose", quartet: "LG", movement: 5, lemma: "tongues of flame are in-folded", hint: 44, event: "rose" },
];
