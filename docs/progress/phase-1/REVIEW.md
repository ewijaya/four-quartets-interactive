# Phase 1 review — scaffold, model, importer, reader

Screenshots: `*-desktop-*.png` (1440×900) and `*-mobile-*.png` (390×844 @2x), Vellum and Night.
Captured with the sample text.

## Three weakest aspects (first pass) and what changed

1. **Mobile layout was wider than the screen.** The soft scrim behind the verse extended
   past the column, widening the layout viewport; the header's right-hand buttons and the
   note sheet were clipped. `overflow-x: clip` on `body` did not help (it propagates to the
   viewport, which mobile browsers ignore for layout width).
   → Clip on the reader element itself; the scrim's inset now respects the gutter.
   Hidden header buttons (search, sound) were also visible because `.icon-btn`'s `display`
   beat the `hidden` attribute → global `[hidden] { display: none !important }`.

2. **Marginalia glitches on desktop.** A mobile-only "Notes · I (2)" disclosure leaked into
   the margin, and range notes drew a broken bracket far to the right of short lines.
   → Disclosure hidden on wide screens; range brackets are now a continuous hairline
   between the line numbers and the verse, brightening when their note is hovered or open.

3. **Title page composition.** Quartet-level notes sprawled full-width under the title and
   the page sat off-centre once it was confined to the poem column.
   → Title page centred on the whole composition (poem + margin) with a 40rem measure;
   quartet notes became compact disclosure cards; year · element and the place on
   separate lines; the header is opaque once scrolled (text no longer ghosts through).

Also fixed: movement links and deep links land on the heading (not above it); programmatic
jumps no longer hide the header; a tapped phrase is scrolled above the note sheet.

## What works

- Importer (25 unit tests), sample generated through the importer, 865 placeholder lines.
- Reader: continuous quartet with per-movement URLs, native deep links (`#12`, `#12-18`),
  hanging turn-over lines, indents, stepped lines, line numbers, copy-link.
- Notes: margin glosses with collision stacking (desktop), bottom sheet (mobile), endnotes
  without JS; open on hover / click / tap / Enter; Esc closes; density Clean/Reader/Scholar.
- Themes Vellum/Night, persisted; no console errors.
