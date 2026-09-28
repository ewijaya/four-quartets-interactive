# Contributing

Thank you for helping. Two rules come before everything else:

1. **Never commit or publish the poem's text.** It is in copyright. Your own copy lives
   in `content/text-private/`, which git ignores; see [RIGHTS.md](RIGHTS.md).
2. **The poem is the page.** Notes, scenes, sound and maps must stay quieter than the
   verse and removable without loss.

## Setup

```sh
npm install
npm run dev          # http://localhost:4321, sample text unless you have imported your own
```

Node ≥ 22.12. To read the real text locally, follow the steps in the README
("Reading your own copy") and [docs/TEXT-FORMAT.md](docs/TEXT-FORMAT.md).

## Adding or editing an annotation

One MDX file per note in `content/annotations/<bn|ec|ds|lg>/`. The file name is the id
(`ec-grimpen.mdx` → `ec-grimpen`); by convention it starts with the quartet code.

```yaml
---
quartet: EC                 # BN | EC | DS | LG
movement: 2                 # 1–5, or 0 for a note on the whole quartet
lemma: "On the edge of a grimpen"   # ≤ 6 words, exactly as printed
hint: 41                    # the line number the lemma is on
type: allusion              # allusion | source | place | biography | history | prosody | theme | crossref | textual
title: "A grimpen"
confidence: established     # established (documented fact) | interpretive (a reading)
level: scholar              # optional; reader or scholar (prosody, textual, crossref default to scholar)
motifs: []                  # ids from src/data/motifs.ts
related: [ec-dark-wood]     # other note ids
sources:
  - ref: doyle-hound        # an id in src/data/sources.ts or src/data/bibliography.ts
    status: to-verify       # add a locator and set verified only once checked
---

Prose, in British spelling.
```

Instead of a lemma you can anchor to a range (`lineStart` / `lineEnd`) or, with
`movement: 0` or no lemma, to a quartet or movement heading. If a lemma occurs more
than once in its movement, add `occurrence: n`.

**Scholarly hygiene**

- Paraphrase and cite. Quote the poem only in short phrases (six words or fewer); do
  not quote critics or letters. Short quotations from public-domain texts (the King
  James Bible, Julian of Norwich, Dante) are fine.
- Cite only works you know exist. Add new ones to `src/data/sources.ts` (intertexts)
  or `src/data/bibliography.ts` (scholarship). Leave `status: to-verify` until a
  locator has been checked; `reports/citations-to-verify.md` lists what is outstanding.
- Mark readings as `interpretive`. Keep `established` for documented facts and
  widely accepted identifications.
- New notes start `reviewed: false`; the project owner sets `reviewed: true` after
  reading them.

**Check your anchors**

```sh
npm run resolve-anchors       # → reports/unresolved-anchors.md (0 unresolved, 0 problems)
npm run sync-hints            # with your private text: writes true line numbers into hints
```

With only the sample text, lemmas cannot match placeholders, so the `hint` places the
note; that is why hints must be right.

## Code

- No UI framework: Astro components for markup, small vanilla TypeScript modules for
  behaviour (`src/lib/client/`). The WebGL stage lives in `src/lib/stage/`, one module
  per scene; scenes load lazily and must dispose everything they create.
- Styles use the tokens in `src/styles/tokens.css`; every new colour pair needs to
  pass `npm run contrast` in both themes.
- Keep the reader's critical JavaScript under 25 KB gzip; three.js and gsap load only
  after the reader engages.

## Before you open a pull request

```sh
npm run check        # astro check (types)
npm test             # unit tests
npm run build        # includes the search index and the check-dist rights guard
npm run test:e2e     # Playwright: reader, explore, search/notes, axe, contrast, frame time
```

For visual changes, capture screenshots with `npm run shoot -- --phase N --only <name>`
(always against the sample text) and look at them in both themes and both viewports.
`npm run lighthouse` audits the production build.

Commit messages follow Conventional Commits (`feat:`, `fix:`, `content:`, `perf:`, …).

## Licence

By contributing you agree that code is released under the MIT licence and annotations
and other prose under CC BY 4.0 (see the README).
