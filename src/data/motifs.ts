import type { Motif, MotifId } from "../lib/model";
import { MOTIF_OCCURRENCES } from "./motif-occurrences";

/**
 * The fourteen recurring motifs. Glosses are our own; occurrences are anchored by
 * short lemmas (≤ 6 words) and resolved against the imported text like annotations.
 */
const BASE: Array<Omit<Motif, "occurrences">> = [
  {
    id: "rose",
    name: "Rose",
    color: "#b5475f",
    gloss:
      "The rose-garden of first experience, the ‘rose of memory’, the heraldic and mystical rose — and at the close, the rose of Dante's Paradise in which fire and rose become one.",
  },
  {
    id: "garden",
    name: "Garden",
    color: "#4d7f47",
    gloss:
      "Gardens and fields where time seems to open: the empty formal garden at Burnt Norton, the children hidden in the leaves, the apple-tree remembered at the very end.",
  },
  {
    id: "fire",
    name: "Fire",
    color: "#c8541e",
    gloss:
      "Hearth fire, midsummer bonfire, the fire that destroys a city and the fire that refines — Little Gidding's element, and the Pentecostal flame.",
  },
  {
    id: "water",
    name: "Water",
    color: "#2e7f90",
    gloss:
      "The pool filled with sunlight, rain, the river as a god, the drowned and the voyagers: water as both life and dissolution.",
  },
  {
    id: "dance",
    name: "Dance",
    color: "#9b5a8a",
    gloss:
      "Pattern and movement held together: the dance at the still point, the rustic dancers of East Coker, the ‘complete consort dancing together’ of words.",
  },
  {
    id: "still-point",
    name: "Still point",
    color: "#b38a26",
    gloss:
      "The centre around which everything turns and which does not itself move — where past and future are gathered; the sequence's governing image.",
  },
  {
    id: "time",
    name: "Time",
    color: "#56708f",
    gloss:
      "Time past, present and future; chronological time and the ‘timeless moment’; the tolling bell that measures a time not ours.",
  },
  {
    id: "word-silence",
    name: "Word & silence",
    color: "#7a6552",
    gloss:
      "The struggle with words that ‘strain, crack and sometimes break’; the Word in the desert; the silence out of which speech comes.",
  },
  {
    id: "light-dark",
    name: "Light & dark",
    color: "#9a8f2e",
    gloss:
      "Sunlight and shadow, the kingfisher's flash, the darkness of God — illumination sought through darkness.",
  },
  {
    id: "dove",
    name: "Dove",
    color: "#7f8aa0",
    gloss: "In Little Gidding both the descending Holy Spirit and the German bomber over London: grace and terror in one image.",
  },
  {
    id: "bell",
    name: "Bell",
    color: "#a0703a",
    gloss: "The bell that buries the day, the bell buoy that tolls in the swell, the Angelus: sound as the measure of time and prayer.",
  },
  {
    id: "yew",
    name: "Yew",
    color: "#2f5a40",
    gloss: "The churchyard tree of death and long life, whose fingers curl down in Burnt Norton and which recurs near the end of the sequence.",
  },
  {
    id: "sea",
    name: "Sea",
    color: "#1f5f86",
    gloss: "The sea that is ‘all about us’: its voices, its wreckage, its voyagers — the element of The Dry Salvages.",
  },
  {
    id: "ascent-descent",
    name: "Ascent & descent",
    color: "#5b4a7a",
    gloss:
      "Heraclitus' ‘way up and way down’: descents into darkness and the Underground, stairs and ladders of the mystics, the dove descending.",
  },
];

export const MOTIFS: Motif[] = BASE.map((m) => ({ ...m, occurrences: MOTIF_OCCURRENCES[m.id] ?? [] }));
export const MOTIFS_BY_ID = Object.fromEntries(MOTIFS.map((m) => [m.id, m])) as Record<MotifId, Motif>;
