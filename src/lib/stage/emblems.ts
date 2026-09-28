/**
 * Point sets for the four element emblems (the alchemical signs in a circle),
 * matching the SVG in components/chrome/Emblem.astro. Coordinates are relative to
 * the emblem centre, y pointing down, in CSS pixels.
 */
import type { Element } from "../model";

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Evenly spaced points along a polyline (closed if `close`). */
function alongPath(pts: Array<[number, number]>, n: number, close: boolean, out: number[], jitter: number, rnd: () => number) {
  const segs: Array<[number, number, number, number, number]> = [];
  let total = 0;
  const last = close ? pts.length : pts.length - 1;
  for (let i = 0; i < last; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push([a[0], a[1], b[0], b[1], len]);
    total += len;
  }
  for (let k = 0; k < n; k++) {
    let d = ((k + 0.5) / n) * total;
    for (const [ax, ay, bx, by, len] of segs) {
      if (d <= len) {
        const t = d / len;
        out.push(ax + (bx - ax) * t + (rnd() - 0.5) * jitter, ay + (by - ay) * t + (rnd() - 0.5) * jitter);
        break;
      }
      d -= len;
    }
  }
}

export function emblemPoints(element: Element, count: number, radius: number): Float32Array {
  const rnd = seeded(count * 7919 + radius);
  const out: number[] = [];
  const r = radius;
  const up = element === "air" || element === "fire";
  const bar = element === "air" || element === "earth";
  // Geometry mirrors the 48×48 SVG: circle r=21.5, triangle apexes, bar.
  const k = r / 21.5;
  const tri: Array<[number, number]> = up
    ? [
        [0, -14.5 * k],
        [13 * k, 8.5 * k],
        [-13 * k, 8.5 * k],
      ]
    : [
        [0, 14.5 * k],
        [13 * k, -8.5 * k],
        [-13 * k, -8.5 * k],
      ];
  const nCircle = Math.round(count * 0.42);
  const nBar = bar ? Math.round(count * 0.12) : 0;
  const nTri = count - nCircle - nBar;
  const circle: Array<[number, number]> = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    circle.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  alongPath(circle, nCircle, true, out, 2.2, rnd);
  alongPath(tri, nTri, true, out, 2.2, rnd);
  if (bar) {
    const y = (up ? 0.5 : -0.5) * k;
    alongPath(
      [
        [-9 * k, y],
        [9 * k, y],
      ],
      nBar,
      false,
      out,
      1.6,
      rnd,
    );
  }
  return Float32Array.from(out.slice(0, count * 2));
}
