// Fuelup app: screens (start, burn, reveal, result, menu) and the flight flow.
import { h, mount, icon, asset } from "./dom.js";
import { createStage } from "./stage.js";
import {
  todayUtc, flightNumber, formatDay, formatDelta, formatYearsOff,
  buildFlight, tryAnswer, scoreRound, finishFlight, shareText, suggest,
  splitEntries, TIER_RANK, LIST_CAP, PERFECT_SCORE, TOP_LEVEL,
  LEVELS, OFF_COURSE, GAUGE_BANDS, YEAR_BANDS, levelOf, stageFor, toTheMoon,
  buildPackFlight, scorePicturePart, PART_CREDIT, STAGES,
} from "../game/engine.js";
import { PACKS, packById, themeOf } from "../game/packs.js";
import { loadProfile, saveProfile, logFlight, logPackRun } from "../game/storage.js";
import { audio, playHit, playMiss } from "../game/sound.js";
import { fetchFleet, submitFlight, fleetEnabled } from "../game/fleet.js";

// ---------- Burn types, in plain words ----------

const KINDS = {
  list: {
    label: "Name as many as you can",
    short: "Name many",
    icon: "list",
    how: `Type answers one at a time and press Enter after each. Every answer adds its points, up to ${LIST_CAP}.`,
    placeholder: "Type an answer, press Enter",
    submit: "Add",
  },
  rare: {
    label: "One answer",
    short: "One answer",
    icon: "check",
    how: "Type one answer. If it isn't on the chart, try again until one locks in. Up to 100 points.",
    placeholder: "Type one answer",
    submit: "Lock in",
  },
  closest: {
    label: "Closest number",
    short: "Closest",
    icon: "scale",
    how: "Name the thing whose number is closest to the target. Only the single closest answer reaches Galaxy.",
    placeholder: "Start typing a name",
    submit: "Lock in",
  },
  year: {
    label: "Guess the year",
    short: "Year",
    icon: "calendar",
    how: "Type the year it happened. The exact year is Galaxy, and every year off costs points.",
    placeholder: "Type a year, like 1969",
    submit: "Lock in",
  },
  picture: {
    label: "Picture",
    short: "Picture",
    icon: "image",
    how: "Look at the photo and answer what it asks: who, where or when. Each part gets one try, and close answers still score.",
    placeholder: "Type your answer",
    submit: "Lock in",
  },
};

// ---------- Theme words ----------
//
// The daily flight speaks space (Sky … Galaxy, the Moon). A theme pack has
// its own words for the same levels and stages (Bench … Hall of Fame, Champions).

let words = themeOf("space");

/** Switch the look and the words: sets data-theme on <html> for styles.css. */
function applyTheme(id) {
  words = themeOf(id);
  document.documentElement.dataset.theme = words.id;
}

/** This theme's name for a level: "Galaxy" or "Hall of Fame". */
const lvName = (tier) => words.levels[tier] ?? levelOf(tier).name;
/** This theme's name for the stage a score reaches. */
const stageName = (score) => words.stages[stageFor(score).id];
/** "580 points to the Moon" / "580 points to the title" */
function toTheGoal(score) {
  if (words.id === "space") return toTheMoon(score);
  const left = PERFECT_SCORE - score;
  return left > 0 ? `${fmt(left)} points to ${words.goal}` : `You won ${words.goal}`;
}
const kindOf = (round) => KINDS[round.kind] ?? KINDS.rare;

// ---------- Rarity lamp (six pixels, Off course to Galaxy) ----------

const LAMP_ORDER = ["drift", "sky", "orbit", "deepspace", "nebula", "galaxy"];

function rarityLamps(tier) {
  const rank = LAMP_ORDER.indexOf(tier);
  return h("div", {
    className: "lamps",
    attrs: { role: "img", "aria-label": tier ? `Rarity: ${lvName(tier)}` : "Rarity lamp" },
  }, LAMP_ORDER.map((id, i) =>
    h("span", {
      className: ["lamp", `tier-${id}`, i <= rank ? "is-lit" : "", i === rank ? "is-here" : ""].filter(Boolean).join(" "),
      attrs: { title: lvName(id) },
    }),
  ));
}

function paintLamps(lamps, tier) {
  const rank = LAMP_ORDER.indexOf(tier);
  [...lamps.children].forEach((dot, i) => {
    dot.classList.remove("is-lit", "is-here");
    if (i <= rank) {
      void dot.offsetWidth; // restart the pop animation
      dot.classList.add("is-lit");
      if (i === rank) dot.classList.add("is-here");
    }
  });
  lamps.setAttribute("aria-label", tier ? `Rarity: ${lvName(tier)}` : "Rarity lamp");
}

/** "Galaxy, Ultra rare, +100" */
function levelLine(tier, points = levelOf(tier).points) {
  return `${lvName(tier)}, ${levelOf(tier).rarity}, +${points}`;
}

/** A small filled tag in a level's color. */
function levelTag(tier, text = lvName(tier)) {
  return h("span", { className: `level-tag tier-${tier}` }, text);
}

// ---------- State ----------

let root = document.getElementById("app");
const day = todayUtc();

const state = {
  profile: loadProfile(),
  fleet: null,
  fleetStatus: fleetEnabled ? "loading" : "off", // loading | ready | error | off
  callsign: "",
  menu: null, // null | "root" | "leave" | "how" | "terms" | "privacy"
  screen: { name: "pad" }, // pad | pack | play | between | report
};
state.callsign = state.profile.callsign;

/** Live data for the burn in progress. */
let burn = null;
let stage = null;

function setProfile(next) {
  state.profile = next;
  saveProfile(next);
}

const muted = () => state.profile.muted;
/** Name of the pack on screen ("Sports"), or "" for the daily flight. */
const packName = () => {
  const s = state.screen;
  return packById(s.pack ?? s.mission?.pack ?? s.flight?.pack)?.name ?? "";
};
const callsignLabel = () => (state.callsign.trim() || "Pilot").slice(0, 18);
const todaysFlight = () => state.profile.flights[day];
const sum = (items) => items.reduce((total, x) => total + x.points, 0);
const fmt = (n) => n.toLocaleString("en-US");

if (fleetEnabled) {
  fetchFleet(day, state.profile.pilotKey)
    .then((fleet) => {
      state.fleet = fleet;
      state.fleetStatus = "ready";
    })
    .catch(() => {
      state.fleetStatus = "error";
    })
    .finally(() => {
      if (state.screen.name === "pad") render();
    });
}

// ---------- Mobile keyboard handling ----------

function watchViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => {
    const keyboard = window.innerHeight - vv.height > 80;
    document.documentElement.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
    root.classList.toggle("is-keyboard", keyboard);
  };
  update();
  vv.addEventListener("resize", update);
}

// ---------- Flow ----------

function go(screen) {
  stopBurn();
  state.screen = screen;
  render();
  window.scrollTo(0, 0);
}

function startFlight(practice) {
  const callsign = state.callsign.trim().slice(0, 18);
  if (callsign !== state.profile.callsign) setProfile({ ...state.profile, callsign });
  audio(); // unlock sound on this click
  const mission = practice ? buildFlight(`practice:${crypto.randomUUID()}`, true) : buildFlight(day, false);
  go({ name: "play", mission, index: 0, results: [] });
}

/** Start a new run of a theme pack (a new mix every time, never on the board). */
function startPack(packId) {
  audio();
  go({ name: "play", mission: buildPackFlight(packId, crypto.randomUUID()), index: 0, results: [] });
}

function stopBurn() {
  if (!burn) return;
  cancelAnimationFrame(burn.frame);
  clearTimeout(burn.fallback);
  burn = null;
}

