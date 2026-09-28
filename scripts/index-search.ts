/**
 * Build the Pagefind index: every page marked data-pagefind-body (movement variants,
 * note permalinks, motif and place pages) plus one custom record per verse line so
 * that search can land on an exact line (/burnt-norton/2#14).
 */
import * as pagefind from "pagefind";
import { loadText } from "../src/lib/text/load";
import { QUARTET_BY_CODE, ROMAN } from "../src/data/quartets";

const BASE = (process.env.BASE_PATH ?? "/").replace(/\/$/, "");

async function main() {
  const { index, errors } = await pagefind.createIndex({ forceLanguage: "en" });
  if (!index) throw new Error(`pagefind: ${errors.join(", ")}`);
  const dir = await index.addDirectory({ path: "dist" });
  if (dir.errors.length) throw new Error(dir.errors.join("\n"));

  const bundle = loadText();
  let lines = 0;
  for (const q of bundle.quartets) {
    const info = QUARTET_BY_CODE[q.code];
    for (const m of q.movements) {
      for (const s of m.stanzas) {
        for (const l of s.lines) {
          await index.addCustomRecord({
            url: `${BASE}/${info.id}/${m.n}#${l.n}`,
            content: l.text,
            language: "en",
            meta: { title: `${info.title} ${ROMAN[m.n]} · ${l.n}`, kind: "line" },
            filters: { quartet: [info.title], kind: ["Poem"] },
          });
          lines++;
        }
      }
    }
  }
  await index.writeFiles({ outputPath: "dist/pagefind" });
  await pagefind.close();
  console.log(`pagefind: indexed ${dir.page_count} page(s) + ${lines} line record(s) (${bundle.source} text).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
