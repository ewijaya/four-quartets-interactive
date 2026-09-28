# Phase 2 review — Burnt Norton corpus, resolver, note pages

## Three weakest aspects (first pass) and what changed

1. **Citation lines were clumsy** — intertexts rendered as "author, work, locator" with a
   stray space inside the link. → Intertexts cite by author (or title for anonymous
   works), locator appended in one string; unverified locators carry a dagger with an
   accessible explanation.

2. **The screenshot harness leaked state** — density chosen in one shot persisted into
   later shots in the same browser context, so Reader-mode shots silently showed Scholar
   mode. → Every shot now starts from identical preferences.

3. **Sample mode looked noisy in Scholar** — approximate anchors (placed by hint because
   placeholders cannot match lemmas) underlined whole lines. → Approximate anchors show a
   small ring after the line instead, underlining only on hover or when open; real,
   resolved lemmas keep the solid underline.

## What works

- 64 Burnt Norton annotations covering all five movements and the quartet as a whole
  (quartet-level history, epigraphs, place; every movement's key images, sources, prosody
  and cross-references), split between Reader and Scholar density.
- Schema enforces lemma ≤ 6 words (it caught one seven-word lemma).
- `npm run resolve-anchors` → `reports/unresolved-anchors.md` (with nearest-window
  suggestions against real text), `reports/anchors.json`, `reports/citations-to-verify.md`.
- `/notes`, `/notes/[id]` permalinks with context links and prev/next, `/sources` with
  backlinks, `/about` with verified recording links.
- 52 Playwright tests (reader behaviour + axe on 8 routes × 2 themes) pass.

## Known limits

- With the sample text every lemma is "unresolved" by design; the report is meaningful
  only after importing a real copy.
- 26 cross-references point forward to notes in the other quartets (written in Phase 6).
