# Phase 6 review — audits, annotations, documentation

## What was done

- **Annotations for the last three quartets**: 110 new notes (East Coker 37, The Dry
  Salvages 33, Little Gidding 40), bringing the corpus to **174** — 64 established facts
  and identifications, 110 interpretive readings. Every lemma resolves against the
  imported text (0 unresolved, 0 ambiguous); hints are true line numbers so the sample
  build places each note on the right line. Eight new intertexts were added to
  `src/data/sources.ts`; motif occurrences in the later quartets now link to their notes.
- **Lighthouse** (`npm run lighthouse`, report in `reports/lighthouse/summary.md`): every
  audited route scores 93–100 on performance and 100 on accessibility, best practices
  and SEO, on mobile and desktop.
- **Accessibility**: the axe suite now covers 18 routes (added an East Coker and a Dry
  Salvages reader page and a Little Gidding note page) in both themes and viewports.
- **Docs**: `CONTRIBUTING.md` (annotation schema and scholarly rules, code conventions,
  the check loop), README brought up to date, `docs/CHECKLIST.md` (the definition of done,
  with the gaps that remain).

## Three weakest aspects (first pass) and what changed

1. **Layout shift on mobile deep links.** Opening `/little-gidding/5` on a phone shifted
   the page (CLS 0.21, performance 84): the reader inserted a “Notes (n)” toggle into every
   earlier movement *after* the first paint, pushing movement V down by 176 px. It only
   surfaced once the later quartets had notes. → The toggle is now rendered in the HTML
   (hidden without JavaScript) and the script only wires it up. Lighthouse CLS on the
   reader pages is now ≤ 0.005; a new e2e test (with scripts delayed, as on a phone network) fails on the
   old code and passes on the new.
2. **Margin notes lost contrast over the night scenes.** The contrast test measured the
   note column for the first time on East Coker and Little Gidding and found 4.1–4.2 : 1
   for the faintest ink. → The margin column gets the same soft blurred leaf as the verse;
   all contrast tests pass at ≥ 4.5 : 1.
3. **Atlas labels collided** with source points at the default rotation (a dot sat on
   “Little Gidding” and another on “East Coker”), and on phones “The Dry Salvages” ran into
   the English labels. → The three English labels are stacked north to south on the Atlantic
   side, clear of their halos; The Dry Salvages is centred below its point.

Also fixed along the way: a live WebGL scene started loading during page load because the
reader's own jump to the movement fired a `scroll` “engagement” event (TBT 890 ms on
mobile); the Atlas page carried 650 KB of 15-digit rough.js coordinates (257 → 76 KB
gzip after rounding); the mobile movement pips covered the search button; note location
links were below the 24 px target size; canonical URLs pointed at a Vercel domain the site
is not deployed to; three notes quoted a whole line of the poem and were stopped by the
`check-dist` rights guard before anything was published — they now paraphrase.

## Tried and reverted

- Inlining all CSS (`build.inlineStylesheets: "always"`) and preloading the italic poem
  font, to bring mobile LCP on reader pages under 2.5 s. Neither helped (2.59 s and
  2.72 s), so both were reverted. See the checklist for the remaining 60 ms.

## Verified

`astro check` 0 errors; 27 unit tests; 138 e2e tests pass (8 skipped by design:
desktop-only and mobile-only cases); `check-dist` clean; anchor report clean;
Lighthouse as above; screenshots in this folder.
