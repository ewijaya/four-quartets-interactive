/**
 * A plain-text preview of an annotation's prose: the opening sentence or two, without
 * markup, for hover previews and cards. It is our own commentary, never the poem.
 */

/** Words whose full stop does not end a sentence. */
const ABBREVIATIONS = /(?:^|[\s(‘“"'])(?:St|Mr|Mrs|Ms|Dr|Prof|Fr|Rev|Lt|Col|Gen|Sr|Jr|vol|vols|ch|c|cf|ed|eds|no|nos|p|pp|ll|l|fl|b|d|ca|esp|trans|repr|[A-Z])\.$/;

function plain(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_`]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split running text into sentences, keeping initials ("T. S. Eliot") and "St." together. */
export function sentences(text: string): string[] {
  const out: string[] = [];
  let from = 0;
  const end = /[.!?]['’”")]*(?=\s+[A-Z‘“"(])/g;
  for (let m = end.exec(text); m; m = end.exec(text)) {
    const cut = m.index + m[0].length;
    if (ABBREVIATIONS.test(text.slice(from, m.index + 1))) continue;
    out.push(text.slice(from, cut).trim());
    from = cut;
  }
  const rest = text.slice(from).trim();
  if (rest) out.push(rest);
  return out;
}

/**
 * The opening of a note's body: whole sentences up to `max` characters, stopping once it
 * has at least `enough`. A first sentence longer than `max` is cut at a word with an ellipsis.
 */
export function excerpt(markdown: string, max = 200, enough = 90): string {
  const firstParagraph = markdown.replace(/^---[\s\S]*?\n---\s*/, "").trim().split(/\n\s*\n/)[0] ?? "";
  const list = sentences(plain(firstParagraph));
  if (!list.length) return "";
  let out = list[0]!;
  if (out.length > max) {
    const cut = out.slice(0, max - 1);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).replace(/[\s,;:–—-]+$/, "")}…`;
  }
  for (let i = 1; i < list.length && out.length < enough; i++) {
    if (out.length + 1 + list[i]!.length > max) break;
    out += ` ${list[i]}`;
  }
  return out;
}
