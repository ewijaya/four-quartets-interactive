/**
 * Decides how the page's scene is shown, without loading three.js:
 *   live  — WebGL scene (three.js + GSAP loaded on idle)
 *   still — a pre-rendered image (reduced motion, no WebGL2)
 *   off   — nothing (scenes switched off, prefers-contrast: more, forced colours)
 */
import { effectiveTheme, getPrefs, onPrefs, reducedMotion } from "./prefs";
import stills from "../../data/stills.json";
import { writeBandVars } from "./text-band";

type Mode = "live" | "still" | "off";
type Boot = typeof import("../stage/boot");

const STILLS = stills as Record<string, string>;
const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
let boot: Boot | null = null;
let bootLoading: Promise<Boot> | null = null;
let webgl: boolean | null = null;

function hasWebGL2(): boolean {
  if (webgl !== null) return webgl;
  try {
    webgl = !!document.createElement("canvas").getContext("webgl2");
  } catch {
    webgl = false;
  }
  return webgl;
}

export function sceneMode(): Mode {
  if (!getPrefs().scenes) return "off";
  if (matchMedia("(prefers-contrast: more)").matches || matchMedia("(forced-colors: active)").matches) return "off";
  if (new URLSearchParams(location.search).has("still")) return "live";
  if (reducedMotion() || !hasWebGL2()) return "still";
  return "live";
}

function loadBoot(): Promise<Boot> {
  if (boot) return Promise.resolve(boot);
  bootLoading ??= import("../stage/boot").then((m) => (boot = m));
  return bootLoading;
}

const idle = (fn: () => void, timeout = 2500) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout });
  else window.setTimeout(fn, 600);
};

export function stillFor(scene: string, movement: number): string | null {
  const key = `${scene}-${movement}-${effectiveTheme()}`;
  const fallback = `${scene}-0-${effectiveTheme()}`;
  const file = STILLS[key] ?? STILLS[fallback];
  return file ? `${BASE}${file}` : null;
}

export function initStage(): () => void {
  const scene = document.body.dataset.scene ?? "none";
  const host = document.getElementById("stage");
  const img = host?.querySelector<HTMLImageElement>("img.stage__still") ?? null;
  let movement = Number(document.querySelector<HTMLElement>("[data-reader]")?.dataset.start ?? 0);
  let teardownLive: (() => void) | null = null;
  let disposed = false;

  const showStill = (on: boolean) => {
    if (!img) return;
    const src = on && scene !== "none" ? stillFor(scene, movement) : null;
    if (src) {
      if (img.getAttribute("src") !== src) img.src = src;
      img.hidden = false;
      requestAnimationFrame(() => img.classList.add("is-shown"));
    } else {
      img.classList.remove("is-shown");
    }
  };

  const apply = () => {
    if (disposed) return;
    const mode = sceneMode();
    const on = scene !== "none" && mode !== "off";
    document.body.classList.toggle("has-scene", on);
    teardownLive?.();
    teardownLive = null;
    if (mode === "live" && scene !== "none") {
      // Poster first; the live canvas fades in over it.
      showStill(true);
      idle(() => {
        if (disposed) return;
        void loadBoot().then((b) => {
          if (disposed) return;
          teardownLive = b.activate(scene, {
            onLive: () => showStill(false),
            onLost: () => showStill(true),
          });
        });
      });
    } else {
      boot?.deactivate();
      showStill(mode === "still");
    }
  };

  const onBand = () => host && writeBandVars(host);
  onBand();
  window.addEventListener("resize", onBand);
  document.addEventListener("sp:layout", onBand);

  const onMovement = (e: Event) => {
    movement = (e as CustomEvent<{ movement: number }>).detail.movement;
    if (sceneMode() === "still") showStill(true);
  };
  document.addEventListener("sp:movement", onMovement);
  const off = onPrefs((_p, key) => {
    if (key === "theme") {
      boot?.setNight(effectiveTheme() === "night");
      if (sceneMode() !== "live") showStill(sceneMode() === "still");
    }
    if (key === "scenes") apply();
  });

  apply();

  return () => {
    disposed = true;
    window.removeEventListener("resize", onBand);
    document.removeEventListener("sp:layout", onBand);
    document.removeEventListener("sp:movement", onMovement);
    off();
    teardownLive?.();
    teardownLive = null;
    // The stage itself persists across navigation; the next page decides its scene.
  };
}