/** End the current burn (finished by the player, or out of time). */
function finishBurn(reason) {
  const screen = state.screen;
  if (!burn || burn.done || screen.name !== "play") return;
  burn.done = true;
  const round = screen.mission.rounds[screen.index];
  let scored;
  if (round.kind === "picture") {
    // Locked parts keep their answer; when time runs out, what's typed is locked too.
    const inputs = round.parts.map((_, i) => burn.parts[i]?.input ?? (reason === "time" ? burn.partDrafts[i] ?? "" : ""));
    scored = { ...scoreRound(round, inputs), timedOut: reason === "time" };
  } else {
    let hits = burn.hits;
    if (reason === "time" && burn.draft.trim()) {
      const result = checkEntries(round, burn.draft, hits);
      if (!result.bad) hits = result.hits;
    }
    scored = { ...scoreRound(round, hits.map((x) => x.canonical)), timedOut: reason === "time" };
  }
  const results = [...screen.results, scored];
  stage?.boost();

  if (screen.index >= screen.mission.rounds.length - 1) {
    const flight = finishFlight(screen.mission.day, screen.mission.number, results, screen.mission.pack ?? null);
    if (flight.pack) setProfile(logPackRun(state.profile, flight.pack, flight.score));
    go({ name: "report", flight, practice: screen.mission.practice });
    if (!screen.mission.practice) recordFlight(flight);
  } else {
    go({ name: "between", mission: screen.mission, index: screen.index, results, just: scored });
  }
}

async function recordFlight(flight) {
  const next = logFlight(state.profile, flight);
  setProfile(next);
  if (!fleetEnabled) return;
  try {
    state.fleet = await submitFlight(
      flight.day,
      next.pilotKey,
      flight.rounds.map((r) => ({ id: r.id, inputs: r.hits.map((x) => x.canonical) })),
    );
    state.fleetStatus = "ready";
  } catch {
    state.fleetStatus = "error";
  }
  if (state.screen.name === "report") render();
}

function nextBurn(between) {
  go({ name: "play", mission: between.mission, index: between.index + 1, results: between.results });
}

/** Check typed text against the round. "Name many" burns accept several, comma-separated. */
function checkEntries(round, text, current) {
  const entries = round.kind === "list" ? splitEntries(text) : [text.trim()].filter(Boolean);
  if (!entries.length) return { hits: current, note: "Type an answer first.", bad: true };
  const hits = [...current];
  let added = 0;
  let reason = "";
  let best;
  for (const entry of entries) {
    if (round.kind !== "list" && hits.length) break;
    const r = tryAnswer(round, entry, hits.map((x) => x.canonical));
    if (r.ok) {
      hits.push(r.hit);
      added += 1;
      if (!best || TIER_RANK[r.hit.tier] > TIER_RANK[best]) best = r.hit.tier;
    } else {
      reason = r.reason;
    }
  }
  if (!added) return { hits: current, note: reason || "Not on the chart.", bad: true };
  const last = hits[hits.length - 1];
  const fixed = last.via === "fuzzy" ? `Read as ${last.canonical}. ` : "";
  const note =
    round.kind === "list"
      ? added === 1
        ? `${fixed}${last.canonical}: ${levelLine(last.tier)}`
        : `${added} added. ${fmt(Math.min(LIST_CAP, sum(hits)))} of ${LIST_CAP} points.`
      : `${fixed}${last.canonical}: ${levelLine(last.tier, last.points)}`;
  return { hits, note, bad: false, best };
}

/** The rarest level among some hits, or null. */
function bestTier(hits) {
  return hits.reduce((best, x) => (!best || TIER_RANK[x.tier] > TIER_RANK[best] ? x.tier : best), null);
}

// ---------- Rendering ----------

function render() {
  const s = state.screen;
  root.className = ["fuel-app", `on-${s.name}`, root.classList.contains("is-keyboard") ? "is-keyboard" : ""].filter(Boolean).join(" ");

  const pack = s.name === "pack" ? packById(s.pack) : packById(s.mission?.pack ?? s.flight?.pack);
  const themeId = pack?.theme ?? "space";
  if (words.id !== themeId) stage = null;
  applyTheme(themeId);

  const children = [];
  if (s.name === "pad" || s.name === "pack") {
    stage = null;
    children.push(renderTopBar(), s.name === "pad" ? renderPad() : renderPackLobby(pack));
  } else {
    if (!stage) stage = createStage(themeId);
    stage.setScore(stageScore());
    const panel = s.name === "play" ? renderBurn() : s.name === "between" ? renderBetween() : renderReport();
    children.push(renderTopBar(), h("main", { className: "flight-grid", id: "main" }, stage.el, panel));
  }
  if (state.menu) children.push(renderMenu());
  mount(root, children);
  if (s.name === "play") startBurnClock();
  if (s.name === "between" && !state.menu) root.querySelector(".reveal [data-autofocus]")?.focus({ preventScroll: true });
}

function stageScore() {
  const s = state.screen;
  if (s.name === "report") return s.flight.score;
  const done = sum(s.results);
  if (s.name !== "play" || !burn) return done;
  const live = s.mission.rounds[s.index]?.kind === "picture" ? sum(burn.parts.filter(Boolean)) : sum(burn.hits);
  return done + (s.mission.rounds[s.index]?.kind === "list" ? Math.min(LIST_CAP, live) : live);
}

// ----- Top bar (every screen) -----

function renderTopBar() {
  const s = state.screen;
  const inFlight = s.name === "play" || s.name === "between";
  return h("header", { className: "topbar" },
    h("div", { className: "topbar-left" },
      s.name === "pad"
        ? h("p", { className: "logo" }, "Fuelup")
        : s.name === "pack"
          ? h("button", {
            className: "btn-icon",
            attrs: { type: "button", "aria-label": "Back to start" },
            onClick: () => go({ name: "pad" }),
          }, icon("arrow-left"))
        : h("button", {
          className: "btn-icon",
          attrs: { type: "button", "aria-label": inFlight ? `Leave this ${words.run}` : "Back to start" },
          onClick: () => (inFlight ? openMenu("leave") : go({ name: "pad" })),
        }, icon("arrow-left")),
      s.name !== "pad" && h("p", { className: "logo logo-small" }, "Fuelup",
        words.id !== "space" && h("span", { className: "logo-pack" }, packName())),
    ),
    inFlight && renderPips(),
    h("div", { className: "topbar-right" },
      h("button", {
        className: "btn-icon",
        attrs: { type: "button", "aria-label": muted() ? "Turn sound on" : "Turn sound off", "aria-pressed": String(!muted()) },
        onClick: toggleMute,
      }, icon(muted() ? "volume-x" : "volume-2")),
      h("button", {
        className: "btn-menu",
        attrs: { type: "button", "aria-haspopup": "dialog" },
        onClick: () => openMenu("root"),
      }, icon("menu"), h("span", {}, "Menu")),
    ),
  );
}

/** Seven squares: finished burns in their level color, the current one blinking. */
function renderPips() {
  const s = state.screen;
  const current = s.name === "play" ? s.index : s.index + 1;
  return h("div", { className: "pips", attrs: { "aria-label": `${words.Round} ${Math.min(current + 1, 7)} of 7` } },
    h("span", { className: "pips-label" }, `${words.Round} ${Math.min(current + 1, 7)} of 7`),
    h("ol", {}, s.mission.rounds.map((round, i) => {
      const done = s.results[i];
      const tier = done ? (done.hits.length ? bestTier(done.hits) : "drift") : null;
      return h("li", {
        className: ["pip", done ? `is-done tier-${tier}` : "", i === current ? "is-now" : ""].filter(Boolean).join(" "),
        attrs: { title: `${i + 1}. ${kindOf(round).label}` },
      });
    })),
  );
}

