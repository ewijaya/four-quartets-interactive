import type { MotifId, MotifOccurrence } from "../lib/model";

/**
 * Motif occurrences, anchored by short lemmas and resolved like annotations.
 * Filled in Phase 4 (Motif Tracer).
 */
export const MOTIF_OCCURRENCES: Partial<Record<MotifId, MotifOccurrence[]>> = {};
