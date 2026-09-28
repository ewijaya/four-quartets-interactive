/**
 * Derive the sample text's *shape* from your imported copy: stanza line counts,
 * indented and stepped lines, front-matter length. Numbers only — no words leave
 * the private text. Writes content/text-sample/shape.json; then run make-sample.
 *
 *   npm run derive-shape && npm run make-sample
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PRIVATE_JSON } from "../src/lib/text/load";
import type { TextBundle } from "../src/lib/model";

if (!existsSync(PRIVATE_JSON)) {
  console.error(`No private text at ${PRIVATE_JSON}. Run npm run import-text first.`);
  process.exit(1);
}
const bundle = JSON.parse(readFileSync(PRIVATE_JSON, "utf8")) as TextBundle;
const shape = Object.fromEntries(
  bundle.quartets.map((q) => [
    q.id,
    {
      front: q.frontMatter.length,
      movements: q.movements.map((m) =>
        m.stanzas.map((s) => {
          const out: { n: number; indent?: Array<[number, number]>; step?: number[] } = { n: s.lines.length };
          const indent = s.lines.flatMap((l, i): Array<[number, number]> => (l.indent > 0 && !l.step ? [[i + 1, l.indent]] : []));
          const step = s.lines.flatMap((l, i) => (l.step ? [i + 1] : []));
          if (indent.length) out.indent = indent;
          if (step.length) out.step = step;
          return out;
        }),
      ),
    },
  ]),
);
writeFileSync("content/text-sample/shape.json", JSON.stringify(shape, null, 1) + "\n");
const total = bundle.quartets.reduce((a, q) => a + q.lineCount, 0);
console.log(`shape: ${bundle.quartets.length} quartets, ${total} lines → content/text-sample/shape.json (numbers only)`);
