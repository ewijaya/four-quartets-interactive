# still-point — Plan

An interactive, annotated *Four Quartets*. This document is the working blueprint: the
architecture, component tree, data flow, risks, and the decisions taken on the owner's
behalf (the owner asked for autonomous execution, so open questions are answered with a
stated default and can be revisited).

> Guiding rule: **the poem is the page.** Every other layer (notes, scenes, sound,
> visualizations) must be optional, quieter than the text, and removable without loss.

---

## 1. Environment (verified 2026-09-28)

| Tool | Version | Notes |
|---|---|---|
| Node | 25.2 (Homebrew) | Astro 7 needs ≥ 22.12. The login shell's lazy `nvm` wrapper recurses; scripts call the binaries directly. |
| Astro | 7.3 | Vite 8, Rust compiler (strict HTML), Sätteri Markdown, `compressHTML: 'jsx'` default (we override), Fonts API stable, content layer only. |
| @astrojs/mdx | 8.0 | Annotation bodies. |
| TypeScript | 6.x | `@astrojs/check` does not yet support TS 7. |
| three | r186 | Custom `ShaderMaterial`s, `InstancedBufferGeometry`, `OrbitControls`. |
| gsap | 3.15 | ScrollTrigger (reading progress, cues, tile triggers) + tweening uniforms. |
| d3 | 7.9 (modular imports) | Arc diagram, orthographic globe. |
| pagefind | 1.5 | Node API for custom line-level records. |
| Playwright | 1.63 | e2e, screenshots, stills, frame-time probes. |
| Vitest | 5 | Unit tests (importer, resolver, segmentation, storage). |
| Hardware | Apple M1, 8 GB | Same class as the "M1 MacBook Air" performance target. |

## 2. Decisions taken (defaults, all revisable)

1. **No UI framework.** Astro components for markup + small vanilla-TS modules/custom
   elements for behaviour. The UI state is tiny; frameworks would only cost bytes.
2. **The quartet is the reading unit.** A quartet is read like a quartet is heard — all five
   movements in one continuous scroll. Each movement URL (`/burnt-norton/3`) is a static
   *variant* of the same quartet page that opens at that movement, gives that movement's
   lines the short fragment ids (`#12`), and marks only that movement for search indexing.
   Scrolling into another movement updates the URL with `history.replaceState`, so deep
   links, reloads, and sharing always reflect where the reader is.
   *Why:* scroll-linked scenes and "tile transitions at movement boundaries" are both
   continuous-reading ideas; printing a quartet becomes trivial; deep links still work
   without JavaScript (`/burnt-norton/1#12` scrolls natively).
3. **Astro `<ClientRouter />` + a persistent Stage.** One WebGL renderer and one audio
   engine live in a `transition:persist` element, so sound and GPU context survive
   navigation. Scenes are per-route modules, lazy-imported and disposed on route change.
4. **One WebGL context for everything** (background scenes, tile transitions, home
   armillary, time spiral). Contexts are expensive and capped; switching scenes is cheap.
5. **Text never ships unless you ship it.** `STILLPOINT_TEXT=auto|sample|private`
   (auto = private if present). `STILLPOINT_PUBLIC=1` forces sample and a post-build guard
   (`scripts/check-dist.ts`) fails the build if any private line appears in `dist/`.
   Progress screenshots are always captured against the sample text so `docs/progress`
   is safe to commit.
6. **Anchors are resolved at build time** by the same module the CLI resolver uses. In
   sample mode lemmas cannot match placeholders, so each annotation carries a `hint`
   (approximate line) used for placement; the report says so explicitly.
7. **Emblems** are the four alchemical element signs (air △ with bar, earth ▽ with bar,
   water ▽, fire △) set in a circle — geometric, historically apt for a manuscript, and
   legible at tile resolution.
8. **Fonts:** EB Garamond (poem; has Greek for the Heraclitus epigraphs), Cormorant
   Garamond (display numerals and titles), Alegreya Sans (UI and notes; a humanist sans with
   calligraphic roots). All OFL, self-hosted through Astro's Fonts API with metric-matched
   fallbacks (no layout shift).
9. **Line numbering:** per movement, counting every printed verse line (a dropped/stepped
   half-line counts as its own line). Headings, front matter and blank lines are not counted.
