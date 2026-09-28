# Rights

## Readable poem text is not distributed with this repository

*Four Quartets* is the work of T. S. Eliot (1888–1965). Its text is protected by
copyright, held by the Eliot estate and administered by his publishers (Faber and
Faber in the UK). **Readable poem text is not included in this repository or in
any build produced from a fresh checkout by default.** An encrypted bundle is
committed for hosted builds; its decryption key is a Cloudflare production secret.

Instead:

- `content/text-sample/` holds **placeholder lines** (`BN.1 line 12 — placeholder`)
  arranged in the shape of the sequence — four quartets × five movements with
  approximate stanza and line counts. The shape is structural information, not text.
- `content/text-private/` is where you may place **your own copy** of the text for
  local reading or an explicitly selected hosted edition. Everything in that folder
  except its README and `.gitkeep` is ignored by git.
  The importer (`npm run import-text`) turns it into `quartets.json` in the same folder.

When the private text is present, the app renders it; otherwise it renders the sample
and shows a **Sample text** badge.

### Guard rails

| Risk | Safeguard |
|---|---|
| Private text committed to git | `.gitignore` excludes `content/text-private/*` |
| Imported text unintentionally included in a sample build | `STILLPOINT_PUBLIC=1` forces the sample text; `scripts/check-dist.ts` scans `dist/`, including the search index, for imported passages |
| Text leaking through reports | `reports/*.md` describe structure only; the anchor report shows at most six-word windows |
| Text leaking through screenshots | `npm run shoot` always builds with the sample text; the images in `docs/progress/` never show the poem |

## Quotation in the annotations

Annotations are original commentary. Each may carry a **lemma** — a short phrase of
**at most six words** used as an anchor label, the conventional form of reference in
scholarly commentary. The schema rejects longer lemmas at build time. Note bodies
refer to the poem only in short phrases of the same kind (six words or fewer), and do
not quote critics or letters: they paraphrase and cite. For sample builds,
`scripts/check-dist.ts` fails the build if any longer line of the imported poem
appears in the output, notes included.
Public-domain texts (the King James Bible, Julian of Norwich, Dante, and so on) are
occasionally quoted briefly.

## Hosted edition

Production pushes to `main` deliberately publish the imported text to Cloudflare
Pages. The build decrypts `content/text-hosted/quartets.enc.json` using the secret
`STILLPOINT_TEXT_KEY`; the key and readable text stay out of Git. Missing or invalid
keys fail the build. Preview builds use sample text.
`npm run pack:hosted` refreshes the encrypted bundle after a local import, using
the Git-ignored `.env.hosted` key. `npm run deploy` remains available for direct
uploads. `STILLPOINT_PUBLISH_TEXT=1` records intentional publication in the build
check; it does not override `STILLPOINT_PUBLIC=1`.
This deployment choice does not change the copyright status of the poem.

## Copyright status (orientation only — not legal advice)

- Eliot died in 1965. In countries with a term of the author's life plus 70 years
  (including the UK and the EU), his work remains in copyright until the end of 2035.
- In the United States, works first published between 1927 and 1977 are generally
  protected for 95 years from publication. The quartets were first published between
  1936 (*Burnt Norton*, in *Collected Poems 1909–1935*) and 1942 (*Little Gidding*),
  so they remain protected into the 2030s.
- Other jurisdictions differ. If you plan to publish the text, get permission from
  the rights holder or take advice.

## What this repository does contain, and under what terms

| Material | Terms |
|---|---|
| Source code | MIT — see [`LICENSE`](LICENSE) |
| Annotations, glosses, place and source notes (prose in `content/annotations/` and `src/data/`) | Creative Commons Attribution 4.0 (CC BY 4.0) |
| Visual scenes, illustrations, emblems | Generated in code (shaders, SVG, canvas); covered by the MIT license. No photographs or third-party images are used. |
| Sound | Synthesised in the browser with the Web Audio API; no audio files. Recordings of readings are linked, never hosted. |
| Fonts | EB Garamond, Cormorant Garamond, Alegreya Sans — SIL Open Font License 1.1, installed from Fontsource |
| Map data | `world-atlas` (ISC), derived from Natural Earth (public domain) |
| Libraries | Astro, three.js, rough.js, Pagefind (MIT); d3, topojson-client (ISC); GSAP (GreenSock's standard "no charge" license, <https://gsap.com/standard-license>) |

## If you are a rights holder

If you believe anything here exceeds fair dealing or fair use, please open an issue;
it will be addressed promptly.