function toggleMute() {
  setProfile({ ...state.profile, muted: !state.profile.muted });
  rerenderChrome();
}

function openMenu(page) {
  state.menu = page;
  rerenderChrome();
  if (page) requestAnimationFrame(() => root.querySelector(".menu-sheet [data-autofocus]")?.focus());
}

/** Re-render the top bar and menu without restarting a burn in progress. */
function rerenderChrome() {
  if (state.screen.name !== "play" || !burn) {
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
    return;
  }
  root.querySelector(".topbar").replaceWith(renderTopBar());
  root.querySelector(".menu-layer")?.remove();
  if (state.menu) root.append(renderMenu());
  else burn.input?.focus();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.menu) openMenu(null);
});

function stat(label, value, detail) {
  return h("div", { className: "stat" },
    h("p", { className: "stat-label" }, label),
    h("p", { className: "stat-value" }, value),
    detail && h("p", { className: "stat-detail" }, detail),
  );
}

// ----- Start screen -----

function renderPad() {
  const flight = todaysFlight();
  const streak = state.profile.streak;
  const lineup = buildFlight(day).rounds;

  const fleetStat = (() => {
    const f = state.fleet;
    if (state.fleetStatus === "loading") return stat("Today's average", "...", "Checking the fleet");
    if (state.fleetStatus === "off") return stat("Today's average", "-", "Live on the real site");
    if (state.fleetStatus === "error") return stat("Today's average", "-", "Couldn't reach the fleet");
    if (!f || f.pilots === 0) return stat("Today's average", "-", "Be the first today");
    return stat("Today's average", fmt(f.averageScore), `${f.pilots} pilot${f.pilots === 1 ? "" : "s"} today`);
  })();

  return h("main", { className: "pad-grid", id: "main" },
    h("section", { className: "panel pad-panel" },
      h("p", { className: "flight-tag" }, `Flight ${flightNumber(day)}, ${formatDay(day)}`),
      h("h1", {}, "Fly to the Moon on what you know."),
      h("p", { className: "lead" }, "Seven quick questions a day, the same for everyone. Rare answers fly highest."),
      h("div", { className: "cta-row" },
        flight
          ? h("button", { className: "btn btn-gold", attrs: { type: "button" }, onClick: () => go({ name: "report", flight, practice: false }) },
            icon("trophy"), "See today's result")
          : h("button", { className: "btn btn-gold", attrs: { type: "button" }, onClick: () => startFlight(false) },
            icon("play"), "Start today's flight"),
        h("button", { className: "btn btn-line", attrs: { type: "button" }, onClick: () => startFlight(true) },
          icon("reload"), "Practice"),
      ),
      h("div", { className: "stats" },
        stat("Your flight", flight ? fmt(flight.score) : "-", flight ? stageName(flight.score) : "Not flown yet"),
        fleetStat,
        stat("Streak", streak > 0 ? `${streak}` : "-", streak === 1 ? "day" : streak > 1 ? "days in a row" : "Fly today to start"),
      ),
      renderPackShelf(),
      h("label", { className: "field" },
        h("span", { className: "field-label" }, "Pilot name (optional)"),
        h("input", {
          value: state.callsign,
          maxLength: 18,
          placeholder: "Pilot",
          attrs: { autocomplete: "off", "aria-describedby": "callsign-help" },
          onInput: (e) => (state.callsign = e.target.value),
        }),
        h("small", { id: "callsign-help" }, "Shown only on this device. Scores on the board are anonymous."),
      ),
      h("section", { className: "lineup", attrs: { "aria-label": "Today's seven burns" } },
        h("h2", {}, "Today's 7 burns"),
        h("ol", {}, lineup.map((round, i) =>
          h("li", {}, h("span", { className: "lineup-num" }, i + 1), icon(kindOf(round).icon), h("span", {}, kindOf(round).short)),
        )),
      ),
      h("section", { className: "levels", attrs: { "aria-label": "Rarity levels" } },
        h("h2", {}, "Rarer answers score more"),
        h("ul", {}, LEVELS.map((l) =>
          h("li", { className: `tier-${l.id}` }, h("span", { className: "level-swatch" }), h("b", {}, l.name), h("span", {}, l.rarity), h("em", {}, `${l.points}`)),
        )),
      ),
      h("button", { className: "btn-text", attrs: { type: "button" }, onClick: () => openMenu("how") },
        icon("info-box"), "How to play"),
    ),
    h("div", { className: "pad-art", attrs: { "aria-hidden": "true" } },
      h("img", { className: "pad-rocket", src: asset("art/rocket-pixel.png"), alt: "" }),
    ),
  );
}

// ----- Theme packs -----

/** Cards on the start screen, one per pack. */
function renderPackShelf() {
  return h("section", { className: "packs", attrs: { "aria-label": "Theme packs" } },
    h("h2", {}, "Theme packs"),
    h("p", { className: "section-hint" }, "Play one subject as often as you like, each with its own look."),
    h("ul", {}, PACKS.map((pack) => {
      const mine = state.profile.packs?.[pack.id];
      return h("li", {},
        h("button", {
          className: `pack-card pack-${pack.id}`,
          attrs: { type: "button" },
          onClick: () => go({ name: "pack", pack: pack.id }),
        },
          h("span", { className: "pack-card-art", attrs: { "aria-hidden": "true" } }, icon(pack.icon)),
          h("span", { className: "pack-card-text" },
            h("b", {}, pack.name),
            h("span", {}, pack.tagline),
            mine && h("small", {}, `Best ${fmt(mine.best)} · ${mine.played} played`),
          ),
          icon("chevron-right"),
        ),
      );
    })),
  );
}

/** A pack's own start screen, in its own look. */
function renderPackLobby(pack) {
  if (!pack) return renderPad();
  const mine = state.profile.packs?.[pack.id];
  const topics = [...new Set([...pack.lists, ...pack.singles].map((r) => r.prompt.replace(/^Name (as many |a |an |one of )?/, "").replace(/ as you can\.$|\.$/, "")))];
  return h("main", { className: "pad-grid pack-lobby", id: "main" },
    h("section", { className: "panel pad-panel" },
      h("p", { className: "flight-tag" }, `Theme pack · ${words.Run} of 7 ${words.round}s`),
      h("h1", {}, pack.name),
      h("p", { className: "lead" }, pack.about),
      h("div", { className: "cta-row" },
        h("button", { className: "btn btn-gold", attrs: { type: "button" }, onClick: () => startPack(pack.id) },
          icon("play"), mine ? `Play another ${words.run}` : `Start a ${words.run}`),
        h("button", { className: "btn-text", attrs: { type: "button" }, onClick: () => go({ name: "pad" }) },
          icon("home"), "Back to the daily flight"),
      ),
      h("div", { className: "stats" },
        stat(`Best ${words.run}`, mine ? fmt(mine.best) : "-", mine ? stageName(mine.best) : `No ${words.run}s yet`),
        stat("Last", mine?.last != null ? fmt(mine.last) : "-", mine ? stageName(mine.last) : "Play to start"),
        stat("Played", mine ? `${mine.played}` : "-", "Not on the daily board"),
      ),
      h("section", { className: "lineup", attrs: { "aria-label": `A ${words.run}` } },
        h("h2", {}, `Every ${words.run}: 7 ${words.round}s`),
        h("ol", {}, ["list", "rare", "picture", "year", "list", "picture", "rare"].map((kind, i) =>
          h("li", {}, h("span", { className: "lineup-num" }, i + 1), icon(KINDS[kind].icon), h("span", {}, KINDS[kind].short)),
        )),
      ),
      h("section", { className: "levels", attrs: { "aria-label": "Levels" } },
        h("h2", {}, "Rarer answers score more"),
        h("ul", {}, LEVELS.map((l) =>
          h("li", { className: `tier-${l.id}` }, h("span", { className: "level-swatch" }), h("b", {}, lvName(l.id)), h("span", {}, l.rarity), h("em", {}, `${l.points}`)),
        )),
      ),
      h("section", { className: "levels season-path", attrs: { "aria-label": `How a ${words.run} goes` } },
        h("h2", {}, `Your points are your ${words.meter.toLowerCase()}`),
        h("ol", {}, STAGES.map((st) =>
          h("li", {}, h("b", {}, words.stages[st.id]), h("em", {}, st.from === 1 ? "1+" : fmt(st.from))),
        )),
      ),
      h("details", { className: "pack-topics" },
        h("summary", {}, `What's in ${pack.name}`),
        h("ul", {}, topics.map((t) => h("li", {}, t))),
        h("p", { className: "section-hint" }, `Plus ${pack.pictures.length} picture questions and ${pack.years.length} "Guess the year" questions.`),
      ),
    ),
    h("div", { className: "pad-art", attrs: { "aria-hidden": "true" } },
      h("img", { className: "pad-rocket pad-ball", src: asset("art/ball-pixel.svg"), alt: "" }),
    ),
  );
}

