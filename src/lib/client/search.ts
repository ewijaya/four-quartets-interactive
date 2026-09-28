/**
 * Search dialog over the Pagefind index (built after the site: pages plus one record
 * per verse line). Loaded only when first opened; `/` opens it from anywhere.
 */
import { navigate } from "astro:transitions/client";
import { registerShortcut } from "./keyboard";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

interface PagefindResult {
  id: string;
  data: () => Promise<{ url: string; excerpt: string; meta: { title?: string; kind?: string }; filters: Record<string, string[]> }>;
}
interface Pagefind {
  options: (o: Record<string, unknown>) => Promise<void>;
  init: () => Promise<void>;
  debouncedSearch: (q: string, o?: Record<string, unknown>, ms?: number) => Promise<{ results: PagefindResult[] } | null>;
}

let pf: Pagefind | null = null;
let loading: Promise<Pagefind | null> | null = null;

async function load(): Promise<Pagefind | null> {
  if (pf) return pf;
  loading ??= import(/* @vite-ignore */ `${BASE}/pagefind/pagefind.js`)
    .then(async (m: Pagefind) => {
      await m.options({ baseUrl: `${BASE}/`, excerptLength: 18 });
      await m.init();
      pf = m;
      return m;
    })
    .catch(() => null);
  return loading;
}

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "", label: "Everything" },
  { key: "Poem", label: "The poem" },
  { key: "Note", label: "Notes" },
  { key: "Motif", label: "Motifs" },
  { key: "Page", label: "Pages" },
];

let dialog: HTMLDialogElement | null = null;

function build(): HTMLDialogElement {
  const d = document.createElement("dialog");
  d.className = "search";
  d.setAttribute("aria-labelledby", "search-title");
  d.innerHTML = `
    <form method="dialog" class="search__form" role="search">
      <h2 id="search-title" class="sr-only">Search</h2>
      <label class="sr-only" for="search-q">Search the poem, notes and motifs</label>
      <input id="search-q" type="search" autocomplete="off" spellcheck="false" placeholder="Search the poem, notes, motifs…" />
      <button class="icon-btn search__close" type="submit" value="close" aria-label="Close search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke-linecap="round"/></svg>
      </button>
    </form>
    <div class="search__filters" role="group" aria-label="Filter results">
      ${FILTERS.map((f, i) => `<button type="button" class="motif-chip" data-filter="${f.key}" aria-pressed="${i === 0}">${f.label}</button>`).join("")}
    </div>
    <p class="search__status" aria-live="polite"></p>
    <ol class="search__results"></ol>`;
  document.body.append(d);
  return d;
}

export function openSearch(initial = "") {
  dialog?.remove();
  const d = (dialog = build());
  const input = d.querySelector<HTMLInputElement>("input")!;
  const status = d.querySelector<HTMLElement>(".search__status")!;
  const list = d.querySelector<HTMLOListElement>(".search__results")!;
  let filter = "";
  let seq = 0;

  const run = async () => {
    const q = input.value.trim();
    const mine = ++seq;
    list.replaceChildren();
    if (q.length < 2) {
      status.textContent = "";
      return;
    }
    status.textContent = "Searching…";
    const engine = await load();
    if (!engine) {
      status.textContent = "Search is available on the built site (npm run build && npm run preview).";
      return;
    }
    const res = await engine.debouncedSearch(q, filter ? { filters: { kind: filter } } : {}, 220);
    if (!res || mine !== seq) return;
    const top = await Promise.all(res.results.slice(0, 24).map((r) => r.data()));
    if (mine !== seq) return;
    status.textContent = top.length ? `${res.results.length} result${res.results.length === 1 ? "" : "s"}` : "No results.";
    for (const r of top) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = r.url;
      a.className = "search__hit";
      const kind = r.filters.kind?.[0] ?? (r.meta.kind === "line" ? "Poem" : "Page");
      const k = document.createElement("span");
      k.className = "search__kind";
      k.textContent = kind === "Poem" ? "Line" : kind;
      const t = document.createElement("span");
      t.className = "search__title";
      t.textContent = r.meta.title ?? r.url;
      const ex = document.createElement("span");
      ex.className = "search__excerpt";
      // Pagefind excerpts are escaped text with <mark> highlights.
      ex.innerHTML = r.excerpt;
      a.append(k, t, ex);
      a.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        d.close();
        void navigate(r.url);
      });
      li.append(a);
      list.append(li);
    }
  };

  input.addEventListener("input", () => void run());
  d.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((b) =>
    b.addEventListener("click", () => {
      filter = b.dataset.filter!;
      d.querySelectorAll("[data-filter]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      void run();
    }),
  );
  // Arrow keys move between results.
  d.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const hits = [...list.querySelectorAll<HTMLAnchorElement>(".search__hit")];
    if (!hits.length) return;
    e.preventDefault();
    const i = hits.indexOf(document.activeElement as HTMLAnchorElement);
    const next = e.key === "ArrowDown" ? (i < 0 ? 0 : Math.min(hits.length - 1, i + 1)) : i <= 0 ? -1 : i - 1;
    (next < 0 ? input : hits[next]!).focus();
  });
  d.addEventListener("close", () => {
    d.remove();
    if (dialog === d) dialog = null;
    document.querySelector<HTMLElement>("[data-search-open]")?.focus({ preventScroll: true });
  });
  d.addEventListener("click", (e) => {
    if (e.target === d) d.close();
  });
  d.showModal();
  input.value = initial;
  input.focus();
  if (initial) void run();
  void load();
}

export function initSearch(): () => void {
  const btn = document.querySelector<HTMLButtonElement>("[data-search-open]");
  const onBtn = () => openSearch();
  btn?.addEventListener("click", onBtn);
  const off = registerShortcut({ keys: ["/"], label: "Search", run: () => openSearch() });
  return () => {
    btn?.removeEventListener("click", onBtn);
    off();
    dialog?.close();
  };
}
