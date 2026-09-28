/**
 * The horizontal band (CSS px) where text sits over a scene. The live WebGL scene
 * enforces its strictest luminance limits inside it; the static still is masked
 * toward the paper inside it. Shared by both paths, so neither loads the other.
 */
export function textBand(): { x0: number; x1: number; on: boolean } {
  const w = window.innerWidth;
  // Pages whose text sits on its own backing (the home orbits) need no strict band.
  if (document.querySelector("[data-no-text-band]")) return { x0: 0, x1: 0, on: false };
  if (w < 1100) return { x0: 0, x1: w, on: true };
  const reader = document.querySelector<HTMLElement>("[data-reader]");
  if (reader) {
    const text = reader.querySelector(".movement__text")?.getBoundingClientRect();
    const notes = reader.querySelector("aside.notes[data-movement-notes]")?.getBoundingClientRect();
    if (text) return { x0: text.left - 64, x1: (notes && notes.width > 0 ? notes.right : text.right) + 28, on: true };
  }
  const band = document.querySelector<HTMLElement>("[data-text-band]") ?? document.querySelector<HTMLElement>("main .page");
  if (band) {
    const r = band.getBoundingClientRect();
    return { x0: r.left - 32, x1: r.right + 32, on: true };
  }
  return { x0: 0, x1: w, on: true };
}

/** Expose the band to CSS (used to mask the static still). */
export function writeBandVars(host: HTMLElement) {
  const b = textBand();
  host.style.setProperty("--band-x0", `${Math.round(b.on ? b.x0 : -9999)}px`);
  host.style.setProperty("--band-x1", `${Math.round(b.on ? b.x1 : -9999)}px`);
}