// ----- Burn (one timed question) -----

function renderBurn() {
  const s = state.screen;
  const round = s.mission.rounds[s.index];
  if (round.kind === "picture") return renderPictureBurn(s, round);
  const kind = kindOf(round);
  const seconds = round.seconds * 1000;
  burn = {
    round,
    hits: [],
    draft: "",
    options: [],
    hi: 0,
    done: false,
    total: seconds,
    deadline: Date.now() + seconds,
    frame: 0,
    fallback: 0,
    lastTick: -1,
  };

  const timer = h("p", { className: "timer", attrs: { role: "timer" } });
  const timeFill = h("span", { className: "timebar-fill" });
  const chips = h("ul", { className: "chips", attrs: { "aria-label": "Your answers" } });
  const suggestList = h("ul", { className: "suggest", attrs: { role: "listbox", "aria-label": "Suggestions" } });
  const note = h("p", { className: "note", attrs: { "aria-live": "polite" } });
  const lamps = rarityLamps(null);

  const input = h("input", {
    id: "burn-answer",
    attrs: {
      autocapitalize: "off",
      autocorrect: "off",
      spellcheck: "false",
      autocomplete: "off",
      enterkeyhint: round.kind === "list" ? "next" : "done",
      placeholder: kind.placeholder,
      "aria-describedby": "burn-hint",
    },
    onInput: (e) => {
      burn.draft = e.target.value;
      if (round.kind === "closest") {
        burn.options = suggest(round.items, burn.draft);
        burn.hi = 0;
        drawSuggestions();
      }
    },
    onKeydown: (e) => {
      if (round.kind !== "closest" || !burn.options.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        burn.hi = Math.min(burn.options.length - 1, burn.hi + 1);
        drawSuggestions();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        burn.hi = Math.max(0, burn.hi - 1);
        drawSuggestions();
      }
    },
    onFocus: () => root.classList.add("is-typing"),
    onBlur: () => setTimeout(() => document.activeElement !== input && root.classList.remove("is-typing"), 180),
  });

  function setNote(text, bad, tier) {
    note.textContent = text;
    note.className = bad ? "note is-bad" : tier ? `note tier-${tier}` : "note";
    if (tier !== undefined) paintLamps(lamps, tier);
    if (bad) {
      void note.offsetWidth; // restart the shake animation
      note.classList.add("shake");
    }
  }

  function defaultNote() {
    return round.kind === "list"
      ? `${fmt(Math.min(LIST_CAP, sum(burn.hits)))} of ${LIST_CAP} points so far.`
      : `A wrong try doesn't end the ${words.round}. Keep going.`;
  }

  function drawChips() {
    if (round.kind !== "list") return;
    chips.hidden = burn.hits.length === 0;
    mount(chips, burn.hits.map((hit) =>
      h("li", { className: `chip tier-${hit.tier}` },
        h("span", { className: "chip-name" }, hit.canonical),
        levelTag(hit.tier, `${lvName(hit.tier)} +${hit.points}`),
        h("button", {
          className: "chip-remove",
          attrs: { type: "button", "aria-label": `Remove ${hit.canonical}` },
          onClick: () => {
            burn.hits = burn.hits.filter((x) => x.canonical !== hit.canonical);
            drawChips();
            stage.setScore(stageScore());
            setNote(defaultNote(), false, bestTier(burn.hits) ?? "");
            input.focus();
          },
        }, icon("close")),
      ),
    ));
  }

  function drawSuggestions() {
    suggestList.hidden = !(round.kind === "closest" && burn.options.length);
    mount(suggestList, burn.options.map((name, i) =>
      h("li", {},
        h("button", {
          className: i === burn.hi ? "is-hi" : "",
          attrs: { type: "button", role: "option", "aria-selected": String(i === burn.hi) },
          onMouseenter: () => {
            burn.hi = i;
            drawSuggestions();
          },
          onClick: () => commit(name),
        }, name),
      ),
    ));
  }

  function commit(override) {
    if (!burn || burn.done) return;
    const text = override ?? (round.kind === "closest" && burn.options.length ? burn.options[burn.hi] ?? burn.draft : burn.draft);
    const result = checkEntries(round, text, burn.hits);
    if (result.bad) {
      setNote(result.note, true);
      playMiss(muted());
      return;
    }
    burn.hits = result.hits;
    burn.draft = "";
    burn.options = [];
    input.value = "";
    drawChips();
    drawSuggestions();
    setNote(result.note, false, result.best);
    if (result.best) playHit(result.best, muted());
    stage.setScore(stageScore());
    const top = result.best === TOP_LEVEL ? result.hits.findLast((x) => x.tier === TOP_LEVEL) : null;
    stage.boost(result.best || "sky");
    if (top) celebrateTop(top.canonical, top.points);
    if (round.kind === "list") input.focus();
    else finishBurn("seal");
  }

  burn.updateClock = () => {
    const left = Math.max(0, burn.deadline - Date.now());
    const secs = left / 1000;
    timer.textContent = `${Math.ceil(secs)}`;
    timer.className = left < 5000 ? "timer is-low" : "timer";
    timer.setAttribute("aria-label", `${Math.ceil(secs)} seconds left`);
    timeFill.style.transform = `scaleX(${Math.max(0, Math.min(1, left / burn.total))})`;
  };

  drawChips();
  drawSuggestions();
  setNote(defaultNote(), false);
  burn.updateClock();
  burn.input = input;

  return h("form", {
    className: `panel burn kind-${round.kind}`,
    attrs: { "aria-label": `${words.Round} ${s.index + 1} of 7` },
    onSubmit: (e) => {
      e.preventDefault();
      commit();
    },
  },
    h("div", { className: "burn-head" },
      h("p", { className: "kind-badge" }, icon(kind.icon), kind.label),
      h("div", { className: "timer-box" }, icon("clock"), timer),
    ),
    h("div", { className: "timebar", attrs: { "aria-hidden": "true" } }, timeFill),
    h("h2", { className: "prompt" }, round.prompt),
    h("p", { className: "hint", id: "burn-hint" }, round.blurb || kind.how),
    round.kind === "list" && chips,
    h("div", { className: "answer-row" },
      h("label", { className: "sr-only", attrs: { for: "burn-answer" } }, "Your answer"),
      input,
      h("button", { className: "btn btn-gold", attrs: { type: "submit" } }, kind.submit),
    ),
    round.kind === "closest" && suggestList,
    h("div", { className: "feedback" }, lamps, note),
    round.kind === "list" &&
      h("button", { className: "btn btn-line btn-done", attrs: { type: "button" }, onClick: () => finishBurn("seal") },
        icon("check"), `I'm done, next ${words.round}`),
  );
}

