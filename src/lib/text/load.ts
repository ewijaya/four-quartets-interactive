/**
 * Build-time text loader (Node only). Chooses the private text when it exists,
 * otherwise the committed sample. Environment:
 *   STILLPOINT_TEXT   = auto | sample | private   (default auto)
 *   STILLPOINT_PUBLIC = 1  → always sample; importing private text is an error
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { QuartetCode, QuartetText, TextBundle } from "../model";

export const PRIVATE_JSON = "content/text-private/quartets.json";
export const SAMPLE_JSON = "content/text-sample/quartets.json";

let cached: TextBundle | null = null;

export function textMode(): "sample" | "private" {
  const pub = process.env.STILLPOINT_PUBLIC === "1";
  const want = (process.env.STILLPOINT_TEXT ?? "auto").toLowerCase();
  if (pub) {
    if (want === "private") throw new Error("STILLPOINT_PUBLIC=1 forbids STILLPOINT_TEXT=private (see RIGHTS.md).");
    return "sample";
  }
  if (want === "sample") return "sample";
  const hasPrivate = existsSync(join(process.cwd(), PRIVATE_JSON));
  if (want === "private" && !hasPrivate) {
    throw new Error(`STILLPOINT_TEXT=private but ${PRIVATE_JSON} is missing. Run \`npm run import-text\` first.`);
  }
  return hasPrivate ? "private" : "sample";
}

export function loadText(): TextBundle {
  if (cached) return cached;
  const mode = textMode();
  const file = join(process.cwd(), mode === "private" ? PRIVATE_JSON : SAMPLE_JSON);
  if (!existsSync(file)) throw new Error(`Text bundle not found: ${file}. Run \`npm run make-sample\`.`);
  cached = JSON.parse(readFileSync(file, "utf8")) as TextBundle;
  cached.source = mode;
  return cached;
}

export function getQuartetText(code: QuartetCode): QuartetText {
  const q = loadText().quartets.find((x) => x.code === code);
  if (!q) throw new Error(`Quartet ${code} missing from the text bundle.`);
  return q;
}
