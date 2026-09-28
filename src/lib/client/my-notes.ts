/** The Bookmarks & notes page: list, delete, export, import (all client-side). */
import { deleteNote, exportJSON, getStore, importJSON, onStore, toggleBookmark } from "./storage";
import { announce } from "./a11y";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const ROMAN = ["", "I", "II", "III", "IV", "V"];

export function initMyNotes(root: HTMLElement): () => void {
  const quartets = JSON.parse(root.dataset.quartets ?? "[]") as Array<{ code: string; id: string; title: string }>;
  const list = root.querySelector<HTMLElement>("[data-list]")!;
  const where = (line: string) => {
    const [q, m, n] = line.split(".");
    const qq = quartets.find((x) => x.code === q);
    return { label: `${qq?.title ?? q} ${ROMAN[Number(m)]}, line ${n}`, href: `${BASE}/${qq?.id}/${m}#${n}`, order: quartets.findIndex((x) => x.code === q) * 1e5 + Number(m) * 1e3 + Number(n) };
  };

  const render = () => {
    const s = getStore();
    const items = [
      ...Object.keys(s.bookmarks).map((line) => ({ kind: "bookmark" as const, line, text: "", id: line })),
      ...s.notes.map((n) => ({ kind: "note" as const, line: n.line, text: n.text, id: n.id })),
    ].sort((a, b) => where(a.line).order - where(b.line).order);
    list.replaceChildren();
    if (!items.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "Nothing yet. Bookmarks and notes you make while reading will appear here.";
      list.append(p);
      return;
    }
    const ul = document.createElement("ul");
    ul.className = "my-notes__list";
    for (const it of items) {
      const w = where(it.line);
      const li = document.createElement("li");
      li.className = `my-notes__item my-notes__item--${it.kind}`;
      const a = document.createElement("a");
      a.href = w.href;
      a.textContent = w.label;
      const kind = document.createElement("span");
      kind.className = "eyebrow";
      kind.textContent = it.kind === "bookmark" ? "Bookmark" : "Note";
      li.append(kind, a);
      if (it.text) {
        const t = document.createElement("p");
        t.textContent = it.text;
        li.append(t);
      }
      const del = document.createElement("button");
      del.type = "button";
      del.className = "my-notes__del";
      del.textContent = "Remove";
      del.addEventListener("click", () => {
        if (it.kind === "bookmark") toggleBookmark(it.line);
        else deleteNote(it.id);
        announce("Removed");
      });
      li.append(del);
      ul.append(li);
    }
    list.append(ul);
  };

  const onExport = () => {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `still-point-notes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const exportBtn = root.querySelector<HTMLButtonElement>("[data-export]")!;
  exportBtn.addEventListener("click", onExport);
  const input = root.querySelector<HTMLInputElement>("[data-import]")!;
  const onImport = async () => {
    const f = input.files?.[0];
    if (!f) return;
    try {
      const r = importJSON(await f.text());
      announce(`Imported ${r.bookmarks} bookmark(s) and ${r.notes} note(s)`, true);
    } catch (e) {
      announce(`Could not import: ${(e as Error).message}`, true);
    }
    input.value = "";
  };
  input.addEventListener("change", onImport);

  render();
  const off = onStore(render);
  return () => {
    off();
    exportBtn.removeEventListener("click", onExport);
    input.removeEventListener("change", onImport);
  };
}
