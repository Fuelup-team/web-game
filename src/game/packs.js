// Theme packs: replayable runs on one subject, each with its own look and its
// own words for how well you did. The daily flight is the "space" theme.
//
// A pack's questions live in questions/<pack>/ (lists, one-answer charts,
// years.json and pictures.json). A pack can also borrow charts from the main
// game (olympic-hosts.json, for example). Pure data: no DOM here.
//
// To add a pack: make a questions/<pack>/ folder, import its files below, add
// an entry to PACKS and a theme to THEMES, then add its look to styles.css
// under [data-theme="<pack>"].

import { chartsFrom, roundsFrom, yearRoundsFrom, toAnswer } from "./data.js";

import nbaTeams from "../../questions/sports/nba-teams.json" with { type: "json" };
import nhlTeams from "../../questions/sports/nhl-teams.json" with { type: "json" };
import martialArts from "../../questions/sports/martial-arts.json" with { type: "json" };
import worldCupHosts from "../../questions/sports/world-cup-hosts.json" with { type: "json" };
import hockeyWorldChampions from "../../questions/sports/hockey-world-champions.json" with { type: "json" };
import ryderCupHosts from "../../questions/sports/ryder-cup-hosts.json" with { type: "json" };
import wimbledonChampions from "../../questions/sports/wimbledon-champions.json" with { type: "json" };
import sportsYears from "../../questions/sports/years.json" with { type: "json" };
import sportsPictures from "../../questions/sports/pictures.json" with { type: "json" };
import olympicHosts from "../../questions/olympic-hosts.json" with { type: "json" };
import worldCupWinners from "../../questions/world-cup-winners.json" with { type: "json" };

// ---------- Words for each theme ----------
//
// Same five levels and points everywhere (sky 10 … galaxy 100); each theme
// only renames them. Stages use the same points as the space climb
// (0, 1, 200, 400, 600, 800, 1000).

export const THEMES = {
  space: {
    id: "space",
    levels: { sky: "Sky", orbit: "Orbit", deepspace: "Deep Space", nebula: "Nebula", galaxy: "Galaxy", drift: "Off course" },
    run: "flight",
    Run: "Flight",
    round: "burn",
    Round: "Burn",
    meter: "Altitude",
    goal: "the Moon",
    topKicker: "Top answer",
    stages: { pad: "On the pad", liftoff: "Lift-off", clouds: "Above the clouds", halfway: "Halfway there", deep: "Leaving Earth behind", approach: "Moon approach", moon: "Moon landing" },
    ticks: { 0: "Pad", 1000: "Moon" },
    sparks: ["#ffc83d", "#fff4c2", "#eef0ff", "#c9a7ff", "#7fd4ff"],
  },
  sports: {
    id: "sports",
    levels: { sky: "Bench", orbit: "Starter", deepspace: "All-Star", nebula: "MVP", galaxy: "Hall of Fame", drift: "Wide" },
    run: "season",
    Run: "Season",
    round: "game",
    Round: "Game",
    meter: "Season",
    goal: "the title",
    topKicker: "Hall of Fame answer",
    stages: { pad: "Preseason", liftoff: "Kick-off", clouds: "Regular season", halfway: "Playoffs", deep: "Semifinal", approach: "The final", moon: "Champions" },
    ticks: { 0: "Pre", 200: "Reg", 400: "PO", 600: "Semi", 800: "Final", 1000: "Champ" },
    sparks: ["#ffd23d", "#ffffff", "#ff7a3d", "#7ee08a", "#5ab0ff"],
  },
};

// ---------- Packs ----------

/** Picture questions: who / where / when, each part scored on its own. */
function picturesFrom(list) {
  return list.map((p) => ({
    kind: "picture",
    id: p.id,
    prompt: p.prompt,
    blurb: "Each part gets one try. Close counts: a nearby year or the right city still scores.",
    seconds: 20 + p.parts.length * 12,
    image: p.image,
    credit: p.credit,
    aside: p.fact,
    parts: p.parts.map((part) => ({
      ask: part.ask,
      label: part.label,
      ...(part.ask === "when" ? { year: part.year } : { answers: part.answers.map(toAnswer) }),
    })),
  }));
}

function packRounds(files, years, pictures) {
  const charts = chartsFrom(files);
  return {
    lists: roundsFrom(charts, "list"),
    singles: roundsFrom(charts, "rare"),
    years: yearRoundsFrom(years),
    pictures: picturesFrom(pictures),
  };
}

export const PACKS = [
  {
    id: "sports",
    theme: "sports",
    name: "Sports",
    tagline: "Teams, legends and famous grounds.",
    about: "Football, hockey, basketball, tennis, golf, martial arts and the Olympics. Seven games a season, with picture rounds: name the player, the place or the year.",
    icon: "trophy",
    ...packRounds(
      [nbaTeams, nhlTeams, martialArts, worldCupHosts, olympicHosts, hockeyWorldChampions, ryderCupHosts, wimbledonChampions, worldCupWinners],
      sportsYears,
      sportsPictures,
    ),
  },
];

/** The pack with this id, or undefined. */
export function packById(id) {
  return PACKS.find((p) => p.id === id);
}

/** The words for a theme id (unknown ids get the space words). */
export function themeOf(id) {
  return THEMES[id] ?? THEMES.space;
}
