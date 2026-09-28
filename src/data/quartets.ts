import type { Element, MovementN, QuartetCode, QuartetId } from "../lib/model";

export interface QuartetInfo {
  id: QuartetId;
  code: QuartetCode;
  title: string;
  /** Title without the article, for sorting and compact labels. */
  short: string;
  year: number;
  element: Element;
  place: string;
  placeId: string;
  /** One sentence for the title page; our words, not Eliot's. */
  summary: string;
  /** Roman numeral index in the sequence. */
  ordinal: "I" | "II" | "III" | "IV";
}

export const QUARTETS: QuartetInfo[] = [
  {
    id: "burnt-norton",
    code: "BN",
    title: "Burnt Norton",
    short: "Burnt Norton",
    year: 1936,
    element: "air",
    place: "A manor garden in Gloucestershire",
    placeId: "burnt-norton",
    summary:
      "A walk through an empty garden in late summer becomes a meditation on time, memory and the moments that seem to stand outside both.",
    ordinal: "I",
  },
  {
    id: "east-coker",
    code: "EC",
    title: "East Coker",
    short: "East Coker",
    year: 1940,
    element: "earth",
    place: "A Somerset village; Eliot's ashes rest in St Michael's church",
    placeId: "east-coker",
    summary:
      "The village his ancestors left becomes a way of thinking about generations, decay and the humility of beginning again.",
    ordinal: "II",
  },
  {
    id: "the-dry-salvages",
    code: "DS",
    title: "The Dry Salvages",
    short: "Dry Salvages",
    year: 1941,
    element: "water",
    place: "Rocks off Cape Ann, Massachusetts; the Mississippi",
    placeId: "dry-salvages",
    summary:
      "The river of his childhood and the sea of his summers frame a meditation on suffering, prayer and time that is not ours.",
    ordinal: "III",
  },
  {
    id: "little-gidding",
    code: "LG",
    title: "Little Gidding",
    short: "Little Gidding",
    year: 1942,
    element: "fire",
    place: "Nicholas Ferrar's seventeenth-century community; written during the Blitz",
    placeId: "little-gidding",
    summary:
      "A winter visit to a small chapel and a dawn walk through bombed London converge on history, purgation and a final reconciliation.",
    ordinal: "IV",
  },
];

export const QUARTET_BY_ID = Object.fromEntries(QUARTETS.map((q) => [q.id, q])) as Record<QuartetId, QuartetInfo>;
export const QUARTET_BY_CODE = Object.fromEntries(QUARTETS.map((q) => [q.code, q])) as Record<QuartetCode, QuartetInfo>;

export const ROMAN: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V" };
export const ORDINAL_WORD: Record<number, string> = {
  1: "first",
  2: "second",
  3: "third",
  4: "fourth",
  5: "fifth",
};

/**
 * The parallel functions of the five movements across all four quartets.
 * This framing follows the structural reading first set out by Helen Gardner
 * (The Art of T. S. Eliot, 1949); the wording here is ours and interpretive.
 */
export const MOVEMENT_FUNCTIONS: Record<MovementN, { name: string; gloss: string }> = {
  1: {
    name: "Place and time",
    gloss:
      "Each quartet opens in a particular place and moves between a general proposition about time and a remembered or imagined scene — statement and counter-statement, like the exposition of a sonata movement.",
  },
  2: {
    name: "Lyric, then its critique",
    gloss:
      "A tightly formed lyric is followed by a looser, conversational passage that questions or restates it in plainer terms.",
  },
  3: {
    name: "Descent",
    gloss:
      "A movement into darkness, emptiness or journeying — the Underground, the dark, the voyage, the scaffold of history — where the way down becomes a kind of discipline.",
  },
  4: {
    name: "The short lyric",
    gloss:
      "The briefest movement in each quartet: a compressed lyric, close to prayer or hymn, standing like a slow movement at the centre of the close.",
  },
  5: {
    name: "Words and resolution",
    gloss:
      "A reflection on language and art — the difficulty of words, the pattern of music — that gathers the quartet's themes toward reconciliation.",
  },
};

export const ELEMENT_GLYPH: Record<Element, string> = {
  air: "🜁",
  earth: "🜃",
  water: "🜄",
  fire: "🜂",
};
