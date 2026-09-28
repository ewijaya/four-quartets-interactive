/**
 * Rights guard. After a build, make sure the private text did not leak into dist/
 * (HTML, JS, JSON and the gzip-compressed Pagefind index) when the build is meant
 * to use sample text. Imported-text builds warn unless publication was explicitly
 * selected through npm run build:hosted / npm run deploy.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { PRIVATE_JSON, textMode } from "../src/lib/text/load";
import type { TextBundle } from "../src/lib/model";

const DIST = "dist";
const isPublic = process.env.STILLPOINT_PUBLIC === "1";

function* walk(dir: string): Generator<string> {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

function readMaybeGzip(p: string): string {
  const buf = readFileSync(p);
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    try {
      return gunzipSync(buf).toString("utf8");
    } catch {
      return "";
    }
  }
  return buf.toString("utf8");
}

function main() {
  if (!existsSync(DIST)) throw new Error("dist/ not found — run astro build first.");
  const mode = textMode();
  if (!existsSync(PRIVATE_JSON)) {
    console.log(`check-dist: no private text present; build used the ${mode} text. OK.`);
    return;
  }
  if (mode === "private" && !isPublic) {
    if (process.env.STILLPOINT_PUBLISH_TEXT === "1") {
      console.log("check-dist: imported text included for the explicitly selected hosted edition.");
    } else {
      console.warn("check-dist: this build contains imported text. Use npm run deploy only when publication is intended (see RIGHTS.md).");
    }
    return;
  }
  const bundle = JSON.parse(readFileSync(PRIVATE_JSON, "utf8")) as TextBundle;
  // Every line with its position, so passages (consecutive lines) can be recognised.
  const all = bundle.quartets.flatMap((q) =>
    q.movements.flatMap((m) => m.stanzas.flatMap((s) => s.lines.map((l) => ({ key: `${q.code}.${m.n}`, n: l.n, text: l.text })))),
  );
  const lines = all.filter((l) => l.text.length >= 16);
  const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
  // Lemmas (≤ 6 words) may legitimately equal a whole short line, scattered through a
  // page as labels. A leak looks different: a longer line, a passage of consecutive
  // lines, or a great many lines in one file.
  const hits: string[] = [];
  for (const file of walk(DIST)) {
    if (!/\.(html|js|mjs|json|txt|xml|css|pf_fragment|pf_index|pf_meta|pagefind)$/.test(file)) continue;
    const body = readMaybeGzip(file);
    const found = lines.filter((l) => body.includes(l.text));
    const long = found.find((l) => words(l.text) > 6);
    if (long) {
      hits.push(`${file}: contains a private line of ${words(long.text)} words (${long.key}.${long.n})`);
      continue;
    }
    const at = new Set(found.map((l) => `${l.key}.${l.n}`));
    const passage = found.find((l) => at.has(`${l.key}.${l.n + 1}`) && at.has(`${l.key}.${l.n + 2}`));
    if (passage) {
      hits.push(`${file}: contains consecutive private lines from ${passage.key}.${passage.n}`);
      continue;
    }
    if (found.length > 40) hits.push(`${file}: contains ${found.length} private lines`);
  }
  if (hits.length) {
    console.error(`check-dist: ✗ private text found in ${hits.length} file(s):`);
    hits.slice(0, 20).forEach((h) => console.error("  " + h));
    process.exit(1);
  }
  console.log(`check-dist: ✓ scanned dist/ — no private text (${lines.length} lines checked).`);
}

main();
