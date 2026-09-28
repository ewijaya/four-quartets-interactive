/**
 * Recordings of readings — linked, never hosted. Each link was checked when added
 * (2026-09-28); links to streaming services can move, so the list is short.
 */
export interface Recording {
  reader: string;
  what: string;
  year: string;
  note: string;
  links: Array<{ label: string; href: string }>;
}

export const RECORDINGS: Recording[] = [
  {
    reader: "T. S. Eliot",
    what: "Four Quartets, read by the poet",
    year: "1947",
    note: "Eliot recorded the whole sequence for HMV; the 78 rpm discs were issued in 1947 and later reissued on LP. His reading is measured, almost liturgical — a useful corrective to more theatrical performances.",
    links: [
      { label: "Open Culture (streams the recording)", href: "https://www.openculture.com/2013/06/listen_to_ts_eliot_recite_his_late_masterpiece_the_ifour_quartetsi.html" },
      { label: "Internet Archive (Angel Records LP, samples)", href: "https://archive.org/details/lp_t-s-eliot-reads-his-four-quartets_t-s-eliot" },
    ],
  },
  {
    reader: "Ralph Fiennes",
    what: "T. S. Eliot's Four Quartets (film, directed by Sophie Fiennes)",
    year: "2023",
    note: "A film of Fiennes's one-man stage performance, which toured the UK and played at the Harold Pinter Theatre in London in 2021.",
    links: [{ label: "Review in Variety", href: "https://variety.com/2023/film/reviews/four-quartets-review-ralph-fiennes-t-s-eliot-1235594928/" }],
  },
  {
    reader: "Jeremy Irons",
    what: "Four Quartets, read by Jeremy Irons",
    year: "",
    note: "A reading by the actor, featured by the Poetry Foundation.",
    links: [{ label: "Poetry Foundation", href: "https://www.poetryfoundation.org/poetry-news/69692/jeremy-irons-reads-ts-eliots-four-quartets" }],
  },
];
