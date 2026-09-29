/**
 * Reader controller: annotation disclosures, marginalia layout, the note sheet,
 * deep links, stepped lines, movement tracking and same-page navigation.
 */
import { getPrefs, onPrefs, reducedMotion } from "./prefs";
import { NoteSheet } from "./sheet";
import { announce } from "./a11y";
import { registerShortcut } from "./keyboard";
import { initLineTools } from "./linetools";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const WIDE = window.matchMedia("(min-width: 1100px)");
const FINE = window.matchMedia("(hover: hover) and (pointer: fine)");
const GAP = 12;

interface NoteInfo {
  id: string;
  el: HTMLElement;
  level: "reader" | "scholar";
  lines: string[];
  aside: HTMLElement | null;
}

export function initReader(root: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];
  const on = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement | Document | Window,
    type: K | string,
    fn: (e: any) => void,
    opts?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  const quartetId = root.dataset.quartetId!;
  const start = Number(root.dataset.start ?? 0);
  const movements = [...root.querySelectorAll<HTMLElement>("section.movement")];
  const asides = [...root.querySelectorAll<HTMLElement>("aside.notes[data-movement-notes]")];

  // ------------------------------------------------------------------ notes index
  const notes = new Map<string, NoteInfo>();
  root.querySelectorAll<HTMLElement>("li.note[data-note]").forEach((el) => {
    notes.set(el.dataset.note!, {
      id: el.dataset.note!,
      el,
      level: (el.dataset.level as "reader" | "scholar") ?? "reader",
      lines: (el.dataset.lines ?? "").split(" ").filter(Boolean),
      aside: el.closest("aside"),
    });
  });
  const visible = (id: string) => {
    const d = getPrefs().density;
    const n = notes.get(id);
    if (!n || d === "clean") return false;
    return d === "scholar" || n.level === "reader";
  };

  const anchors = [...root.querySelectorAll<HTMLElement>(".anchor[data-notes]")];
  const anchorsFor = new Map<string, HTMLElement[]>();
  for (const a of anchors) {
    for (const id of a.dataset.notes!.split(" ")) {
      const arr = anchorsFor.get(id) ?? [];
      arr.push(a);
      anchorsFor.set(id, arr);
    }
  }

  // Note toggles start "expanded" in HTML (for no-JS); collapse them now.
  for (const n of notes.values()) {
    n.el.querySelector(".note__toggle")?.setAttribute("aria-expanded", "false");
  }

  /** Anchors with visible notes are links that open their notes; the rest become plain text. */
  const syncAnchors = () => {
    for (const a of anchors) {
      const ids = a.dataset.notes!.split(" ").filter(visible);
      if (ids.length) {
        a.setAttribute("href", `#n-${ids[0]}`);
        a.setAttribute("aria-expanded", a.classList.contains("is-active") ? "true" : "false");
        a.setAttribute("aria-controls", ids.map((id) => `n-${id}`).join(" "));
        a.setAttribute("aria-description", ids.length > 1 ? `${ids.length} notes` : "note");
      } else {
        // An <a> without href is not a link: screen readers get clean text.
        a.removeAttribute("href");
        a.removeAttribute("aria-expanded");
        a.removeAttribute("aria-controls");
        a.removeAttribute("aria-description");
      }
    }
  };

  // ------------------------------------------------------------------ open state
  let openIds: string[] = [];
  let pinned = false;
  let openAnchor: HTMLElement | null = null;
  let closeTimer = 0;
  const sheet = new NoteSheet();
  cleanups.push(() => sheet.destroy());
  sheet.onClose = () => clearOpen(false);

  const rangeLines = (id: string) => root.querySelectorAll<HTMLElement>(`.line[data-ranges~="${id}"]`);
  const setActive = (ids: string[], on: boolean) => {
    for (const id of ids) {
      rangeLines(id).forEach((l) => l.classList.toggle("is-range-active", on));
      notes.get(id)?.el.classList.toggle("is-open", on);
      notes.get(id)?.el.querySelector(".note__toggle")?.setAttribute("aria-expanded", String(on));
      for (const a of anchorsFor.get(id) ?? []) {
        a.classList.toggle("is-active", on);
        if (a.hasAttribute("href")) a.setAttribute("aria-expanded", String(on));
      }
    }
  };

  function clearOpen(closeSheet = true) {
    setActive(openIds, false);
    openIds = [];
    pinned = false;
    openAnchor = null;
    if (closeSheet) sheet.close(false);
    layoutAll();
  }

  function openNotes(ids: string[], opts: { pin: boolean; from: HTMLElement | null; focus: boolean }) {
    ids = ids.filter(visible);
    if (!ids.length) return;
    window.clearTimeout(closeTimer);
    if (openIds.join() === ids.join() && opts.pin && pinned) {
      clearOpen();
      if (opts.from && opts.focus) opts.from.focus({ preventScroll: true });
      return;
    }
    setActive(openIds, false);
    openIds = ids;
    pinned = opts.pin;
    openAnchor = opts.from;
    setActive(ids, true);
    if (WIDE.matches) {
      layoutAll();
      if (opts.focus) {
        const t = notes.get(ids[0]!)?.el.querySelector<HTMLElement>(".note__toggle");
        t?.focus({ preventScroll: true });
      }
    } else {
      sheet.open(
        ids.map((id) => notes.get(id)!.el),
        opts.from,
        opts.focus,
      );
      // Keep the anchor visible above the sheet (it covers the lower half).
      if (opts.from) {
        const r = opts.from.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.12 || r.bottom > window.innerHeight * 0.42) {
          window.scrollTo({ top: window.scrollY + r.top - window.innerHeight * 0.2, behavior: reducedMotion() ? "auto" : "smooth" });
        }
      }
    }
    announce(ids.length > 1 ? `${ids.length} notes opened` : `Note opened: ${notes.get(ids[0]!)?.el.querySelector(".note__toggle")?.textContent?.trim()}`);
  }

  // ------------------------------------------------------------------ marginalia layout
  let layoutQueued = false;
  function layoutAll() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => {
      layoutQueued = false;
      if (!WIDE.matches) {
        asides.forEach((a) => {
          a.style.minHeight = "";
          a.querySelectorAll<HTMLElement>(".note").forEach((n) => n.style.removeProperty("--y"));
        });
        return;
      }
      asides.forEach(layoutAside);
      root.dispatchEvent(new CustomEvent("sp:layout", { bubbles: true }));
    });
  }

  function anchorY(n: NoteInfo, asideTop: number): number {
    const a = (anchorsFor.get(n.id) ?? [])[0];
    if (a) return a.getBoundingClientRect().top - asideTop - 4;
    const first = n.lines[0];
    if (first) {
      const line = root.querySelector<HTMLElement>(`[data-line="${first}"]`);
      if (line) return line.getBoundingClientRect().top - asideTop - 4;
    }
    return 0; // movement-level: beside the heading
  }

  function layoutAside(aside: HTMLElement) {
    const top = aside.getBoundingClientRect().top;
    const items = [...aside.querySelectorAll<HTMLElement>("li.note")]
      .map((el) => notes.get(el.dataset.note!)!)
      .filter((n) => visible(n.id))
      .map((n) => ({ n, want: anchorY(n, top), h: n.el.offsetHeight, y: 0 }))
      .sort((a, b) => a.want - b.want);
    if (!items.length) {
      aside.classList.add("is-laid-out");
      return;
    }
    // Place the open note exactly at its anchor; stack others around it.
    const pivot = Math.max(
      0,
      items.findIndex((it) => openIds.includes(it.n.id)),
    );
    items[pivot]!.y = items[pivot]!.want;
    for (let i = pivot + 1; i < items.length; i++) {
      const prev = items[i - 1]!;
      items[i]!.y = Math.max(items[i]!.want, prev.y + prev.h + GAP);
    }
    for (let i = pivot - 1; i >= 0; i--) {
      const next = items[i + 1]!;
      items[i]!.y = Math.min(items[i]!.want, next.y - items[i]!.h - GAP);
    }
    // Nothing may rise above the movement heading.
    const minY = items[0]!.y;
    if (minY < -40) {
      const shift = -40 - minY;
      items.forEach((it) => (it.y += shift));
    }
    let bottom = 0;
    for (const it of items) {
      it.n.el.style.setProperty("--y", `${Math.round(it.y)}px`);
      bottom = Math.max(bottom, it.y + it.h);
    }
    aside.style.minHeight = `${Math.ceil(bottom + 24)}px`;
    aside.classList.add("is-laid-out");
  }

  // ------------------------------------------------------------------ small-screen endnotes
  const disclosures: HTMLButtonElement[] = [];
  asides.forEach((aside) => {
    const btn = aside.querySelector<HTMLButtonElement>("[data-notes-disclosure]");
    if (!btn) return;
    const onToggle = () => {
      const open = !aside.classList.contains("is-expanded");
      aside.classList.toggle("is-expanded", open);
      btn.setAttribute("aria-expanded", String(open));
    };
    btn.addEventListener("click", onToggle);
    cleanups.push(() => btn.removeEventListener("click", onToggle));
    disclosures.push(btn);
  });

  // Each movement's glossary is an endnote list; with JavaScript it folds behind a button.
  root.querySelectorAll<HTMLElement>("[data-glossary]").forEach((g) => {
    const btn = g.querySelector<HTMLButtonElement>(".glossary__toggle");
    if (!btn) return;
    btn.hidden = false;
    const onToggle = () => {
      const open = !g.classList.contains("is-open");
      g.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", String(open));
    };
    btn.addEventListener("click", onToggle);
    cleanups.push(() => btn.removeEventListener("click", onToggle));
  });

  const syncDisclosureCounts = () => {
    disclosures.forEach((btn) => {
      const aside = btn.parentElement!;
      const n = [...aside.querySelectorAll<HTMLElement>("li.note")].filter((el) => visible(el.dataset.note!)).length;
      btn.querySelector(".c")!.textContent = `(${n})`;
      btn.hidden = n === 0;
    });
  };

  // ------------------------------------------------------------------ events
  on(root, "click", (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    const a = t.closest<HTMLElement>(".anchor[href]");
    if (a) {
      e.preventDefault();
      e.stopPropagation();
      openNotes(a.dataset.notes!.split(" "), { pin: true, from: a, focus: e.detail === 0 });
      return;
    }
    const toggle = t.closest<HTMLElement>(".note__toggle");
    if (toggle && toggle.closest(".notes--quartet")) {
      const li = toggle.closest<HTMLElement>("li.note")!;
      const open = !li.classList.contains("is-open");
      li.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      return;
    }
    if (toggle && WIDE.matches) {
      const li = toggle.closest<HTMLElement>("li.note")!;
      const id = li.dataset.note!;
      if (openIds.includes(id) && pinned) clearOpen();
      else openNotes([id], { pin: true, from: (anchorsFor.get(id) ?? [])[0] ?? null, focus: false });
      return;
    }
    if (toggle && !WIDE.matches) {
      // Endnote list on small screens: expand in place.
      const li = toggle.closest<HTMLElement>("li.note")!;
      const open = !li.classList.contains("is-open");
      li.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      return;
    }
    const noteLink = t.closest<HTMLAnchorElement>("a[data-note-link]");
    if (noteLink && notes.has(noteLink.dataset.noteLink!)) {
      e.preventDefault();
      focusNote(noteLink.dataset.noteLink!);
    }
  });

  // ------------------------------------------------------------------ words: glosses and concordance
  // The popover module loads on first use; the reader's own script stays small.
  let wordPop: import("./words").WordPop | null = null;
  let wordsMod: Promise<typeof import("./words")> | null = null;
  const words = () =>
    (wordsMod ??= import("./words").then((m) => {
      wordPop = new m.WordPop(root);
      cleanups.push(() => wordPop?.destroy());
      return m;
    }));
  const glossLinks = [...root.querySelectorAll<HTMLElement>(".gl[data-glosses]")];
  const syncGlosses = () => {
    const clean = getPrefs().density === "clean";
    for (const g of glossLinks) {
      if (clean) g.removeAttribute("href");
      else g.setAttribute("href", `#g-${g.dataset.glosses!.split(" ")[0]}`);
    }
  };
  on(root, "click", (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || getPrefs().density === "clean") return;
    const t = e.target as HTMLElement;
    const gl = t.closest<HTMLElement>(".gl[href]");
    if (gl) {
      e.preventDefault();
      const line = gl.closest<HTMLElement>(".line")!;
      const focus = e.detail === 0;
      void words().then(() => wordPop!.open(line, gl.textContent ?? "", { glossIds: gl.dataset.glosses!.split(" "), from: gl, focus }));
      return;
    }
    if (!t.closest(".lt") || t.closest("a[href], button")) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const { clientX: x, clientY: y } = e;
    void words().then((m) => {
      const w = m.wordAt(x, y);
      if (w) void wordPop!.open(w.line, w.word, { key: w.key });
    });
  });
  on(root, "sp:words", (e: CustomEvent<{ line: HTMLElement; from: HTMLElement | null }>) => {
    void words().then(() => wordPop!.openLine(e.detail.line, e.detail.from));
  });

  // Hover opens (desktop, fine pointer); leaving closes unless pinned.
  let hoverTimer = 0;
  on(root, "pointerover", (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const t = e.target as HTMLElement;
    const a = t.closest<HTMLElement>(".anchor[href]");
    if (a) {
      const ids = a.dataset.notes!.split(" ").filter(visible);
      ids.forEach((id) => notes.get(id)?.el.classList.add("is-hover"));
      if (WIDE.matches && FINE.matches && !pinned) {
        window.clearTimeout(hoverTimer);
        hoverTimer = window.setTimeout(() => openNotes(ids, { pin: false, from: a, focus: false }), 280);
      }
      window.clearTimeout(closeTimer);
      return;
    }
    const li = t.closest<HTMLElement>("li.note");
    if (li) {
      window.clearTimeout(closeTimer);
      (anchorsFor.get(li.dataset.note!) ?? []).forEach((x) => x.classList.add("is-hover"));
      rangeLines(li.dataset.note!).forEach((l) => l.classList.add("is-range-active"));
    }
  });
  on(root, "pointerout", (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const t = e.target as HTMLElement;
    const a = t.closest<HTMLElement>(".anchor");
    if (a) {
      window.clearTimeout(hoverTimer);
      a.dataset.notes!.split(" ").forEach((id) => notes.get(id)?.el.classList.remove("is-hover"));
    }
    const li = t.closest<HTMLElement>("li.note");
    if (li) {
      (anchorsFor.get(li.dataset.note!) ?? []).forEach((x) => x.classList.remove("is-hover"));
      if (!openIds.includes(li.dataset.note!)) rangeLines(li.dataset.note!).forEach((l) => l.classList.remove("is-range-active"));
    }
    const related = e.relatedTarget as HTMLElement | null;
    const stillInside = related && (related.closest(".anchor[href]") || related.closest("li.note.is-open"));
    if (!pinned && openIds.length && !stillInside) {
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => {
        if (!pinned) clearOpen();
      }, 450);
    }
  });

  on(document, "keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape" && openIds.length && WIDE.matches) {
      const back = openAnchor;
      clearOpen();
      back?.focus({ preventScroll: true });
    }
  });
  on(document, "click", (e: MouseEvent) => {
    if (!openIds.length || !pinned || !WIDE.matches) return;
    const t = e.target as HTMLElement;
    if (!root.contains(t) || (!t.closest("li.note") && !t.closest(".anchor"))) clearOpen();
  });

  // ------------------------------------------------------------------ stepped lines
  const layoutSteps = () => {
    root.querySelectorAll<HTMLElement>(".line--step").forEach((line) => {
      const prev = line.previousElementSibling as HTMLElement | null;
      const lt = prev?.querySelector<HTMLElement>(".lt");
      if (!prev || !lt) return;
      const range = document.createRange();
      range.selectNodeContents(lt);
      const rects = range.getClientRects();
      const last = rects[rects.length - 1];
      if (!last) return;
      const x = last.right - line.getBoundingClientRect().left + 6;
      const max = line.clientWidth * 0.7;
      line.style.setProperty("--step-x", `${Math.max(0, Math.min(x, max))}px`);
    });
  };

  // ------------------------------------------------------------------ deep links
  function linesForHash(hash: string): HTMLElement[] {
    const h = decodeURIComponent(hash.replace(/^#/, ""));
    const m = /^(\d+)(?:-(\d+))?$/.exec(h);
    if (!m) return [];
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    const mv = start || 1;
    const out: HTMLElement[] = [];
    for (let n = from; n <= Math.min(to, from + 60); n++) {
      const el = root.querySelector<HTMLElement>(`[data-line$=".${mv}.${n}"]`);
      if (el) out.push(el);
    }
    return out;
  }

  let fadeTimer = 0;
  function highlight(lines: HTMLElement[], scroll: boolean) {
    root.querySelectorAll(".line.is-target").forEach((l) => l.classList.remove("is-target", "is-fading"));
    if (!lines.length) return;
    lines.forEach((l) => l.classList.add("is-target"));
    if (scroll) lines[0]!.scrollIntoView({ block: "center", behavior: "auto" });
    window.clearTimeout(fadeTimer);
    fadeTimer = window.setTimeout(() => lines.forEach((l) => l.classList.remove("is-target")), 6000);
  }

  function focusNote(id: string) {
    const n = notes.get(id);
    if (!n) return;
    const a = (anchorsFor.get(id) ?? [])[0];
    const target = a ?? (n.lines[0] ? root.querySelector<HTMLElement>(`[data-line="${n.lines[0]}"]`) : null) ?? n.el.closest("section");
    target?.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    if (!visible(id)) return;
    window.setTimeout(() => openNotes([id], { pin: true, from: a ?? null, focus: false }), reducedMotion() ? 0 : 450);
  }

  const handleHash = (scroll: boolean) => {
    const h = location.hash;
    if (!h) return false;
    if (h === "#epigraphs") {
      const epigraphs = root.querySelector<HTMLElement>(h);
      if (!epigraphs) return false;
      if (scroll) {
        epigraphs.scrollIntoView({ block: "start", behavior: "auto" });
        epigraphs.focus({ preventScroll: true });
      }
      return true;
    }
    if (h.startsWith("#n-")) {
      focusNote(h.slice(3));
      return true;
    }
    const lines = linesForHash(h);
    if (lines.length) {
      highlight(lines, scroll);
      return true;
    }
    return false;
  };

  // ------------------------------------------------------------------ movement tracking
  let currentMovement = start || 0;
  const pips = [...document.querySelectorAll<HTMLAnchorElement>("[data-pip]")];
  const setCurrent = (m: number) => {
    if (m === currentMovement) return;
    currentMovement = m;
    pips.forEach((p) => {
      if (Number(p.dataset.pip) === m) p.setAttribute("aria-current", "location");
      else p.removeAttribute("aria-current");
    });
    const path = `${BASE}/${quartetId}${m ? `/${m}` : ""}`;
    const fragment = m === 0 && location.hash === "#epigraphs" ? location.hash : "";
    if (location.pathname.replace(/\/$/, "") !== path) history.replaceState(history.state, "", path + fragment);
    root.dispatchEvent(new CustomEvent("sp:movement", { detail: { movement: m }, bubbles: true }));
  };
  const io = new IntersectionObserver(
    (entries) => {
      // The current movement is the last one whose top has passed 40% of the viewport.
      const vh = window.innerHeight;
      let m = 0;
      for (const s of movements) if (s.getBoundingClientRect().top < vh * 0.4) m = Number(s.dataset.movement);
      if (entries.length) setCurrent(m);
    },
    { threshold: [0, 0.01], rootMargin: "-40% 0px -59% 0px" },
  );
  movements.forEach((s) => io.observe(s));
  cleanups.push(() => io.disconnect());

  // Same-quartet movement links scroll instead of navigating (capture: before the router).
  on(
    document,
    "click",
    (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
      if (!a) return;
      // In-page fragments (note anchors, related-note links) are handled by the reader itself.
      if (a.getAttribute("href")!.startsWith("#")) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin) return;
      const m = new RegExp(`/${quartetId}(?:/([1-5]))?/?$`).exec(u.pathname);
      if (!m) return;
      e.preventDefault();
      e.stopPropagation();
      // A link inside the note sheet leads back to the text: get the sheet out of the way.
      if (sheet.contains(a)) sheet.close(false);
      const mv = m[1] ? Number(m[1]) : 0;
      const target = mv ? root.querySelector<HTMLElement>(`#m${mv}-h`) : root.querySelector<HTMLElement>("#title");
      const lineNo = /^#(\d+)/.exec(u.hash)?.[1];
      if (lineNo && mv) {
        const el = root.querySelector<HTMLElement>(`[data-line="${root.dataset.quartet}.${mv}.${lineNo}"]`);
        if (el) {
          highlight([el], true);
          history.replaceState(history.state, "", u.pathname + u.hash);
          return;
        }
      }
      target?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
      history.replaceState(history.state, "", u.pathname);
      target?.setAttribute("tabindex", "-1");
      target?.focus({ preventScroll: true });
    },
    { capture: true },
  );

  // Page shortcuts
  const movementJump = (dir: 1 | -1) => {
    const next = Math.min(5, Math.max(0, currentMovement + dir));
    const target = next ? root.querySelector<HTMLElement>(`#m${next}-h`) : root.querySelector<HTMLElement>("#title");
    target?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  };
  const anchorJump = (dir: 1 | -1) => {
    const live = anchors.filter((a) => a.hasAttribute("href"));
    if (!live.length) return;
    const cur = document.activeElement as HTMLElement;
    let i = live.indexOf(cur);
    if (i < 0) {
      const mid = window.innerHeight * 0.35;
      i = live.findIndex((a) => a.getBoundingClientRect().top > mid) - (dir > 0 ? 1 : 0);
    }
    const next = live[Math.min(live.length - 1, Math.max(0, i + dir))];
    next?.focus({ preventScroll: true });
    next?.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
  };
  cleanups.push(
    registerShortcut({ keys: ["]"], label: "Next movement", run: () => movementJump(1) }),
    registerShortcut({ keys: ["["], label: "Previous movement", run: () => movementJump(-1) }),
    registerShortcut({ keys: ["j"], label: "Next annotated phrase", run: () => anchorJump(1) }),
    registerShortcut({ keys: ["k"], label: "Previous annotated phrase", run: () => anchorJump(-1) }),
  );

  // ------------------------------------------------------------------ last position
  // Remembered for the Time Spiral ("you are here") and for returning readers.
  let saveAt = 0;
  const savePosition = () => {
    const now = performance.now();
    if (now - saveAt < 1200) return;
    saveAt = now;
    const col = root.querySelector<HTMLElement>(".movement__text")?.getBoundingClientRect();
    if (!col) return;
    const el = document.elementFromPoint(col.left + 40, window.innerHeight * 0.38)?.closest<HTMLElement>(".line");
    if (!el?.dataset.line) return;
    try {
      localStorage.setItem("sp:last", JSON.stringify({ line: el.dataset.line, at: Date.now() }));
    } catch {
      /* storage unavailable */
    }
  };
  on(window, "scroll", savePosition, { passive: true });

  // ------------------------------------------------------------------ reactions
  cleanups.push(
    onPrefs((_p, key) => {
      if (key !== "density") return;
      openIds = openIds.filter(visible);
      syncAnchors();
      syncGlosses();
      if (getPrefs().density === "clean") wordPop?.close(false);
      syncDisclosureCounts();
      if (!openIds.length) clearOpen();
      layoutAll();
    }),
  );
  const onWide = () => {
    clearOpen();
    layoutAll();
  };
  WIDE.addEventListener("change", onWide);
  cleanups.push(() => WIDE.removeEventListener("change", onWide));

  const ro = new ResizeObserver(() => {
    layoutSteps();
    layoutAll();
  });
  root.querySelectorAll("[data-movement-text]").forEach((t) => ro.observe(t));
  cleanups.push(() => ro.disconnect());

  cleanups.push(initLineTools(root, quartetId));
  const printBtn = root.querySelector<HTMLButtonElement>("[data-print]");
  const onPrint = () => window.print();
  printBtn?.addEventListener("click", onPrint);
  cleanups.push(() => printBtn?.removeEventListener("click", onPrint));

  // ------------------------------------------------------------------ first run
  syncAnchors();
  syncGlosses();
  syncDisclosureCounts();
  layoutSteps();
  layoutAll();
  document.fonts?.ready.then(() => {
    layoutSteps();
    layoutAll();
  });

  const hashed = handleHash(true);
  if (!hashed && start > 0 && window.scrollY < 40) {
    root.querySelector<HTMLElement>(`#m${start}-h`)?.scrollIntoView({ block: "start" });
  }
  const onHash = () => handleHash(true);
  on(window, "hashchange", onHash);

  document.body.classList.add("reader-ready");
  return () => {
    for (const c of cleanups.reverse()) c();
    document.body.classList.remove("reader-ready");
  };
}