/** Shared timer pieces for a burn. */
function burnClock() {
  const timer = h("p", { className: "timer", attrs: { role: "timer" } });
  const timeFill = h("span", { className: "timebar-fill" });
  const update = () => {
    const left = Math.max(0, burn.deadline - Date.now());
    const secs = left / 1000;
    timer.textContent = `${Math.ceil(secs)}`;
    timer.className = left < 5000 ? "timer is-low" : "timer";
    timer.setAttribute("aria-label", `${Math.ceil(secs)} seconds left`);
    timeFill.style.transform = `scaleX(${Math.max(0, Math.min(1, left / burn.total))})`;
  };
  return { timer, timeFill, update };
}

/** "Credit: Ira Rosenberg · Public domain · Source" under a picture. */
function pictureCredit(round) {
  const c = round.credit;
  return h("figcaption", { className: "picture-credit" },
    "Photo: ", c.author, " · ", c.license, " · ",
    h("a", { href: c.source, attrs: { target: "_blank", rel: "noopener noreferrer" } }, "Source"),
  );
}

/**
 * Picture burn: a photo and one to three parts (who, where, when). Each part
 * locks after one try and shows its points; the burn ends when every part
 * is locked, or when time runs out.
 */
function renderPictureBurn(s, round) {
  const kind = KINDS.picture;
  const seconds = round.seconds * 1000;
  burn = {
    round,
    hits: [],
    parts: round.parts.map(() => null),
    partDrafts: round.parts.map(() => ""),
    done: false,
    total: seconds,
    deadline: Date.now() + seconds,
    frame: 0,
    fallback: 0,
    lastTick: -1,
  };
  const clock = burnClock();
  burn.updateClock = clock.update;
  const lamps = rarityLamps(null);
  const note = h("p", { className: "note", attrs: { "aria-live": "polite" } }, "Answer each part. You get one try per part.");
  const partTotal = () => sum(burn.parts.filter(Boolean));

  const rows = round.parts.map((part, i) => {
    const id = `part-${i}`;
    const result = h("p", { className: "part-result", attrs: { "aria-live": "polite" } });
    const input = h("input", {
      id,
      attrs: {
        autocapitalize: "off",
        autocorrect: "off",
        spellcheck: "false",
        autocomplete: "off",
        inputmode: part.ask === "when" ? "numeric" : "text",
        enterkeyhint: i < round.parts.length - 1 ? "next" : "done",
        placeholder: part.ask === "when" ? "Year, like 1969" : part.ask === "who" ? "Name" : "Place",
      },
      onInput: (e) => (burn.partDrafts[i] = e.target.value),
      onFocus: () => {
        burn.focus = i;
        root.classList.add("is-typing");
      },
      onBlur: () => setTimeout(() => !root.querySelector(".part-row input:focus") && root.classList.remove("is-typing"), 180),
    });
    const lockBtn = h("button", {
      className: "btn btn-line btn-lock",
      attrs: { type: "button", "aria-label": `Lock in ${part.label}` },
      onClick: () => lock(i),
    }, icon("lock"));
    const row = h("div", { className: `part-row ask-${part.ask}` },
      h("label", { className: "part-label", attrs: { for: id } }, icon(part.ask === "when" ? "calendar" : part.ask === "who" ? "user" : "flag"), part.label),
      h("div", { className: "part-input" }, input, lockBtn),
      result,
    );
    return { row, input, lockBtn, result };
  });

  function lock(i) {
    if (!burn || burn.done || burn.parts[i]) return;
    const text = rows[i].input.value.trim();
    if (!text) {
      note.textContent = `Type an answer for "${round.parts[i].label}" first.`;
      note.className = "note is-bad shake";
      return;
    }
    if (round.parts[i].ask === "when" && !/\d/.test(text)) {
      note.textContent = "Type a year, like 1969.";
      note.className = "note is-bad shake";
      return;
    }
    const r = scorePicturePart(round, i, text);
    burn.parts[i] = r;
    const { row, input, lockBtn, result } = rows[i];
    input.readOnly = true;
    lockBtn.disabled = true;
    row.classList.add("is-locked", `tier-${r.tier}`);
    result.replaceChildren(
      r.points > 0
        ? levelTag(r.tier, `${lvName(r.tier)} +${r.points}`)
        : levelTag("drift", "No points"),
      r.points > 0 && r.via === "fuzzy" ? h("span", {}, ` Read as ${r.canonical}.`) : "",
      r.yearsOff ? h("span", {}, ` ${formatYearsOff(r.yearsOff, r.direction)}.`) : "",
    );
    paintLamps(lamps, r.tier);
    if (r.points > 0) playHit(r.tier, muted());
    else playMiss(muted());
    stage.setScore(stageScore());
    stage.boost(r.points > 0 ? r.tier : "sky");
    note.textContent = `${fmt(partTotal())} of 100 points so far.`;
    note.className = "note";
    const next = burn.parts.findIndex((p) => !p);
    if (next === -1) {
      if (partTotal() >= 100) celebrateTop(round.parts.map((p, k) => burn.parts[k].canonical).join(" · "), 100);
      setTimeout(() => finishBurn("seal"), 650);
    } else {
      rows[next].input.focus();
    }
  }

  burn.input = rows[0].input;
  clock.update();

  return h("form", {
    className: "panel burn kind-picture",
    attrs: { "aria-label": `${words.Round} ${s.index + 1} of 7` },
    onSubmit: (e) => {
      e.preventDefault();
      const focused = rows.findIndex((r) => r.input === document.activeElement);
      lock(focused >= 0 ? focused : burn.parts.findIndex((p) => !p));
    },
  },
    h("div", { className: "burn-head" },
      h("p", { className: "kind-badge" }, icon(kind.icon), kind.label),
      h("div", { className: "timer-box" }, icon("clock"), clock.timer),
    ),
    h("div", { className: "timebar", attrs: { "aria-hidden": "true" } }, clock.timeFill),
    h("figure", { className: "picture" },
      h("div", { className: "picture-frame" },
        h("img", { src: asset(round.image), alt: "The photo for this question", attrs: { decoding: "async" } }),
      ),
      pictureCredit(round),
    ),
    h("h2", { className: "prompt" }, round.prompt),
    h("p", { className: "hint" }, round.blurb),
    h("div", { className: "parts" }, rows.map((r) => r.row)),
    h("div", { className: "feedback" }, lamps, note),
    h("button", { className: "btn btn-gold btn-done", attrs: { type: "submit" } }, icon("lock"), "Lock in"),
  );
}

function startBurnClock() {
  if (!burn) return;
  setTimeout(() => burn?.input.focus(), 40);
  const tick = () => {
    if (!burn || burn.done) return;
    if (Date.now() >= burn.deadline) return finishBurn("time");
    const tenth = Math.ceil((burn.deadline - Date.now()) / 100);
    if (tenth !== burn.lastTick) {
      burn.lastTick = tenth;
      burn.updateClock();
    }
    burn.frame = requestAnimationFrame(tick);
  };
  // rAF pauses in background tabs, so a timeout makes sure time still runs out.
  const fallback = () => {
    if (!burn || burn.done) return;
    const left = burn.deadline - Date.now();
    if (left <= 0) return finishBurn("time");
    burn.fallback = setTimeout(fallback, Math.min(left, 400));
  };
  burn.frame = requestAnimationFrame(tick);
  fallback();
}

