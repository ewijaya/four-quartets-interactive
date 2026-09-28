/**
 * Line tools in the reader: a small popover on a line number (copy link, bookmark,
 * add a personal note), bookmark ribbons, personal notes shown under their lines,
 * and the `b` / `n` shortcuts for the line being read.
 */
import { addNote, deleteNote, getStore, isBookmarked, notesFor, onStore, toggleBookmark, updateNote } from "./storage";
import { registerShortcut } from "./keyboard";
import { announce } from "./a11y";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

export function initLineTools(root: HTMLElement, quartetId: string): () => void {
  const offs: Array<() => void> = [];
  let pop: HTMLElement | null = null;
  let popLine: HTMLElement | null = null;

  const lineEl = (id: string) => root.querySelector<HTMLElement>(`.line[data-line="${id}"]`);
  const hrefFor = (id: string) => {
    const [, m, n] = id.split(".");
    return `${location.origin}${BASE}/${quartetId}/${m}#${n}`;
  };

  /** Draw bookmarks and personal notes onto the text. */
  const render = () => {
    root.querySelectorAll(".line.is-bookmarked").forEach((l) => l.classList.remove("is-bookmarked"));
    root.querySelectorAll(".my-note").forEach((n) => n.remove());
    const s = getStore();
    for (const id of Object.keys(s.bookmarks)) lineEl(id)?.classList.add("is-bookmarked");
    for (const note of s.notes) {
      const l = lineEl(note.line);
      if (!l) continue;
      const box = document.createElement("span");
      box.className = "my-note";
      box.setAttribute("role", "note");
      box.dataset.noteId = note.id;
      box.setAttribute("aria-label", "Your note");
      const text = document.createElement("span");
      text.className = "my-note__text";
      text.textContent = note.text;
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "my-note__btn";
      edit.dataset.edit = note.id;
      edit.textContent = "Edit";
      const del = document.createElement("button");
      del.type = "button";
      del.className = "my-note__btn";
      del.dataset.del = note.id;
      del.textContent = "Delete";
      box.append(text, edit, del);
      l.after(box);
    }
  };

  const close = (restore = true) => {
    pop?.remove();
    pop = null;
    if (restore) popLine?.querySelector<HTMLElement>(".lt a, .lt")?.focus?.({ preventScroll: true });
    popLine = null;
  };

  const openFor = (line: HTMLElement, mode: "menu" | "note" = "menu", editId?: string) => {
    close(false);
    popLine = line;
    const id = line.dataset.line!;
    const n = id.split(".")[2];
    pop = document.createElement("div");
    pop.className = "line-pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", `Line ${n}`);
    const existing = editId ? getStore().notes.find((x) => x.id === editId) : undefined;
    if (mode === "menu") {
      pop.innerHTML = `
        <button type="button" data-act="copy">Copy link</button>
        <button type="button" data-act="bookmark">${isBookmarked(id) ? "Remove bookmark" : "Bookmark"}</button>
        <button type="button" data-act="note">Add a note</button>`;
    } else {
      pop.innerHTML = `
        <label class="line-pop__label" for="line-pop-text">${existing ? "Edit your note" : `Your note on line ${n}`}</label>
        <textarea id="line-pop-text" rows="3" maxlength="2000"></textarea>
        <div class="line-pop__row">
          <button type="button" data-act="save" class="btn">Save</button>
          <button type="button" data-act="cancel" class="btn">Cancel</button>
        </div>
        <p class="line-pop__hint">Saved in this browser only. Export from “Bookmarks & notes”.</p>`;
      pop.querySelector<HTMLTextAreaElement>("textarea")!.value = existing?.text ?? "";
      if (existing) pop.dataset.edit = existing.id;
    }
    line.after(pop);
    (pop.querySelector<HTMLElement>("textarea") ?? pop.querySelector<HTMLElement>("button"))?.focus();
  };

  const onClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    const ln = t.closest<HTMLAnchorElement>("a.ln");
    if (ln) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openFor(ln.closest<HTMLElement>(".line")!);
      return;
    }
    const act = t.closest<HTMLElement>("[data-act]")?.dataset.act;
    if (act && pop && popLine) {
      const id = popLine.dataset.line!;
      const n = id.split(".")[2];
      if (act === "copy") {
        const href = hrefFor(id);
        void navigator.clipboard?.writeText(href);
        announce(`Link to line ${n} copied`, true);
        close();
      } else if (act === "bookmark") {
        const on = toggleBookmark(id);
        announce(on ? `Line ${n} bookmarked` : `Bookmark on line ${n} removed`, true);
        close();
      } else if (act === "note") {
        openFor(popLine, "note");
      } else if (act === "save") {
        const text = pop.querySelector<HTMLTextAreaElement>("textarea")!.value;
        if (text.trim()) {
          if (pop.dataset.edit) updateNote(pop.dataset.edit, text);
          else addNote(id, text);
          announce("Note saved", true);
        }
        close();
      } else if (act === "cancel") close();
      return;
    }
    const edit = t.closest<HTMLElement>("[data-edit]");
    if (edit && edit.tagName === "BUTTON") {
      const note = getStore().notes.find((x) => x.id === edit.dataset.edit);
      const line = note && lineEl(note.line);
      if (line) openFor(line, "note", note.id);
      return;
    }
    const del = t.closest<HTMLElement>("[data-del]");
    if (del) {
      deleteNote(del.dataset.del!);
      announce("Note deleted");
    }
  };
  root.addEventListener("click", onClick, true);
  offs.push(() => root.removeEventListener("click", onClick, true));

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && pop) {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", onKey, true);
  offs.push(() => document.removeEventListener("keydown", onKey, true));

  /** The line being read: the focused phrase's line, else the one at ~38% of the viewport. */
  const currentLine = (): HTMLElement | null => {
    const f = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(".line");
    if (f && root.contains(f)) return f;
    const col = root.querySelector(".movement__text")?.getBoundingClientRect();
    if (!col) return null;
    return document.elementFromPoint(col.left + 40, window.innerHeight * 0.38)?.closest<HTMLElement>(".line") ?? null;
  };
  offs.push(
    registerShortcut({
      keys: ["b"],
      label: "Bookmark the line you are reading",
      run: () => {
        const l = currentLine();
        if (!l) return;
        const on = toggleBookmark(l.dataset.line!);
        announce(on ? `Line ${l.dataset.n} bookmarked` : `Bookmark removed`);
      },
    }),
    registerShortcut({
      keys: ["n"],
      label: "Add a note to the line you are reading",
      run: () => {
        const l = currentLine();
        if (l) openFor(l, "note");
      },
    }),
  );

  render();
  offs.push(onStore(render));
  return () => {
    close(false);
    offs.forEach((f) => f());
    root.querySelectorAll(".my-note").forEach((n) => n.remove());
  };
}
