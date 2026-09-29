/**
 * What the Time Spiral's card says about a light, a movement or a motif thread, and
 * where its previous/next buttons lead. Pure, so it can be tested without a browser.
 */
import type { SpiralData } from "./spiral-layout";

export type Selection =
  | { kind: "note"; i: number }
  | { kind: "motif"; i: number }
  | { kind: "movement"; i: number }
  /** A whole motif followed up the spiral (i indexes `motifKinds`). */
  | { kind: "thread"; i: number };

export interface CardChip {
  label: string;
  color: string;
  /** Index into `motifKinds`: choosing the chip follows that motif. */
  motif: number;
}

export interface CardMeter {
  label: string;
  value: number;
  max: number;
}

export interface CardModel {
  eyebrow: string;
  title: string;
  /** The title is a phrase from the poem, shown in quotation marks. */
  quoted: boolean;
  where: string;
  body: string;
  /** The motif's colour, when the card is about one. */
  color: string | null;
  chips: CardChip[];
  meters: CardMeter[];
  related: Array<{ label: string; to: Selection }>;
  links: Array<{ label: string; href: string }>;
  step: { label: string; prev: Selection | null; next: Selection | null } | null;
}

const kindIndex = (data: SpiralData, id: string) => data.motifKinds.findIndex((k) => k.id === id);
const quartetTitle = (data: SpiralData, code: string) => data.quartets.find((q) => q.code === code)?.title ?? code;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Indices into `data.motifs` of every occurrence of one motif, in reading order. */
export function occurrencesOf(data: SpiralData, motifId: string): number[] {
  const out: number[] = [];
  data.motifs.forEach((o, i) => {
    if (o.motif === motifId) out.push(i);
  });
  return out;
}

const chipFor = (data: SpiralData, id: string): CardChip | null => {
  const k = kindIndex(data, id);
  const kind = data.motifKinds[k];
  return kind ? { label: kind.name, color: kind.color, motif: k } : null;
};

const chipsFor = (data: SpiralData, ids: string[]): CardChip[] => ids.map((id) => chipFor(data, id)).filter((c): c is CardChip => c !== null);

/** The card for a selection. `focus` is the motif currently followed (-1 for none). */
export function cardFor(data: SpiralData, sel: Selection, focus = -1): CardModel | null {
  const blank = { quoted: false, body: "", color: null, chips: [], meters: [], related: [], links: [], step: null };
  if (sel.kind === "note") {
    const n = data.notes[sel.i];
    if (!n) return null;
    return {
      ...blank,
      eyebrow: `${n.typeLabel} · ${n.confidence}`,
      title: n.title,
      where: n.where,
      body: n.excerpt,
      chips: chipsFor(data, n.motifs),
      related: n.related
        .slice(0, 3)
        .map((i) => ({ i, note: data.notes[i] }))
        .filter((r) => r.note)
        .map((r) => ({ label: r.note!.title, to: { kind: "note" as const, i: r.i } })),
      links: [
        { label: "Open the note", href: n.href },
        { label: "Read the passage", href: n.lineHref },
      ],
      step: {
        label: `Note ${sel.i + 1} of ${data.notes.length}`,
        prev: sel.i > 0 ? { kind: "note", i: sel.i - 1 } : null,
        next: sel.i < data.notes.length - 1 ? { kind: "note", i: sel.i + 1 } : null,
      },
    };
  }
  if (sel.kind === "motif") {
    const o = data.motifs[sel.i];
    if (!o) return null;
    const k = kindIndex(data, o.motif);
    const kind = data.motifKinds[k];
    const seq = occurrencesOf(data, o.motif);
    const p = seq.indexOf(sel.i);
    const links = [{ label: "Read the line", href: o.href }];
    if (o.note) links.push({ label: "Open the note", href: o.note.href });
    return {
      ...blank,
      eyebrow: `Motif · ${kind?.name ?? o.motif}`,
      title: o.lemma,
      quoted: true,
      where: o.where,
      body: kind?.gloss ?? "",
      color: kind?.color ?? null,
      chips: k >= 0 && k !== focus && kind ? [{ label: `Follow ${kind.name.toLowerCase()} up the spiral`, color: kind.color, motif: k }] : [],
      links,
      step: {
        label: `${kind?.name ?? o.motif} · ${p + 1} of ${seq.length}`,
        // Before the first occurrence comes the motif's own summary.
        prev: p > 0 ? { kind: "motif", i: seq[p - 1]! } : k >= 0 ? { kind: "thread", i: k } : null,
        next: p >= 0 && p < seq.length - 1 ? { kind: "motif", i: seq[p + 1]! } : null,
      },
    };
  }
  if (sel.kind === "movement") {
    const m = data.movements[sel.i];
    if (!m) return null;
    const title = quartetTitle(data, m.quartet);
    return {
      ...blank,
      eyebrow: "Movement",
      title: `${title} ${m.roman}`,
      where: `${plural(m.count, "line")} · ${plural(m.notes, "note")}`,
      chips: chipsFor(data, m.motifs),
      links: [
        { label: "Read the movement", href: m.href },
        { label: `Compare ${m.roman} across the quartets`, href: m.compare },
      ],
      step: {
        label: `Movement ${sel.i + 1} of ${data.movements.length}`,
        prev: sel.i > 0 ? { kind: "movement", i: sel.i - 1 } : null,
        next: sel.i < data.movements.length - 1 ? { kind: "movement", i: sel.i + 1 } : null,
      },
    };
  }
  const kind = data.motifKinds[sel.i];
  if (!kind) return null;
  const seq = occurrencesOf(data, kind.id);
  const max = Math.max(1, ...kind.counts);
  return {
    ...blank,
    eyebrow: "Motif",
    title: kind.name,
    where: plural(seq.length, "occurrence"),
    body: kind.gloss,
    color: kind.color,
    meters: data.quartets.map((q, i) => ({ label: q.title, value: kind.counts[i] ?? 0, max })),
    links: [
      { label: "Open in the Motif Tracer", href: kind.tracer },
      { label: "List every occurrence", href: kind.href },
    ],
    step: seq.length ? { label: "Start at the first occurrence", prev: null, next: { kind: "motif", i: seq[0]! } } : null,
  };
}
