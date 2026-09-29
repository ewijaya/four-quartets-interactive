/** Sent on `document` by the spiral scene whenever the followed motif or a layer changes. */
export const SPIRAL_EVENT = "sp:spiral";

export interface SpiralEventDetail {
  /** Id of the motif being followed, if any. */
  motif: string | null;
  layers: { notes: boolean; motifs: boolean };
}
