/**
 * Reader preferences, persisted in localStorage (never required: every read and
 * write is guarded, and defaults apply when storage is unavailable).
 */
import type { Density } from "../model";

export interface Prefs {
  theme: "auto" | "vellum" | "night";
  density: Density;
  scenes: boolean;
  sound: boolean;
  volume: number;
  shortcuts: boolean;
}

const KEY = "sp:prefs:v1";
const DEFAULTS: Prefs = { theme: "auto", density: "reader", scenes: true, sound: false, volume: 0.6, shortcuts: true };

type Listener = (p: Prefs, key: keyof Prefs) => void;
const listeners = new Set<Listener>();

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>;
    return { ...DEFAULTS, ...raw, sound: false }; // sound never auto-starts
  } catch {
    return { ...DEFAULTS };
  }
}

let prefs = load();

export const getPrefs = (): Readonly<Prefs> => prefs;

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  if (prefs[key] === value) return;
  prefs = { ...prefs, [key]: value };
  try {
    const { sound: _s, ...persist } = prefs;
    localStorage.setItem(KEY, JSON.stringify(persist));
  } catch {
    /* storage unavailable: preference lasts for this page only */
  }
  applyPrefs();
  for (const l of listeners) l(prefs, key);
}

export function onPrefs(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const darkQuery = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
const motionQuery = typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

export const effectiveTheme = (): "vellum" | "night" =>
  prefs.theme === "auto" ? (darkQuery?.matches ? "night" : "vellum") : prefs.theme;

export const reducedMotion = () => !!motionQuery?.matches;

export function applyPrefs(doc: Document = document) {
  const r = doc.documentElement;
  const theme = effectiveTheme();
  r.dataset.theme = theme;
  r.dataset.density = prefs.density;
  r.dataset.scenes = prefs.scenes ? "on" : "off";
  doc.querySelector("meta[data-theme-color]")?.setAttribute("content", theme === "night" ? "#0b0d15" : "#f4eee1");
}

darkQuery?.addEventListener("change", () => {
  if (prefs.theme !== "auto") return;
  applyPrefs();
  for (const l of listeners) l(prefs, "theme");
});
motionQuery?.addEventListener("change", () => {
  for (const l of listeners) l(prefs, "scenes");
});