10. **Hosting:** static output works on Vercel (default, `vercel.json` provided) and on
    GitHub Pages (`BASE_PATH` env + a workflow). Nothing is deployed from this session.
11. **Recordings:** linked out, never hosted; every link is checked before it ships.
12. **Annotation spelling:** British (matching Eliot's printed text); citations are
    author–date with a bibliography; page locators only when verified, otherwise the
    citation is marked `to-verify` and appears in `reports/citations-to-verify.md`.

## 3. Architecture

```
                 ┌──────────────────────────── build time ─────────────────────────────┐
 content/text-private/*.txt ─┐                                                          │
 content/text-sample/*.txt  ─┴─ scripts/import-text.ts ──► quartets.json (per source)   │
                                                          │                              │
 content/annotations/**/*.mdx ──► Astro content collection│(glob loader, zod schema)     │
 src/data/{motifs,places,sources,bibliography,cues,…}.ts ─┤                              │
                                                          ▼                              │
                               src/lib/text/load.ts (private ▸ sample, env override)     │
                               src/lib/anchors/resolve.ts (lemma → line + char range)    │
                                 │                         └─► scripts/resolve-anchors.ts │
                                 │                              → reports/unresolved-anchors.md
                                 ▼                                                        │
                   Astro pages (SSG): reader variants, compare, map, spiral, motifs,      │
                   atlas, note permalinks, sources, about, my-notes                       │
                                 ▼                                                        │
            dist/ ─► pagefind (pages + custom per-line records) ─► check-dist (rights)   │
                 └───────────────────────────────────────────────────────────────────────┘

 ┌──────────────────────────── in the browser ─────────────────────────────┐
 │ 1. HTML + CSS: poem readable, notes present as endnotes (no JS needed)   │
 │ 2. reader.ts (≈20 KB): prefs, density, anchors → disclosures, margin     │
 │    layout, bottom sheet, deep links, line tools, bookmarks, keyboard     │
 │ 3. idle + motion allowed + WebGL: stage/boot.ts → three + gsap           │
 │    → scene module for the route (air/earth/water/fire/home/spiral)       │
 │ 4. on demand: audio engine, search (pagefind), d3 viz modules            │
 └──────────────────────────────────────────────────────────────────────────┘
```

### Routes

| Route | Page | Notes |
|---|---|---|
| `/` | The Still Point | Armillary of four elemental orbits; real `<nav>` list mirrors the orbits. |
| `/[quartet]` | Title page variant | Title, year, element, place, front matter, then movement I…V. |
| `/[quartet]/[1-5]` | Movement variant | Same quartet, opens at movement *n*; `#12` = line 12 of *n*. |
| `/map` | Movement Map | 4×5 grid; column headers lead to compare views. |
| `/compare/[1-5]` | Compare | Same movement across the four quartets, side by side (swipe panels on mobile). |
| `/spiral` | Time Spiral | 3D helix of the whole sequence. |
| `/motifs`, `/motifs/[id]` | Motif Tracer | D3 arc diagram + static occurrence tables. |
| `/atlas`, `/atlas/[place]` | Atlas | Inked orthographic globe + sketched cards. |
| `/notes/[id]` | Annotation permalink | Shareable; indexed by search. |
| `/sources` | Sources & bibliography | Intertexts and scholarship. |
| `/my-notes` | Bookmarks & personal notes | Client-rendered from localStorage; export/import. |
| `/about` | About, rights, recordings, credits | |

### Component tree (abridged)

```
BaseLayout.astro
├─ <head>: fonts, theme bootstrap (inline, pre-paint), ClientRouter, meta
├─ SkipLinks
├─ SiteHeader ─ Wordmark · QuartetSwitch · MovementPips · DensitySwitch
│               · SearchButton · SoundToggle · ThemeToggle · Menu
├─ Stage (transition:persist) ─ <canvas> · <img class="still"> (poster/reduced motion)
├─ <main> (slot)
│   ReaderPage
│   ├─ TitlePage (quartet facts, FrontMatter)
│   ├─ Movement ×5
│   │   ├─ MovementHeading (numeral + caption; tile-transition target)
│   │   ├─ Stanza → Line (number, indent, step, anchor segments)
│   │   └─ NotesAside (NoteCard ×n: title, type, confidence, body, sources, related, motifs)
│   ├─ MovementPager
│   └─ NoteSheet (mobile), LineTools, SampleBadge
│   MapPage · ComparePage · SpiralPage · MotifsPage · AtlasPage · …
├─ SearchDialog (lazy) · ShortcutsDialog
└─ SiteFooter
```

### Source layout

```
src/
  layouts/ components/{chrome,reader,viz,notes}/ pages/
  lib/
    model.ts                 types shared by app + scripts
    text/  parse.ts load.ts sample-shape.ts
    anchors/ normalize.ts resolve.ts segment.ts
    content.ts               queries over annotations/motifs/places
    client/ prefs.ts store.ts reader.ts margin.ts sheet.ts deeplink.ts
            linetools.ts storage.ts keyboard.ts search.ts
    stage/  boot.ts renderer.ts loop.ts quality.ts reading.ts scene-host.ts
            tiles.ts emblems.ts scenes/{home,air,earth,water,fire,spiral}.ts
            glsl/*.glsl
    audio/  engine.ts voices.ts modes.ts
    viz/    arc.ts globe.ts sketch.ts movement-shape.ts
  data/ motifs.ts places.ts sources.ts bibliography.ts functions.ts cues.ts recordings.ts
content/ text-private/ (gitignored)  text-sample/  annotations/{bn,ec,ds,lg}/*.mdx
scripts/ import-text.ts make-sample.ts resolve-anchors.ts check-dist.ts
         index-search.ts render-stills.ts shoot.ts lighthouse.ts check-contrast.ts
tests/ unit/ e2e/        reports/        docs/progress/phase-N/
```

## 4. Data model

```ts
type QuartetId = "burnt-norton" | "east-coker" | "the-dry-salvages" | "little-gidding";
type QuartetCode = "BN" | "EC" | "DS" | "LG";
type MovementN = 1 | 2 | 3 | 4 | 5;

interface Line {
  id: string;            // "BN.1.12"
  quartet: QuartetCode; movement: MovementN; stanza: number; n: number;
  text: string;
  indent: number;        // leading-space count from the source (rendered in em)
  step?: boolean;        // dropped line: begins where the previous line ended
}
interface Annotation {
  id: string;            // "bn-still-point"
  anchor: { quartet: QuartetCode; movement: 0 | MovementN; lemma?: string;
            occurrence?: number; lineStart?: number; lineEnd?: number; hint?: number };
  type: "allusion" | "source" | "place" | "biography" | "history" | "prosody"
      | "theme" | "crossref" | "textual";
  title: string; body: MDX; sources: Citation[]; related: string[];
  motifs: MotifId[]; confidence: "established" | "interpretive";
  level: "reader" | "scholar";   // density; defaults from type
}
interface Citation { ref: string /* source or bib id */; locator?: string;
                     note?: string; status: "verified" | "to-verify" }
interface Motif  { id: MotifId; name: string; gloss: string; occurrences: MotifOccurrence[] }
interface Place  { id; name; lat; lng; quartet?; kind: "quartet" | "source";
                   blurb; illustrationPrompt; precision: "exact" | "approximate" | "uncertain" }
interface Source { id; author; work; note; placeId? }   // intertexts (Heraclitus, Julian…)
interface BibEntry { id; author; year; title; publisher?; note? } // scholarship
```

Additions to the brief's model, and why: `anchor.quartet` (anchors must not depend on
folder names), `occurrence` and `hint` (repeated phrases; sample-mode placement), `level`
(density), `Citation.status` (so unverified locators are visible), `Place.precision` (an
anonymous 14th-century text has no exact coordinates).

