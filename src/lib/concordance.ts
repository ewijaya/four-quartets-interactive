/**
 * Concordance: every content word of the Quartets and where it recurs. Pure
 * functions shared by the build (the /concordance.json endpoint) and the reader's
 * word popover, which builds the index in the browser from the published lines.
 */

/** Function words that are not indexed (tapping them shows nothing). Thematic words stay in. */
export const STOPWORDS = new Set(
  (
    "a an the and or but nor of in on at to for with by from into onto upon as is are was were be been being am " +
    "it its it's that this these those which who whom whose what i me my mine we us our ours you your yours he him his " +
    "she her hers they them their theirs so if than then do does did done has have had shall will would should can " +
    "could may might must o oh"
  ).split(" "),
);

export interface Token {
  /** The word as printed (curly apostrophes kept). */
  word: string;
  /** Normalised key: lower case, straight apostrophe, possessive dropped. */
  key: string;
  start: number;
  end: number;
}

const WORD = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu;

/** Normalise a printed word to its index key. */
export function wordKey(w: string): string {
  let k = w.normalize("NFC").toLowerCase().replace(/’/g, "'");
  k = k.replace(/'s$/, "").replace(/s'$/, "s");
  return k;
}

/** Words of a line (hyphenated compounds split: "rose-garden" gives rose, garden). */
export function tokens(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(WORD)) {
    const word = m[0];
    out.push({ word, key: wordKey(word), start: m.index!, end: m.index! + word.length });
  }
  return out;
}

export const indexable = (key: string) => key.length > 1 && !STOPWORDS.has(key);

export interface ConcordanceLine {
  /** Line id, "BN.1.14". */
  id: string;
  text: string;
}

export interface Hit {
  line: number;
  start: number;
  end: number;
}

export interface Concordance {
  lines: ConcordanceLine[];
  /** key → hits in reading order. */
  index: Map<string, Hit[]>;
}

export function buildConcordance(lines: ConcordanceLine[]): Concordance {
  const index = new Map<string, Hit[]>();
  lines.forEach((l, i) => {
    for (const t of tokens(l.text)) {
      if (!indexable(t.key)) continue;
      const arr = index.get(t.key) ?? [];
      arr.push({ line: i, start: t.start, end: t.end });
      index.set(t.key, arr);
    }
  });
  return { lines, index };
}

const ENDING = /^(?:e|i)?(?:s|es|d|ed|ing|er|ers|y|ly|ness|less|lessness|ful)?$/;

/** Other indexed forms of `key` (rose → roses; dance → dancers, dancing; time → timeless). */
export function relatedForms(c: Concordance, key: string): Array<{ key: string; count: number }> {
  const stem = key.replace(/(?:ies|es|s|e|y)$/, "");
  if (stem.length < 3) return [];
  const out: Array<{ key: string; count: number }> = [];
  for (const [k, hits] of c.index) {
    if (k !== key && k.startsWith(stem) && ENDING.test(k.slice(stem.length))) out.push({ key: k, count: hits.length });
  }
  return out.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** "BN.1.14" → "BN I 14". */
export function lineLabel(id: string): string {
  const [q, m, n] = id.split(".");
  return `${q} ${["", "I", "II", "III", "IV", "V"][Number(m)]} ${n}`;
}
