/**
 * Orbit geometry for the Still Point, shared by the WebGL scene and the home page's
 * pointer hit-testing (which projects the same ellipses without loading three.js).
 * Order: the sublunary spheres — earth, water, air, fire — outward from the centre.
 */
import type { QuartetId } from "../../model";

export interface Ring {
  quartet: QuartetId;
  element: "earth" | "water" | "air" | "fire";
  radius: number;
  /** Radians per second around the ring's own axis (slow: 1–3 minutes a turn). */
  speed: number;
  tiltX: number;
  tiltZ: number;
  vellum: number;
  night: number;
}

export const RINGS: Ring[] = [
  { quartet: "east-coker", element: "earth", radius: 1.15, speed: 0.052, tiltX: 0.32, tiltZ: -0.18, vellum: 0x8a5a26, night: 0xd6a468 },
  { quartet: "the-dry-salvages", element: "water", radius: 1.8, speed: -0.038, tiltX: 0.2, tiltZ: 0.3, vellum: 0x1f6b6b, night: 0x7cc7c1 },
  { quartet: "burnt-norton", element: "air", radius: 2.45, speed: 0.029, tiltX: 0.42, tiltZ: 0.08, vellum: 0x3f6f8c, night: 0xa9cde4 },
  { quartet: "little-gidding", element: "fire", radius: 3.1, speed: -0.022, tiltX: 0.12, tiltZ: -0.34, vellum: 0xa8431c, night: 0xf2a066 },
];
