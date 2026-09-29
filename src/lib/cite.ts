import { BIB_BY_ID } from "../data/bibliography";
import { SOURCE_BY_ID } from "../data/sources";
import type { Citation } from "./model";

/** Short label for a citation: "Ricks & McCue 2015", "Gardner 1978", or the intertext's author. */
export function citeLabel(c: Pick<Citation, "ref">): string {
  const b = BIB_BY_ID[c.ref];
  if (b) {
    const who = b.author.replace(/\s*\(eds?\.\)/, "");
    const short = who.includes(" and ") ? who.split(" and ").map((x) => x.trim().split(" ").pop()).join(" & ") : who.split(" ").pop();
    return `${short} ${b.year}`;
  }
  const s = SOURCE_BY_ID[c.ref];
  if (s) return s.author.startsWith("Anonymous") || s.author.startsWith("The ") ? s.work : s.author;
  throw new Error(`Unknown citation ref "${c.ref}"`);
}
