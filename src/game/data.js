// Fuelup question data. The questions themselves live in the questions/ folder,
// one file per topic, so they are easy to read and edit without touching code:
//
//   questions/<topic>.json  one answer chart, with the questions that use it
//   questions/years.json    "Guess the year" questions
//   questions/gauges.json   "Closest number" charts
//
// To add a topic: copy an existing file, edit it, add an import line below and
// add it to CHART_FILES. Then run `node scripts/retier.mjs --write` and
// `node scripts/check.mjs`. See questions/README.md.
//
// Rarity levels, most common to rarest: sky, orbit, deepspace, nebula, galaxy.
// Galaxy is the top answer: exactly one per chart, its "gem" (very hard to find).

import elements from "../../questions/elements.json" with { type: "json" };
import europeCountries from "../../questions/europe-countries.json" with { type: "json" };
import africaCountries from "../../questions/africa-countries.json" with { type: "json" };
import usStates from "../../questions/us-states.json" with { type: "json" };
import dogBreeds from "../../questions/dog-breeds.json" with { type: "json" };
import instruments from "../../questions/instruments.json" with { type: "json" };
import cheeses from "../../questions/cheeses.json" with { type: "json" };
import shakespearePlays from "../../questions/shakespeare-plays.json" with { type: "json" };
import bones from "../../questions/bones.json" with { type: "json" };
import constellations from "../../questions/constellations.json" with { type: "json" };
import usPresidents from "../../questions/us-presidents.json" with { type: "json" };
import greekLetters from "../../questions/greek-letters.json" with { type: "json" };
import europeCapitals from "../../questions/europe-capitals.json" with { type: "json" };
import olympicHosts from "../../questions/olympic-hosts.json" with { type: "json" };
import franceNeighbours from "../../questions/france-neighbours.json" with { type: "json" };
import germanSpeakingCountries from "../../questions/german-speaking-countries.json" with { type: "json" };
import woodwindInstruments from "../../questions/woodwind-instruments.json" with { type: "json" };
import berries from "../../questions/berries.json" with { type: "json" };
import jupiterMoons from "../../questions/jupiter-moons.json" with { type: "json" };
import seas from "../../questions/seas.json" with { type: "json" };
import greekMinorGods from "../../questions/greek-minor-gods.json" with { type: "json" };
import indiaLanguages from "../../questions/india-languages.json" with { type: "json" };
import usNationalParks from "../../questions/us-national-parks.json" with { type: "json" };
import catBreeds from "../../questions/cat-breeds.json" with { type: "json" };
import shakespeareComedies from "../../questions/shakespeare-comedies.json" with { type: "json" };
import southAmericaRivers from "../../questions/south-america-rivers.json" with { type: "json" };
import islandCountries from "../../questions/island-countries.json" with { type: "json" };
import primes10To100 from "../../questions/primes-10-to-100.json" with { type: "json" };
import caspianCountries from "../../questions/caspian-countries.json" with { type: "json" };
import nuts from "../../questions/nuts.json" with { type: "json" };
import bonesBelowKnee from "../../questions/bones-below-knee.json" with { type: "json" };
import nobleGases from "../../questions/noble-gases.json" with { type: "json" };
import southAmericaCountries from "../../questions/south-america-countries.json" with { type: "json" };
import natoMembers from "../../questions/nato-members.json" with { type: "json" };
import asiaCountries from "../../questions/asia-countries.json" with { type: "json" };
import americasCountries from "../../questions/americas-countries.json" with { type: "json" };
import oceaniaCountries from "../../questions/oceania-countries.json" with { type: "json" };
import usStateCapitals from "../../questions/us-state-capitals.json" with { type: "json" };
import organs from "../../questions/organs.json" with { type: "json" };
import natoPhoneticAlphabet from "../../questions/nato-phonetic-alphabet.json" with { type: "json" };
import euMembers from "../../questions/eu-members.json" with { type: "json" };
import euLanguages from "../../questions/eu-languages.json" with { type: "json" };
import romanGods from "../../questions/roman-gods.json" with { type: "json" };
import norseGods from "../../questions/norse-gods.json" with { type: "json" };
import canadaProvinces from "../../questions/canada-provinces.json" with { type: "json" };
import eightThousanders from "../../questions/eight-thousanders.json" with { type: "json" };
import sevenWonders from "../../questions/seven-wonders.json" with { type: "json" };
import worldCupWinners from "../../questions/world-cup-winners.json" with { type: "json" };
import australiaStates from "../../questions/australia-states.json" with { type: "json" };
import dwarfPlanets from "../../questions/dwarf-planets.json" with { type: "json" };
import saturnMoons from "../../questions/saturn-moons.json" with { type: "json" };
import years from "../../questions/years.json" with { type: "json" };
import gauges from "../../questions/gauges.json" with { type: "json" };

