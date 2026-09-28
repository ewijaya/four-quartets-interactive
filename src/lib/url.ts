import type { MovementN, QuartetCode, QuartetId } from "./model";
import { QUARTET_BY_CODE } from "../data/quartets";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

/** Prefix an absolute site path with the configured base (GitHub Pages support). */
export const url = (path: string) => `${BASE}${path.startsWith("/") ? path : `/${path}`}`;

export const quartetUrl = (id: QuartetId) => url(`/${id}`);
export const movementUrl = (id: QuartetId, m: MovementN) => url(`/${id}/${m}`);
export const lineUrl = (code: QuartetCode, m: MovementN, n: number, end?: number) =>
  url(`/${QUARTET_BY_CODE[code].id}/${m}#${n}${end && end > n ? `-${end}` : ""}`);
export const lineUrlFromId = (lineId: string) => {
  const [q, m, n] = lineId.split(".");
  return lineUrl(q as QuartetCode, Number(m) as MovementN, Number(n));
};
export const noteUrl = (id: string) => url(`/notes/${id}`);
