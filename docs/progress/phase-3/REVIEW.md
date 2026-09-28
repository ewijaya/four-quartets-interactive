# Phase 3 review — elemental scenes and tile transitions

Screenshots: sample text, 1440×900 and 390×844 @2x, Vellum and Night. Stills in
`public/stills/` are the reduced-motion / no-WebGL illustrations (and posters).

## What was built

- **Stage**: one persistent WebGL renderer across client-side navigation. Scenes
  render into a reduced-resolution target; a full-resolution blit upscales them and
  enforces a luminance band so text keeps WCAG AA contrast; tiles draw last, crisp.
- **Scenes**: Burnt Norton (dappled leaf-shadow, shaft of light, motes; the pool fills
  with light and empties; kingfisher glint), East Coker (grains settling into strata,
  firelit ring of dancers), The Dry Salvages (river giving way to a Gerstner ocean with
  fog, a bell buoy riding the same wave sum on the CPU, shrine light), Little Gidding
  (embers, midwinter sun on ice, a dove drawn in points, a heraldic rose at the close).
- **Cues** anchored in the text by lemma (resolved like annotations) drive the scenes.
- **Tile transitions**: headings break into mosaic tiles, flock into the element's
  emblem and settle back (vertex-shader animation, one uniform).
- **Quality tiers**, pause when hidden, context-loss recovery, stills for reduced motion.

## Three weakest aspects (first pass) and what changed

1. **Scenes were invisible** — the body's background painted over the negative-z-index
   stage. → Body transparent, paper colour on `<html>`, grain above the stage.
2. **Tile transitions did nothing visible** — two bugs: ScrollTrigger fired for headings
   already scrolled past, and the y-flip into pixel space reversed triangle winding so
   every tile was back-face culled; tiles were also too sparse to draw an emblem.
   → Visibility check, `DoubleSide`, and each glyph cell releases several tiles.
3. **Shapes read as clouds** (dove, rose) and stills were washed out. → Shapes lock in
   exactly (formation remapped), petals got their own colour, both are drawn as
   outlines like manuscript emblems; stills are captured without the band and masked
   toward the paper under text in CSS (the twin of the shader band).

Also fixed: hard band edges (feather 48 → 220 px), dust-like embers on vellum, source
indents rendered twice too wide, a horizontal overflow on the mobile home page.

## Verified

- Contrast over live scenes (Playwright + pixel analysis): 20/20 pass, ≥ 4.5:1 for the
  faintest text colour, both themes, desktop and mobile.
- Frames: p95 16.7–16.8 ms on all five scenes (M1, real GPU via ANGLE/Metal), also
  with a 4× CPU throttle; retained heap growth over 4 s of animation 55–143 KB.
- Reduced motion shows the illustrated still and never creates a canvas.
