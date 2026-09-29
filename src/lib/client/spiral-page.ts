/** Time Spiral page: wires the controls, motif legend and movement list to the spiral scene. */
import { navigate } from "astro:transitions/client";
import { sceneMode } from "./stage-lite";
import { SPIRAL_EVENT, type SpiralEventDetail } from "../viz/spiral-events";

export function initSpiralPage(): () => void {
  const offs: Array<() => void> = [];
  const on = <T extends Event>(target: EventTarget, type: string, fn: (e: T) => void) => {
    target.addEventListener(type, fn as EventListener);
    offs.push(() => target.removeEventListener(type, fn as EventListener));
  };
  const cue = async (name: string, active = true) => {
    if (sceneMode() !== "live") return;
    const boot = await import("../stage/boot");
    boot.cue(name, active);
  };
  const chips = [...document.querySelectorAll<HTMLButtonElement>("[data-motif]")];
  const layerBox = (key: string) => document.querySelector<HTMLInputElement>(`[data-layer="${key}"]`);

  /** Show which motif is followed, in the chips and in the address (so the view can be shared). */
  const showMotif = (id: string | null) => {
    for (const c of chips) c.setAttribute("aria-pressed", String(c.dataset.motif === id));
    const next = new URL(location.href);
    if (id) next.searchParams.set("motif", id);
    else next.searchParams.delete("motif");
    if (next.href !== location.href) history.replaceState(history.state, "", next);
  };

  document.querySelectorAll<HTMLInputElement>("[data-layer]").forEach((box) => {
    on(box, "change", () => void cue(box.dataset.layer!, box.checked));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-cue]").forEach((b) => {
    on(b, "click", () => void cue(b.dataset.cue!));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-fly]").forEach((b) => {
    on(b, "click", () => {
      // Without the live spiral (reduced motion, no WebGL) the list simply opens the movement.
      if (sceneMode() !== "live") return void navigate(b.dataset.href!);
      void cue(`fly:${b.dataset.fly}`);
      document.querySelectorAll("[data-fly]").forEach((x) => x.removeAttribute("aria-pressed"));
      b.setAttribute("aria-pressed", "true");
    });
  });

  for (const chip of chips) {
    on(chip, "click", () => {
      // Without the live spiral a motif opens its own page.
      if (sceneMode() !== "live") return void navigate(chip.dataset.href!);
      const id = chip.dataset.motif!;
      const follow = chip.getAttribute("aria-pressed") !== "true";
      // Optimistic: the scene may still be loading; it reads the address when it starts.
      showMotif(follow ? id : null);
      if (follow) {
        const box = layerBox("motifs");
        if (box) box.checked = true;
      }
      void cue(`motif:${id}`, follow);
    });
  }

  // The scene reports what it is following and which layers are on (it can change them itself).
  on<CustomEvent<SpiralEventDetail>>(document, SPIRAL_EVENT, (e) => {
    showMotif(e.detail.motif);
    for (const key of ["notes", "motifs"] as const) {
      const box = layerBox(key);
      if (box) box.checked = e.detail.layers[key];
    }
  });

  if (sceneMode() === "live") {
    const wanted = new URLSearchParams(location.search).get("motif");
    if (wanted && chips.some((c) => c.dataset.motif === wanted)) {
      showMotif(wanted);
      const box = layerBox("motifs");
      if (box) box.checked = true;
    }
  } else {
    // Without the live spiral the chips are plain links to each motif's page, not toggles.
    for (const c of chips) c.removeAttribute("aria-pressed");
    const sub = document.getElementById("spiral-motifs-title");
    if (sub) sub.textContent = "The motifs";
    document.body.classList.add("spiral-static");
  }
  return () => {
    offs.forEach((f) => f());
    document.body.classList.remove("spiral-static");
  };
}