// ----- Top answer celebration -----

/**
 * Big moment for a top (Galaxy) answer: gold flash, a burst of pixel stars,
 * a "Top answer" banner. Sits over the screen without taking focus.
 */
function celebrateTop(name, points) {
  document.querySelector(".galaxy-burst")?.remove();
  const colors = words.sparks;
  const sparks = Array.from({ length: 40 }, (_, i) => {
    const angle = (i / 40) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 120 + Math.random() * Math.min(window.innerWidth, window.innerHeight) * 0.45;
    const spark = h("span", { className: "galaxy-spark" });
    const vars = {
      "--dx": `${Math.cos(angle) * dist}px`,
      "--dy": `${Math.sin(angle) * dist}px`,
      "--size": `${4 + Math.round(Math.random() * 2) * 4}px`,
      "--color": colors[i % colors.length],
      "--delay": `${Math.random() * 0.18}s`,
    };
    for (const [prop, value] of Object.entries(vars)) spark.style.setProperty(prop, value);
    return spark;
  });
  const burst = h("div", { className: "galaxy-burst", attrs: { role: "status" } },
    h("div", { className: "galaxy-flash" }),
    sparks,
    h("div", { className: "galaxy-banner" },
      h("p", { className: "galaxy-kicker" }, words.topKicker),
      h("strong", {}, name),
      levelTag(TOP_LEVEL, `${lvName(TOP_LEVEL)}, Ultra rare, +${points}`),
    ),
  );
  document.body.append(burst);
  try {
    navigator.vibrate?.([30, 40, 80]);
  } catch {
    // Vibration is optional.
  }
  setTimeout(() => burst.remove(), 2300);
}

// ----- Top answers for a finished burn -----

/** Every top answer on a burn's chart, with the player's own answers marked. */
function topAnswersBlock(result) {
  const top = result.topAnswers ?? [{ name: result.gem, detail: null }]; // older saved flights
  const level = levelOf(result.topLevel ?? TOP_LEVEL);
  const yours = new Set(result.kind === "picture" ? (result.parts ?? []).filter((p) => p.points >= p.share).map((p) => p.answer) : result.hits.map((x) => x.canonical));
  const found = top.filter((t) => yours.has(t.name)).length;
  const label =
    result.kind === "picture" ? "The answers"
    : result.kind === "year" ? "The year it happened"
      : result.kind === "closest" ? (top.length > 1 ? "Closest on the chart (a tie)" : "Closest on the chart")
        : top.length > 1 ? "Top answers" : "Top answer";
  return h("div", { className: `top-answers tier-${level.id}` },
    h("p", { className: "top-label" }, icon("trophy"), label, levelTag(level.id)),
    h("ul", {}, top.map((t) =>
      h("li", { className: yours.has(t.name) ? "is-yours" : "" }, t.name, t.detail && h("small", {}, t.detail)),
    )),
    h("p", { className: "top-result" }, found > 0 ? (top.length === 1 ? "You got it." : `You got ${found} of ${top.length}.`) : "Not this time."),
  );
}

/** Each part of a finished picture burn: what you said, its points, the answer. */
function pictureParts(result) {
  return h("div", { className: "picture-result" },
    result.image && h("img", { className: "picture-thumb", src: asset(result.image), alt: "" }),
    h("ul", { className: "part-list" }, (result.parts ?? []).map((p) =>
      h("li", { className: `tier-${p.tier}` },
        h("span", { className: "part-list-label" }, p.label),
        h("span", { className: "part-list-said" }, p.input ? p.canonical ?? p.input : "No answer",
          p.yearsOff ? h("small", {}, formatYearsOff(p.yearsOff, p.direction)) : ""),
        p.points > 0 ? levelTag(p.tier, `+${p.points}`) : levelTag("drift", "0"),
      ),
    )),
  );
}

// ----- Between burns -----

function renderBetween() {
  const s = state.screen;
  const just = s.just;
  const first = just.hits[0];
  const tier = just.kind === "list" ? bestTier(just.hits) ?? "drift" : first?.tier ?? "drift";
  const level = levelOf(tier);
  const total = sum(s.results);

  let headline;
  let sub;
  if (just.kind === "list") {
    headline = h("h2", { className: "reveal-title" }, `${just.hits.length} answer${just.hits.length === 1 ? "" : "s"}`);
    sub = just.hits.length
      ? h("p", { className: "reveal-sub" }, "Best: ", levelTag(tier), just.capped ? ` Full stack, ${LIST_CAP} max.` : "")
      : h("p", { className: "reveal-sub" }, just.timedOut ? "Time ran out before any answer." : "No answers this time.");
  } else if (first) {
    headline = h("h2", { className: `reveal-title tier-${tier}` }, lvName(tier));
    sub = h("p", { className: "reveal-sub" }, just.kind === "closest" || just.kind === "year" ? "Closeness: " : "Rarity: ", h("b", {}, just.kind === "closest" || just.kind === "year" ? lvName(tier) : level.rarity));
  } else {
    headline = h("h2", { className: "reveal-title" }, "No answer");
    sub = h("p", { className: "reveal-sub" }, just.timedOut ? "Time ran out." : "Nothing locked in.");
  }

  if (just.kind === "picture") {
    headline = h("h2", { className: `reveal-title tier-${tier}` }, just.points > 0 ? lvName(tier) : "No points");
    sub = h("p", { className: "reveal-sub" }, just.timedOut ? "Time ran out. " : "", `${just.points} of 100 for the picture.`);
  }

  const yourAnswer = first && just.kind !== "list" && just.kind !== "picture" && h("p", { className: "you-said" },
    "You said ", h("b", {}, first.canonical),
    just.kind === "closest" && first.deltaPct != null ? `, ${formatDelta(first.deltaPct)}` : "",
    just.kind === "year" && first.yearsOff != null ? `, ${formatYearsOff(first.yearsOff, first.direction)}` : "",
  );

  return h("article", { className: `panel reveal tier-${tier}`, attrs: { "aria-live": "polite" } },
    h("div", { className: "reveal-head" },
      h("p", { className: "burn-num" }, `${words.Round} ${s.index + 1} of 7 done`),
      h("p", { className: `reveal-points tier-${tier}` }, `+${just.points}`),
    ),
    headline,
    sub,
    rarityLamps(just.hits.length ? tier : null),
    yourAnswer,
    just.kind === "picture" && pictureParts(just),
    topAnswersBlock(just),
    h("p", { className: "fact" }, icon("book-open"), h("span", {}, just.aside)),
    h("div", { className: "reveal-foot" },
      h("p", { className: "running" }, "Total ", h("b", {}, fmt(total)), ` / ${fmt(PERFECT_SCORE)}`),
      h("button", { className: "btn btn-gold", attrs: { type: "button", "data-autofocus": "" }, onClick: () => nextBurn(s) },
        s.index === 6 ? (words.id === "space" ? "See my result" : `See my ${words.run}`) : `Next ${words.round}`, icon("chevron-right")),
    ),
  );
}

// ----- Result -----

