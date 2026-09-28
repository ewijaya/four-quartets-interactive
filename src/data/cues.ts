import type { Cue } from "../lib/model";

/**
 * Scene cues: moments in the text that change the elemental scene behind it.
 * Anchored by short lemmas (≤ 6 words) and resolved like annotations; in sample
 * mode they fall back to their hint lines. Filled in Phase 3.
 */
export const CUES: Cue[] = [];