/** Every answer chart, in a fixed order (the order affects the daily flight). */
export const CHART_FILES = [
  elements,
  europeCountries,
  africaCountries,
  usStates,
  dogBreeds,
  instruments,
  cheeses,
  shakespearePlays,
  bones,
  constellations,
  usPresidents,
  greekLetters,
  europeCapitals,
  olympicHosts,
  franceNeighbours,
  germanSpeakingCountries,
  woodwindInstruments,
  berries,
  jupiterMoons,
  seas,
  greekMinorGods,
  indiaLanguages,
  usNationalParks,
  catBreeds,
  shakespeareComedies,
  southAmericaRivers,
  islandCountries,
  primes10To100,
  caspianCountries,
  nuts,
  bonesBelowKnee,
  nobleGases,
  southAmericaCountries,
  natoMembers,
  asiaCountries,
  americasCountries,
  oceaniaCountries,
  usStateCapitals,
  organs,
  natoPhoneticAlphabet,
  euMembers,
  euLanguages,
  romanGods,
  norseGods,
  canadaProvinces,
  eightThousanders,
  sevenWonders,
  worldCupWinners,
  australiaStates,
  dwarfPlanets,
  saturnMoons
];

/** File answers { name, level, also } -> engine answers { name, tier, aliases }. */
function toAnswer(a) {
  return a.also ? { name: a.name, tier: a.level, aliases: a.also } : { name: a.name, tier: a.level };
}

/** Each chart with its answers converted once and shared by its rounds. */
export const CHARTS = CHART_FILES.map((file) => ({ ...file, answers: file.answers.map(toAnswer) }));

const roundsOf = (kind) =>
  CHARTS.flatMap((chart) =>
    chart.rounds
      .filter((r) => r.kind === kind)
      .map((r) => ({
        kind: r.kind,
        id: r.id,
        prompt: r.prompt,
        blurb: r.blurb,
        seconds: r.seconds,
        aside: r.fact,
        gem: chart.gem,
        answers: chart.answers,
      })),
  );

/** "Name as many as you can" rounds. */
export const LIST_ROUNDS = roundsOf("list");
/** "One answer" rounds. */
export const SINGLE_ROUNDS = roundsOf("rare");

const YEAR_BLURB = "Type the year. Exact is Galaxy, within 2 years is Nebula, and every year further off costs height.";

/** "Guess the year" rounds. Years before 1 AD are negative (-44 = 44 BC). */
export const YEAR_ROUNDS = years.map((y) => ({
  kind: "year",
  id: y.id,
  prompt: y.question,
  blurb: YEAR_BLURB,
  seconds: 22,
  year: y.year,
  aside: y.fact,
}));

/** "Closest number" charts. */
export const GAUGE_ROUNDS = gauges.map((g) => ({
  kind: "closest",
  id: g.id,
  noun: g.noun,
  blurb: g.blurb,
  aside: g.fact,
  seconds: g.seconds,
  unit: g.unit,
  targets: g.targets,
  items: g.items.map((it) => (it.also ? { name: it.name, value: it.value, aliases: it.also } : { name: it.name, value: it.value })),
}));
