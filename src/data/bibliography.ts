import type { BibEntry } from "../lib/model";

/**
 * Scholarship and editions cited by annotations. Only works whose existence is
 * certain are listed; page locators are added to individual citations only when
 * verified (otherwise the citation carries status "to-verify").
 */
export const BIBLIOGRAPHY: BibEntry[] = [
  {
    id: "eliot-1944",
    author: "T. S. Eliot",
    year: "1944",
    title: "Four Quartets",
    publisher: "London: Faber and Faber",
    note: "First British edition of the collected sequence (the first American edition appeared from Harcourt, Brace in 1943).",
  },
  {
    id: "ricks-mccue-2015",
    author: "Christopher Ricks and Jim McCue (eds.)",
    year: "2015",
    title: "The Poems of T. S. Eliot, Volume I: Collected and Uncollected Poems",
    publisher: "London: Faber and Faber",
    note: "The standard annotated edition; its commentary gathers sources, drafts and Eliot's own remarks.",
  },
  {
    id: "gardner-1949",
    author: "Helen Gardner",
    year: "1949",
    title: "The Art of T. S. Eliot",
    publisher: "London: Cresset Press",
    note: "Early and influential account of the five-movement structure shared by the quartets.",
  },
  {
    id: "gardner-1978",
    author: "Helen Gardner",
    year: "1978",
    title: "The Composition of Four Quartets",
    publisher: "London: Faber and Faber",
    note: "Drafts, sources and correspondence (notably with John Hayward) behind the sequence.",
  },
  {
    id: "gordon-1998",
    author: "Lyndall Gordon",
    year: "1998",
    title: "T. S. Eliot: An Imperfect Life",
    publisher: "London: Vintage",
    note: "Biography; revises her Eliot's Early Years (1977) and Eliot's New Life (1988).",
  },
  {
    id: "ackroyd-1984",
    author: "Peter Ackroyd",
    year: "1984",
    title: "T. S. Eliot",
    publisher: "London: Hamish Hamilton",
  },
  {
    id: "crawford-2022",
    author: "Robert Crawford",
    year: "2022",
    title: "Eliot After The Waste Land",
    publisher: "London: Jonathan Cape",
    note: "Second volume of Crawford's biography; draws on the Emily Hale letters opened in 2020.",
  },
  {
    id: "southam-1994",
    author: "B. C. Southam",
    year: "1994",
    title: "A Student's Guide to the Selected Poems of T. S. Eliot (6th edn)",
    publisher: "London: Faber and Faber",
  },
  {
    id: "smith-1956",
    author: "Grover Smith",
    year: "1956",
    title: "T. S. Eliot's Poetry and Plays: A Study in Sources and Meaning",
    publisher: "Chicago: University of Chicago Press",
  },
  {
    id: "blamires-1969",
    author: "Harry Blamires",
    year: "1969",
    title: "Word Unheard: A Guide Through Eliot's Four Quartets",
    publisher: "London: Methuen",
  },
  {
    id: "kenner-1959",
    author: "Hugh Kenner",
    year: "1959",
    title: "The Invisible Poet: T. S. Eliot",
    publisher: "New York: McDowell, Obolensky",
  },
  {
    id: "donoghue-2000",
    author: "Denis Donoghue",
    year: "2000",
    title: "Words Alone: The Poet T. S. Eliot",
    publisher: "New Haven: Yale University Press",
  },
  {
    id: "moody-1994",
    author: "A. David Moody (ed.)",
    year: "1994",
    title: "The Cambridge Companion to T. S. Eliot",
    publisher: "Cambridge: Cambridge University Press",
  },
  {
    id: "eliot-music-of-poetry",
    author: "T. S. Eliot",
    year: "1942",
    title: "“The Music of Poetry” (W. P. Ker Memorial Lecture, Glasgow), reprinted in On Poetry and Poets (1957)",
    publisher: "London: Faber and Faber",
    note: "Eliot's own discussion of recurrent themes and musical analogy in verse.",
  },
  {
    id: "eliot-dante-1950",
    author: "T. S. Eliot",
    year: "1950",
    title: "“What Dante Means to Me”, reprinted in To Criticize the Critic (1965)",
    publisher: "London: Faber and Faber",
    note: "Includes Eliot's account of imitating Dante's terza rima in Little Gidding II.",
  },
  {
    id: "eliot-huck-1950",
    author: "T. S. Eliot",
    year: "1950",
    title: "Introduction to Mark Twain, Adventures of Huckleberry Finn",
    publisher: "London: Cresset Press",
    note: "Eliot writes about the Mississippi of his childhood as a presence in the book.",
  },
  {
    id: "paris-review-1959",
    author: "Donald Hall",
    year: "1959",
    title: "“T. S. Eliot, The Art of Poetry No. 1” (interview), The Paris Review 21",
  },
  {
    id: "eliot-letters",
    author: "Valerie Eliot, Hugh Haughton and John Haffenden (eds.)",
    year: "1988–",
    title: "The Letters of T. S. Eliot",
    publisher: "London: Faber and Faber",
  },
  {
    id: "hale-letters",
    author: "Princeton University Library",
    year: "2020",
    title: "Emily Hale Letters from T. S. Eliot (C1540), opened to readers January 2020",
  },
  {
    id: "diels-1903",
    author: "Hermann Diels",
    year: "1903",
    title: "Die Fragmente der Vorsokratiker",
    publisher: "Berlin: Weidmann",
    note: "The edition from which Burnt Norton's two Greek epigraphs are taken (Heraclitus, frr. 2 and 60).",
  },
];

export const BIB_BY_ID = Object.fromEntries(BIBLIOGRAPHY.map((b) => [b.id, b])) as Record<string, BibEntry>;
