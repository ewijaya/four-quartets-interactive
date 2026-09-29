/**
 * Long quotations: runs of more than six consecutive words of the poem in a note's
 * title or body, or a gloss (RIGHTS.md allows six at most). Words are compared by
 * their concordance keys, ignoring punctuation and line breaks within a movement, so
 * a quotation that runs over a line end is still caught.
 */
import { tokens } from "../concordance";
import type { QuartetText } from "../model";

/** The longest run of the poem's words a note may quote. */
export const QUOTE_MAX = 6;
const N = QUOTE_MAX + 1;

/** Every (QUOTE_MAX + 1)-word window of the poem → the line it starts on. */
export type QuoteIndex = Map<string, string>;

export function quoteIndex(quartets: QuartetText[]): QuoteIndex {
  const index: QuoteIndex = new Map();
  for (const q of quartets) {
    for (const mv of q.movements) {
      const words = mv.stanzas.flatMap((s) => s.lines.flatMap((l) => tokens(l.text).map((t) => ({ key: t.key, line: l.id }))));
      for (let i = 0; i + N <= words.length; i++) {
        const k = words.slice(i, i + N).map((w) => w.key).join(" ");
        if (!index.has(k)) index.set(k, words[i]!.line);
      }
    }
  }
  return index;
}

export interface LongQuote {
  /** Line id where the quoted run starts, "LG.5.27". */
  line: string;
  /** Length of the run in words (always more than QUOTE_MAX). */
  words: number;
}

/** Runs of more than QUOTE_MAX consecutive poem words in `text`, one entry per run. */
export function longQuotes(text: string, index: QuoteIndex): LongQuote[] {
  const keys = tokens(text).map((t) => t.key);
  const out: LongQuote[] = [];
  let run: LongQuote | undefined;
  for (let i = 0; i + N <= keys.length; i++) {
    const line = index.get(keys.slice(i, i + N).join(" "));
    if (line && run) run.words++;
    else if (line) out.push((run = { line, words: N }));
    else run = undefined;
  }
  return out;
}
