/**
 * Write the true line numbers of resolved lemmas back into their `hint` fields
 * (annotation frontmatter, scene cues, motif occurrences), so that with the
 * sample text every note, cue and motif sits on the right line. Numbers only.
 *
 *   npm run sync-hints            # requires your imported private text
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PRIVATE_JSON, loadText } from "../src/lib/text/load";
import { resolveLemma, type LemmaTarget } from "../src/lib/anchors/resolve";
import { readAnnotationFiles } from "../src/lib/annotations/files";
import { CUES } from "../src/data/cues";
import { MOTIFS } from "../src/data/motifs";

if (!existsSync(PRIVATE_JSON) || loadText().source !== "private") {
  console.error("sync-hints needs the private text (npm run import-text).");
  process.exit(1);
}
const bundle = loadText();
const q = (code: string) => bundle.quartets.find((x) => x.code === code)!;
const lineOf = (code: string, t: LemmaTarget): number | null => {
  const r = resolveLemma(q(code), t);
  if (!r.matches) return null;
  const first = r.resolved.lines[0];
  return first ? Number(first.split(".")[2]) : null;
};
let changed = 0;

// Annotations (MDX frontmatter).
for (const f of readAnnotationFiles()) {
  const a = f.meta?.anchor;
  if (!a?.lemma || !a.movement) continue;
  const t: LemmaTarget = { movement: a.movement, lemma: a.lemma };
  if (a.occurrence) t.occurrence = a.occurrence;
  if (a.hint) t.hint = a.hint;
  const n = lineOf(a.quartet, t);
  if (!n || n === a.hint) continue;
  let src = readFileSync(f.file, "utf8");
  src = /^hint: \d+$/m.test(src) ? src.replace(/^hint: \d+$/m, `hint: ${n}`) : src.replace(/^(lemma: .*)$/m, `$1\nhint: ${n}`);
  writeFileSync(f.file, src);
  changed++;
}

// Cues and motif occurrences (TypeScript data: rewrite `hint: N` after each lemma literal).
function syncTs(file: string, items: Array<{ quartet: string; movement: number; lemma: string; hint?: number; occurrence?: number }>) {
  let src = readFileSync(file, "utf8");
  for (const it of items) {
    const t: LemmaTarget = { movement: it.movement as LemmaTarget["movement"], lemma: it.lemma };
    if (it.occurrence) t.occurrence = it.occurrence;
    if (it.hint) t.hint = it.hint;
    const n = lineOf(it.quartet, t);
    if (!n || n === it.hint) continue;
    const lit = JSON.stringify(it.lemma);
    const re = new RegExp(`(lemma: ${lit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}, hint: )\\d+`);
    if (re.test(src)) {
      src = src.replace(re, `$1${n}`);
      changed++;
    }
  }
  writeFileSync(file, src);
}
syncTs(
  "src/data/cues.ts",
  CUES.flatMap((c) => [c, ...(c.until ? [{ ...c.until, quartet: c.quartet, movement: c.movement }] : [])]),
);
syncTs(
  "src/data/motif-occurrences.ts",
  MOTIFS.flatMap((m) => m.occurrences),
);
console.log(`sync-hints: ${changed} hint(s) updated to true line numbers.`);