Motifs: rose, garden, fire, water, dance, still-point, time, word-silence, light-dark,
dove, bell, yew, sea, ascent-descent.

## 5. Text pipeline

**Input format** (`content/text-private/burnt-norton.txt`, one file per quartet; filename
or title line identifies the quartet):

* First non-blank line may be the title.
* Lines before the first movement heading are **front matter** (Burnt Norton's Greek
  epigraphs; The Dry Salvages' headnote). Greek script → `lang="grc"`.
* A line containing only `I`–`V` (optionally with a period) starts a movement.
* One or more blank lines end a stanza.
* Leading spaces are kept as the indent (tabs = 4 spaces).
* A line indented ≥ 16 spaces directly after a verse line is treated as a **stepped**
  (dropped) line; `%% step` / `%% nostep` on the preceding line overrides the heuristic.
* Lines starting `%%` are directives/comments (`%% edition: …`), never rendered.
* CRLF, BOM, non-breaking spaces and curly/straight quote variants are normalised for
  matching, but the display text keeps the source typography.

**Output:** `quartets.json` + `reports/import-report.md` (counts, stanza shapes, anomalies —
never the text itself). `make-sample.ts` writes placeholder `.txt` files from a shape table
and imports them through the same importer, so the sample exercises the real code path.

## 6. Annotation system

* MDX files, one per annotation, grouped by quartet. Frontmatter holds the model; the
  body may use `<Cite>`, `<Ref>` (cross-reference to a line or note) and `<Motif>`.
* **Resolver:** normalises case, punctuation, quotes, dashes and whitespace; matches
  lemmas across line breaks; honours `occurrence`, else prefers the match nearest `hint`;
  reports misses with the nearest candidate windows (≤ 6 words each) and edit distance.
* **Segmentation:** overlapping lemmas are split into non-overlapping segments, each
  carrying the set of note ids; ranges (`lineStart…lineEnd` without lemma) draw a margin
  bracket; movement-level notes attach to the heading.
* **Density:** Clean (no anchors, no notes), Reader (`level: reader`), Scholar (all).
* **Disclosures:** server-rendered anchors are plain `<span>`s (so Clean mode and screen
  readers get clean text). JavaScript upgrades visible ones to `role="button"` with
  `aria-expanded`/`aria-controls`, opening on hover (preview), click/tap or Enter/Space.
* **Placement:** ≥ 1100 px: glosses in the right margin aligned to their lines with
  collision stacking; below that: a non-modal bottom sheet (peek/full snap points, Esc to
  close, focus returns to the anchor). Without JS: endnotes after each movement.
* **Scholarly hygiene:** `confidence` shown on every note; no quotation from critics or
  letters; lemmas ≤ 6 words enforced by schema; every note starts `reviewed: false`.

## 7. Reader UX

* Column ≈ 60ch, EB Garamond, 1.62 leading; turn-over lines hang (poetry convention);
  stepped lines positioned under the end of the previous line (measured at runtime,
  CSS approximation before JS).
* Line numbers every fifth line in the gutter (aria-hidden, unselectable); hovering or
  focusing a line reveals its number and a line tool (copy link · bookmark · note).
* Deep links: `/burnt-norton/1#12` scrolls natively; JS adds a soft, fading highlight,
  and ranges `#12-18` highlight several lines.
* Progress rail: five ticks per quartet at the left edge; header hides while reading
  down, returns on scroll up.
* Sample badge, fixed and quiet, whenever the sample text is loaded.

## 8. Stage, scenes and transitions

* **Loop:** a single `requestAnimationFrame` loop; pauses on `visibilitychange`,
  `pagehide`, offscreen canvases (IntersectionObserver) and when scenes are turned off.
  No allocation per frame: scratch vectors and typed arrays are preallocated; animation
  lives in shaders driven by a handful of uniforms.
* **Quality tiers** 0–3 (static still, low, medium, high). Initial guess from pointer type,
  screen size, `deviceMemory`, `hardwareConcurrency`, `saveData`; then adaptive with
  hysteresis on an EMA of frame time. Tiers change draw ranges and pixel ratio — never
  reallocate. Background scenes render below device resolution (they are soft by design).
* **Contrast by construction:** each scene clamps its output luminance to a theme band,
  and a shader scrim lightens/darkens the text column; a Playwright test samples
  frames behind the column and asserts ≥ 4.5 : 1 for body text.
* **Two looks per scene:** Vellum = ink-wash on paper; Night = light in darkness.
* **Reading state:** ScrollTrigger feeds `{quartet, movement, progress, cue}` to the
  scene; **cues** are lemma-anchored (resolved like annotations) so the text drives events.

| Scene | Layers | Cues (examples) |
|---|---|---|
| Burnt Norton · air | dappled leaf-shadow field, light shaft, curl-noise motes | pool shimmer appears, a cloud passes and it vanishes; the kingfisher's glint; "shaft of sunlight" |
| East Coker · earth | falling grains settling into strata; firelit ring of silhouettes dancing slowly | the midsummer dance fades in/out; the dark of movement III |
| The Dry Salvages · water | river flow-field flowing into a Gerstner ocean with fog; rocking bell buoy (CPU-sampled from the same wave sum) | river → sea; fog thickens; the bell |
| Little Gidding · fire | embers; low midwinter sun on ice; particles that flock into a dove; finale where fire and rose become one shape | midwinter spring; dove descending; the rose |

**Tile transitions:** when a movement heading enters the reading zone, its numeral and caption
are rendered to a texture, cut into tiles, lifted, flocked into the element's emblem and
settled back — all in a vertex shader (per-instance start/target/seed; one progress
uniform). The DOM heading stays in the accessibility tree; it is only visually hidden
while tiles fly. Tiles render beneath the text layer, so they never obscure words.

**Reduced motion / no WebGL:** a pre-rendered still for every quartet × movement × theme
(`scripts/render-stills.ts` captures the real scenes deterministically) replaces the canvas;
tiles, parallax and smooth scrolling are off.

## 9. Visualizations

* **Still Point (home):** four tilted particle rings ordered as the medieval sublunary
  spheres — earth, water, air, fire — around a luminous centre and a faint still axis.
  Hover/focus brightens a ring and reveals its caption; choosing it flies the camera in,
  then navigates. Keyboard and screen readers use the mirrored `<nav>` list.
* **Movement Map:** a real HTML grid (accessible as is). Each cell: stanza-shape sparkline,
  line count, motif dots, the movement's parallel function. Column headers → compare.
* **Compare:** four columns of the same movement; optional proportional scroll-sync;
  explanatory headnote on the movement's function (interpretive, cited).
* **Time Spiral:** helix, one turn per quartet, five arcs per turn; lines as dim points,
  annotations and motif occurrences as coloured lights, reading position glowing; orbit,
  zoom, click to jump. Text alternative: a structured list that is also the keyboard UI.
* **Motif Tracer:** arc diagram over the full sequence (quartet/movement bands on the
  baseline, arcs between successive occurrences), up to three motifs overlaid; every
  occurrence a focusable link; tables as the text alternative.
* **Atlas:** d3 orthographic globe drawn as ink (hand-wobbled strokes), quartet places and
  source origins (uncertain ones as dashed halos), great-circle arcs from each source to the
  quartet it enters; cards with seeded rough.js sketches generated from each place's
  `illustrationPrompt`.

## 10. Sound, search, notes, print

* **Soundscape:** opt-in, muted by default. Four persistent voices (vln I/II, vla, vc)
  built from band-limited oscillators, filters and slow vibrato; pitches glide between
  modal degrees (no node allocation per note). Per-quartet mode and timbre (air: Lydian
  and breath noise; earth: Dorian, dark; water: Aeolian with chorus and a bell partial;
  fire: brighter harmonics), per-movement density (IV nearly silent, V all four). Master
  compressor and gentle ceiling. Persists across navigation.
* **Search:** Pagefind over pages + a custom record per line (`/burnt-norton/2#14`),
  with quartet/type filters; dialog opened by `/` or the header button.
* **Bookmarks & notes:** versioned localStorage schema, export/import JSON, shown in the
  margin in a distinct hand, listed on `/my-notes`.
* **Print/PDF:** print stylesheet (no scenes/chrome, numbered lines, notes as endnotes at
  the chosen density, stanzas kept whole when short).

## 11. Design system

* **Vellum:** warm vellum paper, iron-gall ink, rubric red, gold used sparingly.
  **Night:** deep planetarium blue-black, starlight ivory text, softened gold.
* **Quartet accents** (ink for text, glow for scenes): air — slate sky & garden rose;
  earth — umber & ochre; water — sea teal & fog; fire — ember & gold.
* Motion: 600–1600 ms, slow ease-out; nothing faster than a 2 s period loops.
* Glosses look like marginalia: small-caps rubric title, type glyph, confidence mark.
* Every token pair is contrast-checked by script in both themes.

## 12. Performance & accessibility budgets

| Budget | Target |
|---|---|
| LCP (poem text) | < 2.5 s on simulated mid-range mobile |
| Critical JS (reader) | ≤ 25 KB gzip; three/gsap only after idle |
| Frame time | ≤ 16.7 ms p95 at chosen tier (M1), adaptive on mobile |
| Lighthouse | ≥ 90 in all four categories on `/`, a reader page, `/map`, `/motifs`, `/atlas` |
| axe | zero violations on every route, both themes |
| Console | zero errors on every route (test fails on any) |

Accessibility: landmarks, skip links, headings per movement ("Movement 1"), `lang` on
front matter, line numbers hidden from AT, disclosures for notes, non-modal sheet with
Esc, visible focus, single-key shortcuts that can be switched off (WCAG 2.1.4),
`prefers-reduced-motion`, `prefers-contrast: more` (scenes off, stronger underlines),
forced-colours support, text alternatives for every visualization.

## 13. Verification loop (every phase)

1. `npm run check` (types), `npm test` (unit), `npm run build`.
2. `npm run shoot -- --phase N`: Playwright captures each key route at 1440×900 and
   390×844 in Vellum and Night into `docs/progress/phase-N/`.
3. Look at every screenshot; write the three weakest aspects into
   `docs/progress/phase-N/REVIEW.md`; fix; re-shoot; note what changed.
4. e2e + axe + console-error checks.

## 14. Phases

| Phase | Deliverables | Done when |
|---|---|---|
| 1 | Scaffold, tokens, fonts, themes, model, sample generator, importer (+tests), reader with margin notes & sheet, density, deep links, RIGHTS.md | Sample text renders in both themes on both viewports; notes open by mouse, touch, keyboard |
| 2 | Burnt Norton corpus (complete), sources, bibliography, motifs registry, resolver + report, note permalinks, `/sources` | Resolver report generated; BN fully annotated at Reader and Scholar levels |
| 3 | Stage, loop, tiers, four scenes, cues, tile transitions, stills, reduced motion, contrast test | Scenes run, pause, dispose; contrast test passes; reduced-motion shows stills |
| 4 | Still Point home, Movement Map, compare, Time Spiral, Motif Tracer (+ occurrence data) | All four usable by mouse, touch, keyboard; text alternatives present |
| 5 | Atlas, soundscape, Pagefind search, bookmarks & notes, print | Each feature works on both viewports and themes |
| 6 | Perf/a11y/mobile audits, remaining annotations (150+ total), README, CONTRIBUTING, LICENSE, final checklist | Definition of done met, or gaps listed honestly |

## 15. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Copyright leakage (dist, search index, screenshots, reports) | Env guard, `check-dist`, sample-only screenshots, reports never contain text beyond ≤ 6-word windows, `.gitignore` for private text |
| Lemmas written from memory differ from the imported edition | Fuzzy resolver with suggestions; `hint` fallback; report for hand-fixing |
| Scholarly errors / invented citations | Only works known to exist; no quotations from critics or letters; `confidence` + `status: to-verify`; `reviewed: false` until the owner signs off |
| WebGL cost on mid-range Android | Half-resolution backgrounds, tiers, draw-range scaling, pause offscreen, stills fallback |
| Lighthouse TBT from three.js | Load after idle; `compileAsync`; scenes never block text |
| Headless WebGL for screenshots/stills | Chromium with ANGLE/Metal; deterministic time (`?still=1&t=…`); fallback to SwiftShader |
| ClientRouter + persistent canvas lifecycle bugs | Scene host owns all GPU objects; route change = one code path (dispose → create); e2e test navigates across all routes watching for errors and context count |
| Astro 7 is newer than most examples | Pin versions; read the upgrade guides (done); keep integration surface small |
| iOS Safari: audio unlock, `dvh`, context loss | Gesture-gated audio start, `dvh` units, `webglcontextlost` handler → still |

## 16. Open questions (answered with defaults; tell me to change any)

1. Which edition will be imported, and does it number stepped lines separately? *(Default:
   separate lines; the importer can join them with one flag.)*
2. Public deployment strategy: sample-only public site, private deploy with real text, or a
   future "bring your own text" mode that parses a reader's copy locally in the browser?
   *(Default: sample-only public; real text local/private.)*
3. Vercel or GitHub Pages? *(Default: Vercel config + a Pages workflow; not deployed.)*
4. Preferred recordings to link? *(Default: a short, verified list on `/about`.)*
5. Annotation audience: general readers first, with Scholar depth. *(Default.)*
