# still-point — an interactive, annotated *Four Quartets*

A reading edition of T. S. Eliot's *Four Quartets*: the poem at the centre, with
margin notes, elemental scenes, a soundscape and maps that deepen slow reading.
Contemplative and restrained — illuminated manuscript meets planetarium.

> **Readable poem text is not in this repository.** A fresh checkout uses placeholder
> lines in the exact shape of the sequence. Production builds decrypt the hosted
> text bundle using a Cloudflare secret. See [RIGHTS.md](RIGHTS.md).

**Live:** https://four-quartets-interactive.pages.dev

## Status

Built in phases (see [docs/PLAN.md](docs/PLAN.md); screenshots and reviews in
[docs/progress/](docs/progress/)).

- [x] 0 — Plan
- [x] 1 — Scaffold, data model, sample text, importer, reader with margin notes
- [x] 2 — Burnt Norton annotation corpus, anchor resolver and report
- [x] 3 — Elemental scenes and tile transitions
- [x] 4 — Still Point home, Movement Map, Time Spiral, Motif Tracer
- [x] 5 — Atlas, soundscape, search, notes
- [x] 6 — Audits, annotations for all four quartets, docs

Where it stands: [docs/CHECKLIST.md](docs/CHECKLIST.md) (the definition of done, with
the gaps that remain).

## What's in it

- **Reader** — each quartet as one continuous scroll, margin notes on wide screens and a
  bottom sheet on phones, three densities (Clean, Reader, Scholar), deep links to lines
  and ranges, bookmarks and personal notes, print/PDF with endnotes.
- **174 annotations** across the four quartets — allusions, sources, places, history,
  prosody — each marked *established* or *interpretive*, with citations
  ([/sources](https://four-quartets-interactive.pages.dev/sources)).
- **Scenes** — one WebGL scene per element (air, earth, water, fire), tile transitions
  at movement boundaries, illustrated stills for reduced motion.
- **Explore** — the Still Point home, a Movement Map and side-by-side comparison, a
  Time Spiral, a Motif Tracer and an Atlas of places and sources.
- **Soundscape and search** — a generated drone per quartet (off by default) and
  Pagefind search over lines, notes and motifs.

Lighthouse on the production build: performance 93–100, accessibility, best practices
and SEO 100 on every audited route ([reports/lighthouse/summary.md](reports/lighthouse/summary.md)).

## Quick start

```sh
npm install
npm run dev                 # http://localhost:4321 (sample text)
npm test                    # unit tests (importer, resolver)
npm run test:e2e            # Playwright: reader, explore, search, axe, contrast, frame time
npm run lighthouse          # audit the production build → reports/lighthouse/
```

### Reading your own copy

```sh
# put burnt-norton.txt, east-coker.txt, the-dry-salvages.txt, little-gidding.txt
# (or one combined file) in content/text-private/ — see docs/TEXT-FORMAT.md
npm run import-text         # → content/text-private/quartets.json (git-ignored)
npm run resolve-anchors     # → reports/unresolved-anchors.md
npm run dev
```

## Contributing

Adding a note, a source or a feature: see [CONTRIBUTING.md](CONTRIBUTING.md).

## Deployment

Cloudflare Pages automatically builds and deploys pushes to `main`. Production uses
`STILLPOINT_PUBLIC=0`, `STILLPOINT_TEXT=private`, `STILLPOINT_PUBLISH_TEXT=1`, and
the secret `STILLPOINT_TEXT_KEY` to read `content/text-hosted/quartets.enc.json`.
The bundle is compressed and encrypted with AES-256-GCM; readable text and the key
are not committed. A missing or incorrect key fails the build instead of publishing
placeholders. Preview builds continue to use `STILLPOINT_PUBLIC=1` and sample text.

After editing the local poem files:

```sh
npm run import-text
npm run pack:hosted
# Commit the updated encrypted bundle and push to main.
```

`pack:hosted` reuses the key in the Git-ignored `.env.hosted` file (or
`STILLPOINT_TEXT_KEY` in the environment). Keep that key consistent with the
Cloudflare production secret. On a new machine, restore the key before repacking.

You can also upload directly from a machine with the imported text:

```sh
npm run deploy
```

This runs `build:hosted`, which requires a local text bundle or the encrypted bundle
and its key, builds the reader and search index with that text, and uploads `dist/` to the
production branch of the `four-quartets-interactive` Cloudflare Pages project.
Wrangler uses `CLOUDFLARE_API_TOKEN` or an existing `wrangler login` session.
To build without uploading, run `npm run build:hosted`.

Readable poem files remain ignored by Git. Direct uploads do not disable automatic
Git builds; commit an updated encrypted bundle to keep both deployment paths in sync.

## Licence

Code: MIT ([LICENSE](LICENSE)). Annotations and prose: CC BY 4.0. Fonts: SIL OFL.
