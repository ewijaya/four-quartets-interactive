/**
 * Bookmarks and personal notes, kept in this browser only (localStorage), with a
 * versioned schema, export and import. Every access is guarded: storage may be
 * unavailable (private windows, blocked site data).
 */

export interface PersonalNote {
  id: string;
  line: string;
  text: string;
  created: number;
  updated: number;
}

export interface Store {
  v: 1;
  bookmarks: Record<string, number>;
  notes: PersonalNote[];
}

const KEY = "sp:notes:v1";
const empty = (): Store => ({ v: 1, bookmarks: {}, notes: [] });
type Listener = (s: Store) => void;
const listeners = new Set<Listener>();

function read(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Store> | null;
    if (!raw || raw.v !== 1) return empty();
    return { v: 1, bookmarks: raw.bookmarks ?? {}, notes: Array.isArray(raw.notes) ? raw.notes : [] };
  } catch {
    return empty();
  }
}

let store = read();

function write(next: Store) {
  store = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: changes last for this page only */
  }
  for (const l of listeners) l(store);
}

// Another tab changed the store.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    store = read();
    for (const l of listeners) l(store);
  });
}

export const getStore = (): Readonly<Store> => store;
export const onStore = (fn: Listener) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const isBookmarked = (line: string) => line in store.bookmarks;

export function toggleBookmark(line: string): boolean {
  const bookmarks = { ...store.bookmarks };
  const on = !(line in bookmarks);
  if (on) bookmarks[line] = Date.now();
  else delete bookmarks[line];
  write({ ...store, bookmarks });
  return on;
}

export function addNote(line: string, text: string): PersonalNote {
  const now = Date.now();
  const note: PersonalNote = { id: `pn-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`, line, text: text.trim(), created: now, updated: now };
  write({ ...store, notes: [...store.notes, note] });
  return note;
}

export function updateNote(id: string, text: string) {
  write({ ...store, notes: store.notes.map((n) => (n.id === id ? { ...n, text: text.trim(), updated: Date.now() } : n)) });
}

export function deleteNote(id: string) {
  write({ ...store, notes: store.notes.filter((n) => n.id !== id) });
}

export const notesFor = (line: string) => store.notes.filter((n) => n.line === line);

export function exportJSON(): string {
  return JSON.stringify({ app: "still-point", exported: new Date().toISOString(), ...store }, null, 2);
}

/** Merge an exported file into the store. Returns counts added. */
export function importJSON(text: string): { bookmarks: number; notes: number } {
  const data = JSON.parse(text) as Partial<Store>;
  if (data.v !== 1) throw new Error("Not a still-point notes file (version 1).");
  const bookmarks = { ...store.bookmarks };
  let b = 0;
  for (const [line, at] of Object.entries(data.bookmarks ?? {})) {
    if (!/^(BN|EC|DS|LG)\.[1-5]\.\d+$/.test(line)) continue;
    if (!(line in bookmarks)) b++;
    bookmarks[line] = Number(at) || Date.now();
  }
  const ids = new Set(store.notes.map((n) => n.id));
  const incoming = (data.notes ?? []).filter(
    (n): n is PersonalNote => !!n && typeof n.text === "string" && /^(BN|EC|DS|LG)\.[1-5]\.\d+$/.test(n.line) && !ids.has(n.id),
  );
  write({ v: 1, bookmarks, notes: [...store.notes, ...incoming] });
  return { bookmarks: b, notes: incoming.length };
}
