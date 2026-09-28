# still-point — an interactive, annotated *Four Quartets*

A reading edition of T. S. Eliot's *Four Quartets*: the poem at the centre, with
margin notes, elemental scenes, a soundscape and maps that deepen slow reading.
Contemplative and restrained — illuminated manuscript meets planetarium.

> **The poem's text is not in this repository.** The site ships with placeholder
> lines in the exact shape of the sequence. Import your own copy locally to read
> the real text. See [RIGHTS.md](RIGHTS.md).

**Live (sample text):** https://four-quartets-interactive.pages.dev

## Status

Built in phases (see [docs/PLAN.md](docs/PLAN.md); screenshots and reviews in
[docs/progress/](docs/progress/)).

- [x] 0 — Plan
- [x] 1 — Scaffold, data model, sample text, importer, reader with margin notes
- [x] 2 — Burnt Norton annotation corpus, anchor resolver and report
- [x] 3 — Elemental scenes and tile transitions
- [ ] 4 — Still Point home, Movement Map, Time Spiral, Motif Tracer
- [ ] 5 — Atlas, soundscape, search, notes
- [ ] 6 — Polish, audits, remaining annotations

## Quick start

```sh
npm install
npm run dev                 # http://localhost:4321 (sample text)
npm test                    # unit tests (importer, resolver)
npm run test:e2e            # Playwright: reader behaviour + axe accessibility
```

### Reading your own copy

```sh
# put burnt-norton.txt, east-coker.txt, the-dry-salvages.txt, little-gidding.txt
# (or one combined file) in content/text-private/ — see docs/TEXT-FORMAT.md
npm run import-text         # → content/text-private/quartets.json (git-ignored)
npm run resolve-anchors     # → reports/unresolved-anchors.md
npm run dev
```

## Deployment

Cloudflare Pages builds every push to `main` with `STILLPOINT_PUBLIC=1`, which
forces the sample text; `scripts/check-dist.ts` fails any build that would
publish private text.

## Licence

Code: MIT ([LICENSE](LICENSE)). Annotations and prose: CC BY 4.0. Fonts: SIL OFL.
