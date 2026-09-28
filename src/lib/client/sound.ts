/**
 * Sound toggle and volume. The engine is created on the first user gesture (browsers
 * require it), persists across client-side navigation, and follows the page's scene
 * and the movement being read. Muted by default on every visit.
 */
import { getPrefs, onPrefs, setPref } from "./prefs";
import { announce } from "./a11y";

type Engine = import("../audio/engine").Soundscape;
type Ctx = Parameters<Engine["setContext"]>[0];
let engine: Engine | null = null;

function context(): [Ctx, number] {
  const scene = document.body.dataset.scene ?? "none";
  const movement = Number(document.querySelector<HTMLElement>("[data-reader]")?.dataset.start ?? 0);
  return [(["air", "earth", "water", "fire", "home"].includes(scene) ? scene : "none") as Ctx, movement];
}

export function initSound(): () => void {
  const offs: Array<() => void> = [];
  const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-sound-toggle]")];
  const supported = "AudioContext" in window;
  buttons.forEach((b) => (b.hidden = !supported));

  const sync = () => {
    const on = !!engine?.playing;
    buttons.forEach((b) => {
      b.setAttribute("aria-pressed", String(on));
      b.title = on ? "Soundscape (on)" : "Soundscape (off)";
    });
  };

  const toggle = async () => {
    if (!engine) {
      const { Soundscape } = await import("../audio/engine");
      engine = new Soundscape();
      engine.setVolume(getPrefs().volume);
    }
    engine.setContext(...context());
    if (engine.playing) {
      engine.stop();
      setPref("sound", false);
      announce("Soundscape off");
    } else {
      await engine.start();
      setPref("sound", true);
      announce("Soundscape on");
    }
    sync();
  };
  const onClick = () => void toggle();
  for (const b of buttons) {
    b.addEventListener("click", onClick);
    offs.push(() => b.removeEventListener("click", onClick));
  }

  const volume = document.querySelector<HTMLInputElement>("[data-volume]");
  if (volume) {
    volume.value = String(getPrefs().volume);
    const onVol = () => setPref("volume", Number(volume.value));
    volume.addEventListener("input", onVol);
    offs.push(() => volume.removeEventListener("input", onVol));
  }
  offs.push(
    onPrefs((p, key) => {
      if (key === "volume") engine?.setVolume(p.volume);
    }),
  );

  // Follow the page and the movement being read.
  engine?.setContext(...context());
  const onMovement = (e: Event) => engine?.setContext(context()[0], (e as CustomEvent<{ movement: number }>).detail.movement);
  document.addEventListener("sp:movement", onMovement);
  offs.push(() => document.removeEventListener("sp:movement", onMovement));
  sync();

  return () => offs.forEach((f) => f());
}
