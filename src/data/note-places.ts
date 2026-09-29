import type { Place } from "../lib/model";

/**
 * Where the notes of type "place" are, for the Atlas's second layer. Each point is
 * something the note itself names or describes; coordinates are approximate, and
 * "uncertain" where the note does not fix a spot. `place` ties a note to an Atlas
 * place (src/data/places.ts), whose card then lists it.
 */
export interface NotePoint {
  name: string;
  lat: number;
  lng: number;
  precision: Place["precision"];
}
export interface NotePlace {
  /** Annotation id (content/annotations). */
  note: string;
  place?: string;
  points: NotePoint[];
}

const at = (name: string, lat: number, lng: number, precision: Place["precision"] = "approximate"): NotePoint => ({ name, lat, lng, precision });

export const NOTE_PLACES: NotePlace[] = [
  { note: "bn-burnt-norton", place: "burnt-norton", points: [at("The house", 52.0643, -1.7876)] },
  { note: "bn-box-circle", place: "burnt-norton", points: [at("The formal garden", 52.064, -1.788)] },
  { note: "bn-drained-pool", place: "burnt-norton", points: [at("The drained pool", 52.0638, -1.7885)] },
  { note: "bn-disaffection", place: "russell-square", points: [at("Gloucester Road station", 51.4945, -0.1829)] },
  {
    note: "bn-london-districts",
    points: [
      at("Hampstead", 51.556, -0.178),
      at("Highgate", 51.571, -0.146),
      at("Primrose Hill", 51.539, -0.16),
      at("Clerkenwell", 51.524, -0.105),
      at("Ludgate", 51.5139, -0.103),
      at("Campden Hill", 51.5035, -0.2),
      at("Putney", 51.461, -0.217),
    ],
  },
  { note: "ec-east-coker", place: "east-coker", points: [at("The village", 50.9107, -2.6526)] },
  { note: "ec-deep-lane", place: "east-coker", points: [at("The lane into the village", 50.915, -2.643)] },
  { note: "ec-tube-train", place: "russell-square", points: [at("The Underground", 51.4945, -0.1829, "uncertain")] },
  { note: "ds-dry-salvages", place: "dry-salvages", points: [at("The rocks and beacon", 42.673, -70.563)] },
  { note: "ds-ragged-rock", place: "dry-salvages", points: [at("The ragged rock", 42.673, -70.563)] },
  { note: "ds-strong-brown-god", place: "st-louis", points: [at("The Mississippi at St Louis", 38.627, -90.184)] },
  { note: "ds-losses", place: "eastern-point", points: [at("The Gloucester fishery", 42.609, -70.662, "uncertain")] },
  { note: "ds-tolling-bell", points: [at("Bell buoys off Cape Ann", 42.65, -70.58, "uncertain")] },
  {
    note: "ds-lady-shrine",
    points: [at("Our Lady of Good Voyage, Gloucester", 42.6147, -70.6655), at("Notre-Dame de la Garde, Marseille", 43.284, 5.3713)],
  },
  { note: "ds-yew-tree", place: "east-coker", points: [at("St Michael's churchyard", 50.9101, -2.6531)] },
  { note: "lg-little-gidding", place: "little-gidding", points: [at("The hamlet", 52.4105, -0.3776)] },
  { note: "lg-pig-sty", place: "little-gidding", points: [at("The approach to the church", 52.4108, -0.3785)] },
  { note: "lg-history-now", place: "little-gidding", points: [at("The chapel", 52.4103, -0.3772)] },
  {
    note: "lg-world-end",
    points: [at("Iona", 56.3348, -6.3919), at("Lindisfarne", 55.6691, -1.801), at("Glendalough", 53.0106, -6.3273)],
  },
];
