/**
 * Live scenes: creates the persistent Stage once, switches its scene per page and
 * binds reading progress, cues and tile transitions on reader pages.
 */
import { Stage } from "./stage";
import { bindReader } from "./reading";
import { effectiveTheme } from "../client/prefs";
import { textBand } from "../client/text-band";

let stage: Stage | null = null;

function ensureStage(): Stage | null {
  if (stage) return stage;
  const host = document.getElementById("stage");
  if (!host || !Stage.supported()) return null;
  const params = new URLSearchParams(location.search);
  const still = params.has("still") ? { time: Number(params.get("t") ?? 18) } : null;
  stage = new Stage(host, { night: effectiveTheme() === "night", still });
  if (params.has("debug")) (window as unknown as { __stage?: Stage }).__stage = stage;
  return stage;
}

export function setNight(night: boolean) {
  stage?.setNight(night);
}

/** Forward a cue from page scripts (home orbits, spiral…) to the running scene. */
export function cue(name: string, on: boolean) {
  stage?.cue(name, on);
  stage?.start();
}

export function deactivate() {
  if (!stage) return;
  stage.tiles.cancel();
  void stage.setScene(null);
  stage.canvas.classList.remove("is-live");
}

export function activate(scene: string, hooks: { onLive(): void; onLost(): void }): () => void {
  const s = ensureStage();
  if (!s) {
    hooks.onLost();
    return () => {};
  }
  const params = new URLSearchParams(location.search);
  const capture = params.has("still");
  if (capture) {
    document.documentElement.classList.add("still-capture");
    s.reading.movement = Number(params.get("still") || 0);
    s.reading.progress = Number(params.get("p") ?? 0.35);
    s.reading.global = (s.reading.movement - 1 + s.reading.progress) / 5;
  }
  s.setNight(effectiveTheme() === "night");
  s.onLost = hooks.onLost;
  s.onFirstFrame = () => {
    s.canvas.classList.add("is-live");
    window.setTimeout(hooks.onLive, 1400);
  };

  const updateBand = () => {
    // Stills are captured without a band: the page masks them toward the paper under text instead.
    const b = capture ? { x0: 0, x1: 0, on: false } : textBand();
    s.setTextBand(b.x0, b.x1, b.on);
  };
  updateBand();
  const onResize = () => updateBand();
  window.addEventListener("resize", onResize);
  document.addEventListener("sp:layout", onResize);

  let unbind: (() => void) | null = null;
  void s.setScene(scene).then(() => {
    if (capture) {
      for (const c of (params.get("cues") ?? "").split(",").filter(Boolean)) s.cue(c, true);
      return;
    }
    const reader = document.querySelector<HTMLElement>("[data-reader]");
    if (reader) unbind = bindReader(reader, s);
  });

  return () => {
    window.removeEventListener("resize", onResize);
    document.removeEventListener("sp:layout", onResize);
    unbind?.();
    s.tiles.cancel();
  };
}