function renderReport() {
  const { flight, practice } = state.screen;
  if (flight.pack) return renderPackReport(flight);
  const fleet = state.fleet;
  const average = !practice && fleet && fleet.pilots > 0 ? fleet.averageScore : null;
  const diff = average == null ? null : flight.score - average;
  const board = fleet?.board ?? [];
  const yourIndex = board.findIndex((x) => x.yours);
  const shown = board.slice(0, 8);
  if (yourIndex >= 8 && board[yourIndex]) shown.push(board[yourIndex]);
  let openId = null;

  const fleetStat = practice
    ? stat("Today's average", "-", "Practice isn't counted")
    : state.fleetStatus === "off"
      ? stat("Today's average", "-", "Live on the real site")
      : state.fleetStatus === "error"
        ? stat("Today's average", "-", "Couldn't reach the fleet")
        : average == null
          ? stat("Today's average", "...", "Sending your flight")
          : stat("Today's average", fmt(average), `You're ${diff >= 0 ? `${diff} above` : `${-diff} below`}`);

  const list = h("ol", { className: "burn-list" });
  const drawList = () =>
    mount(list, flight.rounds.map((r, i) => {
      const open = openId === r.id;
      const names = r.hits.map((x) => x.canonical).join(", ");
      const tier = r.hits.length ? bestTier(r.hits) : "drift";
      return h("li", { className: open ? "is-open" : "" },
        h("button", {
          className: "burn-row",
          attrs: { type: "button", "aria-expanded": String(open) },
          onClick: () => {
            openId = open ? null : r.id;
            drawList();
          },
        },
          h("span", { className: "burn-row-num" }, i + 1),
          h("span", { className: "burn-row-text" },
            h("span", { className: "burn-row-prompt" }, r.prompt),
            h("span", { className: "burn-row-answer" }, names || "No answer", r.hits.length === 1 && levelTag(r.hits[0].tier)),
          ),
          h("strong", { className: `burn-row-points tier-${tier}` }, r.points),
          icon(open ? "close" : "chevron-right"),
        ),
        open && h("div", { className: "burn-detail" },
          topAnswersBlock(r),
          h("p", { className: "fact" }, icon("book-open"), h("span", {}, r.aside)),
        ),
      );
    }));
  drawList();

  const copyBtn = h("button", { className: "btn btn-gold", attrs: { type: "button" } }, icon("copy"), "Copy result");
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(shareText(flight, callsignLabel(), average));
      copyBtn.replaceChildren(icon("check"), "Copied");
    } catch {
      copyBtn.replaceChildren(icon("copy"), "Copy result");
    }
  });

  return h("article", { className: "panel report" },
    h("p", { className: "flight-tag" }, practice ? "Practice flight, not counted" : `Flight ${flight.mission}, ${formatDay(flight.day)}`),
    h("div", { className: "report-score" },
      h("strong", {}, fmt(flight.score)),
      h("span", {}, `/ ${fmt(PERFECT_SCORE)} points`),
    ),
    h("p", { className: "report-stage" }, h("b", {}, stageName(flight.score)), `. ${toTheMoon(flight.score)}.`),
    h("div", { className: "stats" },
      stat(callsignLabel(), fmt(flight.score), "points"),
      fleetStat,
      !practice && stat("Streak", `${state.profile.streak}`, state.profile.streak === 1 ? "day" : "days in a row"),
    ),
    h("h2", { className: "section-title" }, "Your burns"),
    h("p", { className: "section-hint" }, "Tap a burn to see the top answer and a fact."),
    list,
    !practice && shown.length > 0 &&
      h("section", { className: "board" },
        h("h2", { className: "section-title" }, "Today's pilots"),
        yourIndex >= 0 && h("p", { className: "section-hint" }, `You're number ${yourIndex + 1} of ${fleet.pilots}.`),
        h("ol", {}, shown.map((x) =>
          h("li", { className: x.yours ? "is-you" : "" },
            h("span", { className: "board-rank" }, board.indexOf(x) + 1),
            h("span", { className: "board-name" }, x.yours ? `${callsignLabel()} (you)` : "Pilot"),
            h("span", { className: "board-score" }, fmt(x.score)),
          ),
        )),
        board.length > shown.length && h("p", { className: "section-hint" }, `${board.length - shown.length} more pilots today.`),
      ),
    h("div", { className: "cta-row" },
      copyBtn,
      h("button", { className: "btn btn-line", attrs: { type: "button" }, onClick: () => startFlight(true) }, icon("reload"), "Practice"),
      h("button", { className: "btn-text", attrs: { type: "button" }, onClick: () => go({ name: "pad" }) }, icon("home"), "Back to start"),
    ),
  );
}

/** End of a theme-pack run: score in the pack's own words, no fleet board. */
function renderPackReport(flight) {
  const pack = packById(flight.pack);
  const mine = state.profile.packs?.[flight.pack];
  const isBest = mine && flight.score >= mine.best && mine.played > 1;
  let openId = null;
  const list = h("ol", { className: "burn-list" });
  const drawList = () =>
    mount(list, flight.rounds.map((r, i) => {
      const open = openId === r.id;
      const tier = r.hits.length ? bestTier(r.hits) : "drift";
      return h("li", { className: open ? "is-open" : "" },
        h("button", {
          className: "burn-row",
          attrs: { type: "button", "aria-expanded": String(open) },
          onClick: () => {
            openId = open ? null : r.id;
            drawList();
          },
        },
          h("span", { className: "burn-row-num" }, i + 1),
          h("span", { className: "burn-row-text" },
            h("span", { className: "burn-row-prompt" }, r.prompt),
            h("span", { className: "burn-row-answer" }, r.hits.map((x) => x.canonical).join(", ") || "No answer", r.hits.length === 1 && levelTag(r.hits[0].tier)),
          ),
          h("strong", { className: `burn-row-points tier-${tier}` }, r.points),
          icon(open ? "close" : "chevron-right"),
        ),
        open && h("div", { className: "burn-detail" },
          r.kind === "picture" && pictureParts(r),
          topAnswersBlock(r),
          h("p", { className: "fact" }, icon("book-open"), h("span", {}, r.aside)),
        ),
      );
    }));
  drawList();

  const copyBtn = h("button", { className: "btn btn-line", attrs: { type: "button" } }, icon("copy"), "Copy result");
  copyBtn.addEventListener("click", async () => {
    const lines = [`FUELUP ${pack.name.toUpperCase()} · ${flight.score} / ${fmt(PERFECT_SCORE)} · ${stageName(flight.score)}`];
    flight.rounds.forEach((r, i) => lines.push(`${i + 1}. ${r.hits.map((x) => x.canonical).join(", ") || "—"} · ${r.points}`));
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      copyBtn.replaceChildren(icon("check"), "Copied");
    } catch {
      copyBtn.replaceChildren(icon("copy"), "Copy result");
    }
  });

  return h("article", { className: "panel report" },
    h("p", { className: "flight-tag" }, `${pack.name} · ${words.Run} over`),
    h("div", { className: "report-score" },
      h("strong", {}, fmt(flight.score)),
      h("span", {}, `/ ${fmt(PERFECT_SCORE)} points`),
    ),
    h("p", { className: "report-stage" }, h("b", {}, stageName(flight.score)), `. ${toTheGoal(flight.score)}.`),
    h("div", { className: "stats" },
      stat(`This ${words.run}`, fmt(flight.score), isBest ? "New best" : stageName(flight.score)),
      stat(`Best ${words.run}`, mine ? fmt(mine.best) : "-", mine ? stageName(mine.best) : ""),
      stat("Played", mine ? `${mine.played}` : "1", `${words.Run}s of ${pack.name}`),
    ),
    h("h2", { className: "section-title" }, `Your ${words.round}s`),
    h("p", { className: "section-hint" }, `Tap a ${words.round} to see the answers and a fact.`),
    list,
    h("div", { className: "cta-row" },
      h("button", { className: "btn btn-gold", attrs: { type: "button" }, onClick: () => startPack(pack.id) }, icon("reload"), `Play another ${words.run}`),
      copyBtn,
      h("button", { className: "btn-text", attrs: { type: "button" }, onClick: () => go({ name: "pad" }) }, icon("home"), "Back to start"),
    ),
  );
}

