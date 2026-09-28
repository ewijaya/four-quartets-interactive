# Phase 5 review — Atlas, soundscape, search, notes, print

## What was built

- **Atlas** (`/atlas`): a d3 orthographic globe drawn as ink (coastlines wobbled by an
  SVG turbulence filter), the four quartet places, three places in Eliot's life, nine
  source origins (uncertain ones in dashed halos), great-circle arcs from each source to
  the quartet it enters. Drag to turn, slow drift when idle (off with reduced motion),
  choosing a place turns the globe and shows its card. Cards carry **hand-sketched
  illustrations generated in code** — rough.js at build time, shipped as inline SVG.
- **Soundscape**: Web Audio drone for four string-like voices with persistent
  oscillators (pitches glide, no nodes per note), a generated reverb, per-quartet mode
  and timbre (air Lydian with breath, earth Dorian, water Aeolian with a bell buoy, fire
  Ionian), per-movement density (IV almost silent, V gathers all four toward the tonic).
  Muted by default, suspended when the tab is hidden, persists across navigation.
  Header toggle on wide screens; toggle and volume in the menu everywhere.
- **Search**: Pagefind over notes, motifs, pages and one record per verse line; dialog
  on `/` or the header, filters (poem / notes / motifs / pages), arrow-key navigation.
- **Bookmarks & personal notes**: line-number popover (copy link, bookmark, note),
  `b`/`n` shortcuts, ribbons and notes shown in the text, `/my-notes` with export/import
  (versioned JSON), all in localStorage with guarded access.
- **Print / PDF**: chrome and scenes removed, notes printed as endnotes at the chosen
  density, each movement on a new page.

## Three weakest aspects (first pass) and what changed

1. **The rights guard was crying wolf** — lemmas that equal a whole short line (allowed)
   tripped it. → It now looks for what a leak really is: a line of more than six words, a
   run of consecutive lines, or dozens of lines in one file. Verified both ways: the
   sample build passes; a private build checked as public fails.
2. **Search never ran in tests or screenshots** — the harness built without the Pagefind
   step. → Test server and screenshot harness now run the full `npm run build`.
3. **Atlas labels collided** over England (three quartets within 150 km). → Fixed label
   placements for the three; the native search clear button was hidden too.

## Verified

124 e2e tests pass (desktop + mobile), including search, notes round-trip with export,
atlas selection, sound on/off without errors, print media, and axe on `/atlas` and
`/my-notes` in both themes.
