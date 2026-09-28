/**
 * Scroll bindings for reader pages (GSAP ScrollTrigger): which movement is being
 * read and how far, text-anchored scene cues, and the tile transition at each
 * movement heading. Everything is killed on navigation.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Stage } from "./stage";
import type { Element as Elemental } from "../model";

gsap.registerPlugin(ScrollTrigger);

const TILE_COOLDOWN_MS = 45_000;
const lastTiled = new Map<string, number>();

export function bindReader(root: HTMLElement, stage: Stage): () => void {
  const triggers: ScrollTrigger[] = [];
  const reading = stage.reading;
  reading.quartet = root.dataset.quartet ?? "";
  const element = (root.dataset.element ?? "air") as Elemental;
  const sections = [...root.querySelectorAll<HTMLElement>("section.movement")];

  // Movement and progress within it.
  sections.forEach((sec) => {
    const m = Number(sec.dataset.movement);
    triggers.push(
      ScrollTrigger.create({
        trigger: sec,
        start: "top 55%",
        end: "bottom 55%",
        onUpdate: (self) => {
          if (self.isActive) {
            reading.movement = m;
            reading.progress = self.progress;
          }
        },
        onToggle: (self) => {
          if (self.isActive) reading.movement = m;
          else if (m === 1 && self.direction < 0) {
            reading.movement = 0;
            reading.progress = 0;
          }
        },
      }),
    );
  });

  // Whole-quartet progress and scroll speed.
  triggers.push(
    ScrollTrigger.create({
      trigger: root,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        reading.global = self.progress;
        reading.scroll = Math.max(reading.scroll, Math.min(1, Math.abs(self.getVelocity()) / 2500));
      },
    }),
  );

  // Text-anchored cues.
  root.querySelectorAll<HTMLElement>("[data-cue-start]").forEach((el) => {
    for (const name of el.dataset.cueStart!.split(" ")) {
      const endEl = root.querySelector<HTMLElement>(`[data-cue-end~="${name}"]`);
      triggers.push(
        ScrollTrigger.create({
          trigger: el,
          start: "top 70%",
          ...(endEl ? { endTrigger: endEl, end: "bottom 30%" } : { end: "+=520" }),
          onToggle: (self) => stage.cue(name, self.isActive),
        }),
      );
    }
  });

  // Tile transitions at movement headings.
  const play = (h: HTMLElement) => {
    // ScrollTrigger also reports headings already scrolled past; only play what is on screen.
    const r = h.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight * 0.85) return;
    const key = `${reading.quartet}:${h.id}`;
    const now = performance.now();
    if (now - (lastTiled.get(key) ?? -Infinity) < TILE_COOLDOWN_MS) return;
    if (stage.tiles.active) return;
    lastTiled.set(key, now);
    void stage.tiles.play(h, element);
    stage.start();
  };
  root.querySelectorAll<HTMLElement>(".movement-heading[data-tiles]").forEach((h) => {
    triggers.push(ScrollTrigger.create({ trigger: h, start: "top 72%", onEnter: () => play(h) }));
  });

  // Arriving at a movement URL: play its heading once the page has settled.
  const start = Number(root.dataset.start ?? 0);
  let arrival = 0;
  if (start > 0) {
    const h = root.querySelector<HTMLElement>(`#m${start}-h`);
    arrival = window.setTimeout(() => {
      if (h && h.getBoundingClientRect().top < window.innerHeight * 0.8) play(h);
    }, 900);
  }

  // Layout changes (fonts, marginalia) move trigger positions.
  let refreshTimer = 0;
  const refresh = () => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 200);
  };
  root.addEventListener("sp:layout", refresh);
  document.fonts?.ready.then(refresh);
  refresh();

  return () => {
    window.clearTimeout(arrival);
    window.clearTimeout(refreshTimer);
    root.removeEventListener("sp:layout", refresh);
    for (const t of triggers) t.kill();
    stage.tiles.cancel();
    for (const name of ["pool", "shaft", "kingfisher", "dance", "wind", "dark", "sea", "fog", "bell", "shrine", "midwinter", "darkdove", "dove", "rose"]) {
      stage.cue(name, false);
    }
  };
}
