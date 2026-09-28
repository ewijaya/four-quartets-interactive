/** Time Spiral page: wires the controls and movement list to the spiral scene. */
import { navigate } from "astro:transitions/client";
import { sceneMode } from "./stage-lite";

export function initSpiralPage(): () => void {
  const offs: Array<() => void> = [];
  const cue = async (name: string, on = true) => {
    if (sceneMode() !== "live") return;
    const boot = await import("../stage/boot");
    boot.cue(name, on);
  };
  document.querySelectorAll<HTMLInputElement>("[data-layer]").forEach((box) => {
    const fn = () => void cue(box.dataset.layer!, box.checked);
    box.addEventListener("change", fn);
    offs.push(() => box.removeEventListener("change", fn));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-cue]").forEach((b) => {
    const fn = () => void cue(b.dataset.cue!);
    b.addEventListener("click", fn);
    offs.push(() => b.removeEventListener("click", fn));
  });
  document.querySelectorAll<HTMLButtonElement>("[data-fly]").forEach((b) => {
    const fn = () => {
      // Without the live spiral (reduced motion, no WebGL) the list simply opens the movement.
      if (sceneMode() !== "live") return void navigate(b.dataset.href!);
      void cue(`fly:${b.dataset.fly}`);
      document.querySelectorAll("[data-fly]").forEach((x) => x.removeAttribute("aria-pressed"));
      b.setAttribute("aria-pressed", "true");
    };
    b.addEventListener("click", fn);
    offs.push(() => b.removeEventListener("click", fn));
  });
  if (sceneMode() !== "live") document.body.classList.add("spiral-static");
  return () => {
    offs.forEach((f) => f());
    document.body.classList.remove("spiral-static");
  };
}
