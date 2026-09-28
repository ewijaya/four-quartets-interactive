# Text format for `scripts/import-text.ts`

The importer reads plain UTF-8 text. It is deliberately forgiving: paste the poem
from your edition, check the import report, and add a directive where the
heuristics need help.

| In the file | Means |
|---|---|
| A quartet title (`Burnt Norton`, `EAST COKER`, `The Dry Salvages`…) | Starts that quartet. Optional when the file name identifies the quartet. |
| Lines between the title and movement I | **Front matter** — Burnt Norton's Greek epigraphs, the headnote to The Dry Salvages. Greek script is detected and marked `lang="grc"`. Never line-numbered. |
| A line containing only `I`, `II`, `III`, `IV` or `V` (a trailing period is fine) | Starts the next movement. Numerals out of sequence are kept as verse and reported. |
| One or more blank lines | A stanza (verse paragraph) break. |
| Leading spaces | Indentation, preserved (a tab counts as 4 spaces) and rendered in em. |
| A line indented 16+ spaces directly after a verse line | A **stepped** (dropped) line: it is drawn starting where the previous line ends. |
| `%% step` / `%% nostep` on the line before | Force or forbid the stepped-line reading of the next line. |
| `%% edition: Faber 1944` | Records the edition in the bundle and the report. |
| Any other line starting `%%` | A comment. |

Normalisation: a byte-order mark, Windows line endings, trailing spaces and
non-breaking spaces used for indentation are handled. The display text keeps the
source's typography (curly quotes, dashes, diacritics); matching of annotation
lemmas ignores those differences.

**Line numbers** restart in every movement and count every printed verse line,
including stepped lines. Headings, front matter and blank lines are not counted.
Deep links use these numbers: `/burnt-norton/1#12`, `/burnt-norton/1#12-18`.

After importing, read `reports/import-report.md`: it lists line and stanza counts
per movement and any warnings, without reproducing the text.
