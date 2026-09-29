/**
 * The word popover: tap a word in the verse (or a glossed word) to see its gloss,
 * if it has one, and every place the word recurs in the Quartets. Loaded on first
 * use; the concordance itself is built in the browser from /concordance.json.
 */
import { buildConcordance, indexable, lineLabel, relatedForms, tokens, wordKey, type Concordance } from "../concordance";
import { announce } from "./a11y";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const QUARTET_PATH: Record<string, string> = { BN: "burnt-norton", EC: "east-coker", DS: "the-dry-salvages", LG: "little-gidding" };
const TITLE: Record<string, string> = { BN: "Burnt Norton", EC: "East Coker", DS: "The Dry Salvages", LG: "Little Gidding" };
const FIRST = 8;

interface Data {
  source: string;
  c: Concordance;
}
let data: Promise<Data | null> | null = null;
function load(): Promise<Data | null> {
  data ??= fetch(`${BASE}/concordance.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { source: string; lines: Array<[string, string]> } | null) =>
      j ? { source: j.source, c: buildConcordance(j.lines.map(([id, text]) => ({ id, text }))) } : null,
    )
    .catch(() => null);
  return data;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hrefFor = (id: string) => {
  const [q, m, n] = id.split(".");
  return `${BASE}/${QUARTET_PATH[q!]}/${m}#${n}`;
};

/** The printed word under a point in the verse, if any. */
export function wordAt(x: number, y: number): { word: string; key: string; line: HTMLElement } | null {
  const d = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let node: Node | null = null;
  let offset = 0;
  const p = d.caretPositionFromPoint?.(x, y);
  if (p) {
    node = p.offsetNode;
    offset = p.offset;
  } else {
    const r = d.caretRangeFromPoint?.(x, y);
    if (r) {
      node = r.startContainer;
      offset = r.startOffset;
    }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const line = (node.parentElement as HTMLElement | null)?.closest<HTMLElement>(".line");
  if (!line || !node.parentElement?.closest(".lt")) return null;
  const t = tokens((node as Text).data).find((tk) => offset >= tk.start && offset <= tk.end);
  if (!t) return null;
  // The caret APIs snap to the nearest position; make sure the point is on the word itself.
  const range = document.createRange();
  range.setStart(node, t.start);
  range.setEnd(node, t.end);
  const hit = [...range.getClientRects()].some((r) => x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2);
  return hit ? { word: t.word, key: t.key, line } : null;
}

export class WordPop {
  private el: HTMLElement | null = null;
  private from: HTMLElement | null = null;
  private offs: Array<() => void> = [];

  constructor(private root: HTMLElement) {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && this.el) {
        e.stopPropagation();
        this.close(true);
      }
    };
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      // A click on a control that has since been removed (the line menu) opened this popover.
      if (!t.isConnected) return;
      if (this.el && !this.el.contains(t) && !t.closest(".gl") && !t.closest(".lt")) this.close(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("click", onDoc);
    this.offs.push(
      () => document.removeEventListener("keydown", onKey, true),
      () => document.removeEventListener("click", onDoc),
    );
  }

  destroy() {
    this.close(false);
    this.offs.forEach((f) => f());
  }

  close(restore: boolean) {
    this.el?.remove();
    this.el = null;
    if (restore) this.from?.focus({ preventScroll: true });
    this.from = null;
  }

  private shell(line: HTMLElement, label: string, from: HTMLElement | null): HTMLElement {
    this.close(false);
    const el = document.createElement("div");
    el.className = "word-pop";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", label);
    el.tabIndex = -1;
    line.after(el);
    this.el = el;
    this.from = from;
    el.addEventListener("click", (e) => this.onClick(e, line));
    return el;
  }

  /** Words of a line as buttons: the keyboard route into the concordance. */
  openLine(line: HTMLElement, from: HTMLElement | null) {
    const text = line.querySelector(".lt")?.textContent ?? "";
    const seen = new Set<string>();
    const words = tokens(text).filter((t) => indexable(t.key) && !seen.has(t.key) && seen.add(t.key));
    const el = this.shell(line, `Words in line ${line.dataset.n}`, from);
    el.innerHTML =
      `<p class="word-pop__head"><span class="word-pop__title">Words in line ${esc(line.dataset.n ?? "")}</span>` +
      `<button type="button" class="word-pop__close" data-wp="close" aria-label="Close">×</button></p>` +
      (words.length
        ? `<p class="word-pop__words">${words.map((w) => `<button type="button" data-wp="word" data-key="${esc(w.key)}" data-word="${esc(w.word)}">${esc(w.word)}</button>`).join("")}</p>`
        : `<p class="word-pop__note">No words to look up in this line.</p>`);
    (el.querySelector<HTMLElement>("[data-wp=word]") ?? el.querySelector<HTMLElement>("[data-wp=close]"))?.focus({ preventScroll: true });
  }

  /** Gloss (if any) and concordance for one word. */
  async open(line: HTMLElement, word: string, opts: { key?: string; glossIds?: string[]; from?: HTMLElement | null; focus?: boolean } = {}) {
    const key = opts.key ?? wordKey(word);
    const el = this.shell(line, `“${word}” in Four Quartets`, opts.from ?? null);
    const glosses = (opts.glossIds ?? [])
      .map((id) => this.root.querySelector<HTMLElement>(`#g-${CSS.escape(id)} .gloss__body`))
      .filter((x): x is HTMLElement => !!x)
      .map((b) => `<div class="word-pop__gloss">${b.innerHTML}</div>`)
      .join("");
    el.innerHTML =
      `<p class="word-pop__head"><span class="word-pop__title">${esc(word)}</span><span class="word-pop__count" aria-live="polite">…</span>` +
      `<button type="button" class="word-pop__close" data-wp="close" aria-label="Close">×</button></p>${glosses}<div class="word-pop__hits"></div>`;
    if (opts.focus) el.querySelector<HTMLElement>(".word-pop__close")?.focus({ preventScroll: true });
    const d = await load();
    if (this.el !== el) return; // closed or replaced while loading
    this.renderHits(el, line, key, word, d, false);
  }

  private renderHits(el: HTMLElement, line: HTMLElement, key: string, word: string, d: Data | null, all: boolean) {
    const count = el.querySelector(".word-pop__count")!;
    const box = el.querySelector(".word-pop__hits")!;
    if (!d || d.source !== "private" || !d.c.lines.length) {
      count.textContent = "";
      box.innerHTML = `<p class="word-pop__note">Where each word recurs is shown in the edition with the poem's text; this build uses placeholder lines.</p>`;
      return;
    }
    const hits = indexable(key) ? (d.c.index.get(key) ?? []) : [];
    const here = line.dataset.line;
    count.textContent = hits.length ? ` · ${hits.length === 1 ? "once" : `${hits.length} times`} in the Quartets` : "";
    if (!hits.length) {
      box.innerHTML = `<p class="word-pop__note">${indexable(key) ? "Not found in the concordance." : "A common word: not indexed."}</p>`;
      return;
    }
    // One row per line, with every occurrence in it marked.
    const rows: Array<{ line: number; spans: Array<[number, number]> }> = [];
    for (const h of hits) {
      const last = rows[rows.length - 1];
      if (last && last.line === h.line) last.spans.push([h.start, h.end]);
      else rows.push({ line: h.line, spans: [[h.start, h.end]] });
    }
    const shown = all ? rows : rows.slice(0, FIRST);
    let lastQ = "";
    const items = shown
      .map((row) => {
        const l = d.c.lines[row.line]!;
        const q = l.id.split(".")[0]!;
        const group = q !== lastQ ? `<li class="word-pop__q">${TITLE[q]}</li>` : "";
        lastQ = q;
        let kwic = "";
        let at = 0;
        for (const [s, e] of row.spans) {
          kwic += `${esc(l.text.slice(at, s))}<mark>${esc(l.text.slice(s, e))}</mark>`;
          at = e;
        }
        kwic += esc(l.text.slice(at));
        const cur = l.id === here ? ` aria-current="true"` : "";
        return `${group}<li><a href="${hrefFor(l.id)}"${cur}>${lineLabel(l.id).replace(/^\w+ /, "")}</a> <span class="word-pop__kwic">${kwic}</span></li>`;
      })
      .join("");
    const more = !all && rows.length > FIRST ? `<button type="button" class="word-pop__more" data-wp="all">Show all ${rows.length} lines</button>` : "";
    const rel = relatedForms(d.c, key);
    const relHtml = rel.length
      ? `<p class="word-pop__rel"><span>Other forms</span> ${rel
          .slice(0, 8)
          .map((r) => `<button type="button" data-wp="word" data-key="${esc(r.key)}" data-word="${esc(r.key)}">${esc(r.key)} <span>${r.count}</span></button>`)
          .join("")}</p>`
      : "";
    box.innerHTML = `<ol class="word-pop__list">${items}</ol>${more}${relHtml}`;
    el.dataset.key = key;
    el.dataset.word = word;
    announce(`${word}: ${hits.length === 1 ? "once" : `${hits.length} times`} in Four Quartets`);
  }

  private onClick(e: MouseEvent, line: HTMLElement) {
    const t = e.target as HTMLElement;
    const act = t.closest<HTMLElement>("[data-wp]");
    if (!act || !this.el) return;
    e.stopPropagation();
    const what = act.dataset.wp;
    if (what === "close") this.close(true);
    else if (what === "word") void this.open(line, act.dataset.word!, { key: act.dataset.key!, from: this.from, focus: true });
    else if (what === "all") {
      const el = this.el;
      void load().then((d) => this.el === el && this.renderHits(el, line, el.dataset.key!, el.dataset.word!, d, true));
    }
  }
}
