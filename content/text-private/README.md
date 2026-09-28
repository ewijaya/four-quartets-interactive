# Private text (not distributed)

Put your own copy of the poem here, as plain text — one file per quartet
(`burnt-norton.txt`, `east-coker.txt`, `the-dry-salvages.txt`, `little-gidding.txt`)
or a single file containing all four with their titles.

Everything in this folder except this README is ignored by git. See
[`RIGHTS.md`](../../RIGHTS.md) and [`docs/TEXT-FORMAT.md`](../../docs/TEXT-FORMAT.md).

Then run:

```sh
npm run import-text       # → content/text-private/quartets.json + reports/import-report.md
npm run resolve-anchors   # → reports/unresolved-anchors.md
npm run dev               # the app now reads the real text
```
