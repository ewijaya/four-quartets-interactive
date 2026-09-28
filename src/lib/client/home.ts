/**
 * The Still Point (home): links the quartet list to the armillary scene. Hovering or
 * focusing a quartet highlights its orbit; pointing at an orbit highlights its
 * quartet; choosing one flies into the orbit and then navigates. Hit-testing
 * projects the same ring geometry the shader draws, without loading three.js.
 */
import { navigate } from "astro:transitions/client";
import { RINGS } from "../stage/scenes/home-geometry";
import { reducedMotion } from "./prefs";
import { sceneMode } from "./stage-lite";

type Boot = typeof import("../stage/boot");
let bootMod: Boot | null = null;
const cue = async (name: string, on: boolean) => {
  if (sceneMode() !== "live") return;
  bootMod ??= await import("../stage/boot");
  bootMod.cue(name, on);
};

/** Project ring i to screen space as a closed polyline (CSS px). */
function ringPolyline(i: number, w: number, h: number, out: Float32Array) {
  const ring = RINGS[i]!;
  const portrait = w / h < 0.9;
  const cz = portrait ? 15.5 : 9.2;
  const cy = 1.1;
  // Camera looks at the origin from (0, cy, cz).
  const len = Math.hypot(cy, cz);
  const fz = [0, -cy / len, -cz / len]; // forward
  const up0 = [0, 1, 0];
  // right = forward × up
  const rx = fz[1]! * up0[2]! - fz[2]! * up0[1]!;
  const ry = fz[2]! * up0[0]! - fz[0]! * up0[2]!;
  const rz = fz[0]! * up0[1]! - fz[1]! * up0[0]!;
  const rl = Math.hypot(rx, ry, rz);
  const r = [rx / rl, ry / rl, rz / rl];
  const u = [r[1]! * fz[2]! - r[2]! * fz[1]!, r[2]! * fz[0]! - r[0]! * fz[2]!, r[0]! * fz[1]! - r[1]! * fz[0]!];
  const f = 1 / Math.tan((38 * Math.PI) / 360);
  const cxr = Math.cos(ring.tiltX);
  const sxr = Math.sin(ring.tiltX);
  const czr = Math.cos(ring.tiltZ);
  const szr = Math.sin(ring.tiltZ);
  const n = out.length / 2;
  for (let k = 0; k < n; k++) {
    const th = (k / n) * Math.PI * 2;
    // Point on the ring, then three.js Euler "XYZ" (matrix Rx·Ry·Rz: Z applies first).
    let x = Math.cos(th) * ring.radius;
    let y = 0;
    let z = Math.sin(th) * ring.radius;
    const x1 = x * czr - y * szr;
    const y1 = x * szr + y * czr;
    x = x1;
    y = y1;
    const y2 = y * cxr - z * sxr;
    const z2 = y * sxr + z * cxr;
    y = y2;
    z = z2;
    // To camera space.
    const px = x;
    const py = y - cy;
    const pz = z - cz;
    const vx = px * r[0]! + py * r[1]! + pz * r[2]!;
    const vy = px * u[0]! + py * u[1]! + pz * u[2]!;
    const vz = px * fz[0]! + py * fz[1]! + pz * fz[2]!;
    const sx = ((vx * f) / (vz * (w / h))) * 0.5 + 0.5;
    const sy = 0.5 - ((vy * f) / vz) * 0.5;
    out[k * 2] = sx * w;
    out[k * 2 + 1] = sy * h;
  }
}

export function initHome(root: HTMLElement): () => void {
  const links = [...root.querySelectorAll<HTMLAnchorElement>("[data-orbit]")];
  const poly = RINGS.map(() => new Float32Array(96 * 2));
  let hovered = -1;
  let entering = false;

  const project = () => RINGS.forEach((_, i) => ringPolyline(i, window.innerWidth, window.innerHeight, poly[i]!));
  project();

  const setHover = (i: number) => {
    if (i === hovered) return;
    hovered = i;
    links.forEach((a) => a.classList.toggle("is-orbit-hover", Number(a.dataset.orbit) === i));
    document.body.classList.toggle("orbit-pointer", i >= 0);
    void cue(`ring${Math.max(0, i)}`, i >= 0);
  };

  const nearest = (x: number, y: number): number => {
    let best = -1;
    let bestD = 22;
    poly.forEach((p, i) => {
      for (let k = 0; k < p.length; k += 2) {
        const d = Math.hypot(p[k]! - x, p[k + 1]! - y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    });
    return best;
  };

  const enter = (i: number, href: string) => {
    if (entering) return;
    entering = true;
    if (reducedMotion() || sceneMode() !== "live") {
      void navigate(href);
      return;
    }
    void cue(`enter${i}`, true);
    document.body.classList.add("is-entering");
    window.setTimeout(() => void navigate(href), 950);
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || entering) return;
    const t = e.target as HTMLElement;
    if (t.closest("a, button, header")) return;
    setHover(nearest(e.clientX, e.clientY));
  };
  const onClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("a, button, header, .site-menu")) return;
    const i = nearest(e.clientX, e.clientY);
    if (i < 0) return;
    const a = links.find((l) => Number(l.dataset.orbit) === i);
    if (a) enter(i, a.href);
  };
  const onLinkEnter = (e: Event) => setHover(Number((e.currentTarget as HTMLElement).dataset.orbit));
  const onLinkLeave = () => setHover(-1);
  const onLinkClick = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    const a = e.currentTarget as HTMLAnchorElement;
    e.preventDefault();
    e.stopPropagation();
    enter(Number(a.dataset.orbit), a.href);
  };

  links.forEach((a) => {
    a.addEventListener("pointerenter", onLinkEnter);
    a.addEventListener("focus", onLinkEnter);
    a.addEventListener("pointerleave", onLinkLeave);
    a.addEventListener("blur", onLinkLeave);
    a.addEventListener("click", onLinkClick);
  });
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("click", onClick);
  window.addEventListener("resize", project);

  return () => {
    setHover(-1);
    document.body.classList.remove("is-entering", "orbit-pointer");
    links.forEach((a) => {
      a.removeEventListener("pointerenter", onLinkEnter);
      a.removeEventListener("focus", onLinkEnter);
      a.removeEventListener("pointerleave", onLinkLeave);
      a.removeEventListener("blur", onLinkLeave);
      a.removeEventListener("click", onLinkClick);
    });
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("click", onClick);
    window.removeEventListener("resize", project);
  };
}
