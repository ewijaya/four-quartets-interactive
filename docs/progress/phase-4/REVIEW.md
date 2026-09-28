# Phase 4 review — Still Point, Movement Map, Time Spiral, Motif Tracer

## What was built

- **The Still Point (home)**: four elemental orbits (earth, water, air, fire — the
  medieval sublunary order) around a luminous centre and a still axis. Pointing at an
  orbit or its label highlights both; choosing one flies the camera in, then navigates.
  Hit-testing projects the same ring geometry without loading three.js.
- **Movement Map** (`/map`): an accessible table; each cell sketches the movement's
  verse paragraphs, counts, notes and motifs; hovering lights its row and column.
- **Compare** (`/compare/1…5`): one movement across the four quartets, columns that
  scroll together on desktop, swipe panels with tabs on mobile, the function explained.
- **Time Spiral** (`/spiral`): the sequence as a helix, one turn per quartet; lines,
  notes (gold) and motifs (coloured) as lights; "you were here" from the last reading
  position; orbit, zoom, click a light for its card; a movement list that is both the
  keyboard interface and the text alternative (and opens movements without WebGL).
- **Motif Tracer** (`/motifs`, `/motifs/[id]`): d3 arc diagram of up to three motifs
  over the whole sequence, state in `?m=`, and complete occurrence lists (no-JS, a11y).
- **Motif data**: 106 occurrences across 14 motifs, each a ≤ 6-word lemma verified
  against the imported copy (0 unresolved) with true line numbers.

## Three weakest aspects (first pass) and what changed

1. **Motif chips were unstyled boxes** on the tracer — their styles lived in the reader
   stylesheet only. → Chip and dot styles are global.
2. **On phones the spiral hid behind its control panel.** → A projection view-offset
   lifts the helix into the upper screen; orbiting and picking stay aligned.
3. **The spiral's list vanished on phones, and did nothing without WebGL.** → Always
   visible; with reduced motion or no WebGL it opens the movement instead; the spiral
   also has an illustrated still.

Also: the screenshot harness no longer deletes earlier shots on partial runs.

## Verified

- New e2e tests (map → compare, scroll sync, tracer toggles + URL, spiral controls).
- axe: zero violations on `/map`, `/compare/2`, `/motifs`, `/motifs/rose`, `/spiral`
  in both themes, desktop and mobile.