// ----- Menu -----

function howToPlay() {
  return h("div", { className: "how" },
    h("section", {},
      h("h3", {}, "The flight"),
      h("p", {}, "Every day there's one flight of 7 timed burns. A burn is one question. Everyone gets the same 7, and you can fly once a day. Practice as much as you like."),
    ),
    h("section", {},
      h("h3", {}, "Theme packs"),
      h("p", {}, "Packs like Sports are one subject, played as often as you like. Each has its own look and its own words: in Sports a burn is a game, Galaxy is Hall of Fame, and 1,000 points makes you Champions. Packs have picture questions too. They don't count toward the daily board."),
    ),
    h("section", {},
      h("h3", {}, "Kinds of burn"),
      h("ul", { className: "how-kinds" }, Object.values(KINDS).map((k) =>
        h("li", {}, icon(k.icon), h("div", {}, h("b", {}, k.label), h("p", {}, k.how))),
      )),
    ),
    h("section", {},
      h("h3", {}, "Rarer answers score more"),
      h("p", {}, "Every answer has a rarity level. Same points in every burn. Each burn has exactly one Galaxy answer, the hardest one."),
      h("table", { className: "level-table" },
        h("tbody", {}, LEVELS.map((l) =>
          h("tr", { className: `tier-${l.id}` },
            h("td", {}, levelTag(l.id)),
            h("td", {}, l.rarity),
            h("td", {}, `${l.points} pts`),
          ),
        )),
      ),
    ),
    h("section", {},
      h("h3", {}, "How close counts"),
      h("p", {}, `Closest number: only the single closest answer is ${lvName(TOP_LEVEL)}, then ${GAUGE_BANDS.map((b) => `${lvName(b.tier)} ${b.label}`).join(", ")}.`),
      h("p", {}, `Guess the year: ${YEAR_BANDS.map((b) => `${lvName(b.tier)} ${b.label}`).join(", ")}.`),
      h("p", {}, `Anything further off is ${lvName(OFF_COURSE.id)}, ${OFF_COURSE.points} points.`),
      h("p", {}, "Picture: each part (who, where, when) is an equal share of 100. The exact answer gets the full share; the right city instead of the stadium gets half, and a near year gets part of it."),
    ),
    h("section", {},
      h("h3", {}, `Your ${words.meter.toLowerCase()} is your points`),
      h("p", {}, words.id === "space"
        ? `The rocket climbs 1 step for every point. ${fmt(PERFECT_SCORE)} points lands on the Moon. Every 200 points is a new stage.`
        : `Every point moves your ${words.run} on. Every 200 points is a new stage: ${STAGES.slice(1).map((st) => words.stages[st.id]).join(", ")}.`),
    ),
  );
}

function renderMenu() {
  const page = state.menu;
  const s = state.screen.name;
  const inFlight = s === "play" || s === "between";
  const close = () => openMenu(null);
  const toPage = (p) => () => openMenu(p);
  const leave = () => {
    state.menu = null;
    const packId = state.screen.mission?.pack;
    go(packId ? { name: "pack", pack: packId } : { name: "pad" });
  };

  const row = (iconName, label, desc, onClick, extra) =>
    h("li", {},
      h("button", { className: "menu-row", attrs: { type: "button" }, onClick },
        icon(iconName),
        h("span", { className: "menu-row-text" }, h("b", {}, label), h("span", {}, desc)),
        extra ?? icon("chevron-right"),
      ),
    );

  let title;
  let content;
  if (page === "root") {
    title = "Menu";
    content = [
      inFlight && h("p", { className: "menu-note" }, icon("clock"), "The timer keeps running while the menu is open."),
      h("ul", { className: "menu-list" },
        row("info-box", "How to play", "Burn types, rarity levels and points", toPage("how")),
        row(muted() ? "volume-x" : "volume-2", "Sound", muted() ? "Sound is off" : "Sound is on", toggleMute,
          h("span", { className: `switch ${muted() ? "" : "is-on"}`, attrs: { "aria-hidden": "true" } }, h("span", {}))),
        row("shield", "Privacy", "What's stored, and what isn't", toPage("privacy")),
        row("notes", "Terms", "The rules of the game", toPage("terms")),
      ),
      inFlight && h("ul", { className: "menu-list menu-danger" },
        row("logout", `Leave this ${words.run}`, `Back to start. This ${words.run} won't be saved.`, toPage("leave")),
      ),
    ];
  } else if (page === "leave") {
    title = `Leave this ${words.run}?`;
    content = [
      h("p", { className: "menu-text" }, words.id === "space"
        ? "Nothing is saved until all 7 burns are finished. If you leave now, this flight is lost. You can still start today's flight again."
        : `Nothing is saved until all 7 ${words.round}s are finished. If you leave now, this ${words.run} is lost.`),
      h("div", { className: "cta-row" },
        h("button", { className: "btn btn-danger", attrs: { type: "button" }, onClick: leave }, icon("logout"), `Leave ${words.run}`),
        h("button", { className: "btn btn-line", attrs: { type: "button", "data-autofocus": "" }, onClick: close }, words.id === "space" ? "Keep flying" : "Keep playing"),
      ),
    ];
  } else if (page === "how") {
    title = "How to play";
    content = [howToPlay()];
  } else if (page === "terms") {
    title = "Terms";
    content = [h("div", { className: "menu-text" },
      h("p", {}, "Fuelup is a free daily game. One official flight per UTC day on this device. Practice doesn't count toward the board."),
      h("p", {}, "Points come from a fixed chart. A rarer listed answer scores more. Something true but missing from the chart scores nothing. That's the game, not a ruling on the world."),
      h("p", {}, "Finish all 7 burns and your score counts. Leaving early saves nothing."),
      h("p", {}, "The board shows anonymous scores. Please don't try to stuff it. The game is offered as it is and may change."),
    )];
  } else {
    title = "Privacy";
    content = [h("div", { className: "menu-text" },
      h("p", {}, "You can play without a name, an email or a sign-in."),
      h("p", {}, "Your pilot name stays in this browser and is never sent with your score. A random id, made on this device, tells today's pilots apart. It says nothing about who you are."),
      h("p", {}, "When you finish today's flight, your answers are checked so the score is real, then thrown away. What's kept is the day, that random id and your score. Practice stays on this device."),
      h("p", {}, "There are no ads and nothing is sold. Clearing this site's data removes your pilot name and id. A score already on the board stays there as a number with no name."),
    )];
  }

  const back = page !== "root" && page !== "leave" &&
    h("button", { className: "btn-text menu-back", attrs: { type: "button" }, onClick: toPage("root") }, icon("arrow-left"), "Menu");

  return h("div", { className: "menu-layer" },
    h("button", { className: "menu-scrim", attrs: { type: "button", "aria-label": "Close menu", tabindex: "-1" }, onClick: close }),
    h("div", { className: "panel menu-sheet", attrs: { role: "dialog", "aria-modal": "true", "aria-label": title } },
      h("header", { className: "menu-head" },
        back,
        h("h2", {}, title),
        h("button", { className: "btn-icon", attrs: { type: "button", "aria-label": "Close menu", "data-autofocus": "" }, onClick: close }, icon("close")),
      ),
      content,
    ),
  );
}

// ---------- Start ----------

function boot() {
  root = document.getElementById("app");
  if (!root) return;
  watchViewport();
  render();
}

boot();
window.__fuelupStart = boot;
