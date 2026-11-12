// Fuelup app: screens (pad, burn, reveal, report, menu) and the flight flow.
import { h, mount, icon } from "./dom.js";
import { createStage } from "./stage.js";
import {
  todayUtc, flightNumber, formatDay, formatKm, formatDelta,
  buildFlight, tryAnswer, scoreRound, finishFlight, shareText, suggest,
  burnLabel, splitEntries, TIER_RANK, LIST_CAP, PERFECT_SCORE, MOON_KM,
  LEVELS, OFF_COURSE, GAUGE_BANDS, levelOf,
} from "../game/engine.js";

/** "Galaxy · Ultra rare · +100" */
function levelLine(tier, points = levelOf(tier).points) {
  const level = levelOf(tier);
  return `${level.name} · ${level.rarity} · +${points}`;
}
import { loadProfile, saveProfile, logFlight } from "../game/storage.js";
import { audio, playHit, playMiss } from "../game/sound.js";
import { fetchFleet, submitFlight, fleetEnabled } from "../game/fleet.js";

const root = document.getElementById("app");
const day = todayUtc();

// ---------- State ----------

const state = {
  profile: loadProfile(),
  fleet: null,
  fleetError: false,
  callsign: "",
  rulesOpen: false,
  menu: null, // null | "root" | "leave" | "how" | "terms" | "privacy"
  screen: { name: "pad" }, // pad | play | between | report
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
const callsignLabel = () => (state.callsign.trim() || "Pilot").slice(0, 18);
const todaysFlight = () => state.profile.flights[day];
const sum = (items) => items.reduce((total, x) => total + x.points, 0);

if (fleetEnabled) {
  fetchFleet(day, state.profile.pilotKey)
    .then((fleet) => {
      state.fleet = fleet;
      state.fleetError = false;
      if (state.screen.name === "pad") render();
    })
    .catch(() => {
      state.fleetError = true;
    });
}

// ---------- Mobile keyboard handling ----------

function watchViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => {
    const keyboard = window.innerHeight - vv.height > 80;
    document.documentElement.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
    document.documentElement.style.setProperty("--vv-top", `${Math.round(vv.offsetTop)}px`);
    root.classList.toggle("is-keyboard", keyboard);
    if (keyboard) window.scrollTo(0, 0);
  };
  update();
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
}

// ---------- Flow ----------

function go(screen) {
  stopBurn();
  state.screen = screen;
  render();
}

function startFlight(practice) {
  const callsign = state.callsign.trim().slice(0, 18);
  if (callsign !== state.profile.callsign) setProfile({ ...state.profile, callsign });
  audio(); // unlock sound on this click
  const mission = practice ? buildFlight(`practice:${crypto.randomUUID()}`, true) : buildFlight(day, false);
  go({ name: "play", mission, index: 0, results: [] });
}

function stopBurn() {
  if (!burn) return;
  cancelAnimationFrame(burn.frame);
  clearTimeout(burn.fallback);
  burn = null;
}

/** End the current burn (sealed by the player, or out of time). */
function finishBurn(reason) {
  const screen = state.screen;
  if (!burn || burn.done || screen.name !== "play") return;
  burn.done = true;
  const round = screen.mission.rounds[screen.index];
  let hits = burn.hits;
  if (reason === "time" && burn.draft.trim()) {
    const result = checkEntries(round, burn.draft, hits);
    if (!result.bad) hits = result.hits;
  }
  const scored = scoreRound(round, hits.map((x) => x.canonical));
  const results = [...screen.results, scored];
  stage?.boost();

  if (screen.index >= screen.mission.rounds.length - 1) {
    const flight = finishFlight(screen.mission.day, screen.mission.number, results);
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
    state.fleetError = false;
  } catch {
    state.fleetError = true;
  }
  if (state.screen.name === "report") render();
}

function nextBurn(between) {
  go({ name: "play", mission: between.mission, index: between.index + 1, results: between.results });
}

/** Check typed text against the round. List burns accept several, comma-separated. */
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
  const note =
    round.kind === "list"
      ? added === 1
        ? `${last.via === "fuzzy" ? "Logged as " : ""}${last.canonical} · ${levelLine(last.tier)}`
        : `${added} logged · ${Math.min(LIST_CAP, sum(hits))} of ${LIST_CAP} points on this stack`
      : `${last.via === "fuzzy" ? "Locked as " : ""}${last.canonical} · ${levelLine(last.tier, last.points)}`;
  return { hits, note, bad: false, best };
}

// ---------- Rendering ----------

function render() {
  if (stage && !["play", "between", "report"].includes(state.screen.name)) {
    stage.destroy();
    stage = null;
  }
  const s = state.screen;
  root.className = ["fuel-app", root.classList.contains("is-keyboard") ? "is-keyboard" : ""].filter(Boolean).join(" ");

  const children = [];
  if (state.menu) children.push(renderMenu());
  if (s.name === "pad") {
    children.push(renderPad());
  } else {
    if (!stage) stage = createStage();
    stage.setScore(stageScore());
    const deck = h("div", { className: "deck" }, renderDeckBar());
    if (s.name === "play") deck.append(renderBurn());
    if (s.name === "between") deck.append(renderBetween());
    if (s.name === "report") deck.append(renderReport());
    children.push(h("section", { className: "flight" }, stage.el, deck));
  }
  mount(root, children);
  if (s.name === "play") startBurnClock();
}

function stageScore() {
  const s = state.screen;
  if (s.name === "report") return s.flight.score;
  const done = sum(s.results);
  if (s.name !== "play" || !burn) return done;
  const live = sum(burn.hits);
  return done + (s.mission.rounds[s.index]?.kind === "list" ? Math.min(LIST_CAP, live) : live);
}

function renderDeckBar() {
  const s = state.screen;
  const meta =
    s.name === "report"
      ? s.practice ? "Practice" : `Flight ${s.flight.mission}`
      : `${burnLabel(s.index, s.mission.rounds[Math.min(s.index, 6)]?.kind ?? "rare")} · ${Math.min(s.index + 1, 7)} / 7`;
  return h(
    "header",
    { className: "deck-bar" },
    h("button", {
      className: "icon-btn",
      attrs: { type: "button", "aria-label": "Back to the pad" },
      onClick: () => (s.name === "report" ? go({ name: "pad" }) : openMenu("leave")),
    }, icon("arrow-left")),
    h("p", { className: "brand" }, "Fuelup"),
    h("p", { className: "deck-meta" }, meta),
    h("button", {
      className: "icon-btn",
      attrs: { type: "button", "aria-label": muted() ? "Unmute" : "Mute" },
      onClick: toggleMute,
    }, icon(muted() ? "volume-x" : "volume-2")),
    h("button", {
      className: "icon-btn",
      attrs: { type: "button", "aria-label": "Menu" },
      onClick: () => openMenu("root"),
    }, icon("menu")),
  );
}

function toggleMute() {
  setProfile({ ...state.profile, muted: !state.profile.muted });
  rerenderKeepingBurn();
}

function openMenu(page) {
  state.menu = page;
  rerenderKeepingBurn();
}

/** Re-render chrome (menu, mute icon) without restarting a burn in progress. */
function rerenderKeepingBurn() {
  if (state.screen.name !== "play" || !burn) return render();
  const deck = root.querySelector(".deck");
  deck.querySelector(".deck-bar").replaceWith(renderDeckBar());
  root.querySelector(".menu-layer")?.remove();
  if (state.menu) root.prepend(renderMenu());
}

function stat(label, value, detail) {
  return h("div", { className: "stat" },
    h("p", { className: "stat-label" }, label),
    h("p", { className: "stat-value" }, value),
    h("p", { className: "stat-detail" }, detail),
  );
}

function rules() {
  return h("div", { className: "rules" },
    h("p", {}, "Each flight is seven timed burns, about half a minute to fifty seconds. The clock does not pause."),
    h("p", {}, "Every answer has a rarity. The rarer it is, the farther it flies, and the more points it scores. Same price in every burn. Each burn hides exactly one Galaxy answer, the hardest one on the chart:"),
    h("table", { className: "level-table" },
      h("tbody", {}, LEVELS.map((l) =>
        h("tr", { className: `tier-${l.id}` },
          h("td", { className: "level-name" }, h("span", { className: "level-pill" }, l.name)),
          h("td", {}, l.rarity),
          h("td", {}, `${l.points} pts`),
        ),
      )),
    ),
    h("ol", {},
      h("li", {}, `Single burns want one answer. You can retry until one locks. Up to 100 points.`),
      h("li", {}, `Stack burns want as many correct names as you can type. Each one adds its points, up to ${LIST_CAP}.`),
      h("li", {},
        `Gauge burns want the closest thing on the chart. Galaxy only for the single closest answer, then ${GAUGE_BANDS.map((b) => `${levelOf(b.tier).name} ${b.label}`).join(", ")}. Further off is ${OFF_COURSE.name}, ${OFF_COURSE.points} points.`),
    ),
    h("p", { className: "fine" },
      `After the flight, tap any burn. It opens the best answer on that chart and a short fact. A perfect flight, ${PERFECT_SCORE.toLocaleString("en-US")} points, meets the Moon at ${formatKm(MOON_KM)}.`),
  );
}

// ----- Pad -----

function renderPad() {
  const flight = todaysFlight();
  const fleet = state.fleet;
  const streak = state.profile.streak;
  const fleetDetail = !fleetEnabled
    ? "Fleet board not connected yet"
    : fleet && fleet.pilots > 0
      ? `${fleet.pilots} pilot${fleet.pilots === 1 ? "" : "s"} today`
      : "No flights logged yet";

  const input = h("input", {
    value: state.callsign,
    maxLength: 18,
    placeholder: "Pilot",
    attrs: { autocomplete: "off" },
    onInput: (e) => (state.callsign = e.target.value),
  });

  const rulesBtn = h("button", {
    className: "text-btn",
    attrs: { type: "button", "aria-expanded": String(state.rulesOpen) },
    onClick: () => {
      state.rulesOpen = !state.rulesOpen;
      render();
    },
  }, state.rulesOpen ? "Hide the chart" : "How a burn scores");

  return h("section", { className: "pad" },
    h("img", { className: "pad-photo", src: "public/art/pad.jpg", alt: "" }),
    h("img", { className: "hero-rocket", src: "public/art/rocket.png", alt: "" }),
    h("div", { className: "pad-scrim" }),
    h("article", { className: "folio" },
      h("div", { className: "folio-top" },
        h("p", { className: "kicker" }, `Flight ${flightNumber(day)} · ${formatDay(day)} UTC`),
        h("button", { className: "text-btn", attrs: { type: "button" }, onClick: () => openMenu("root") }, "Menu"),
      ),
      h("h1", {}, "Fuelup"),
      h("p", { className: "lede" }, "Seven burns. The obvious answer still lifts. The rare one goes farther."),
      h("label", { className: "field" },
        h("span", {}, "Callsign on your hull"),
        input,
        h("small", {}, "Stays on this device. The fleet average is anonymous."),
      ),
      h("div", { className: "stat-row" },
        stat("Fleet average", fleet && fleet.pilots > 0 ? `${fleet.averageScore}` : "—", fleetDetail),
        stat("Your flight", flight ? `${flight.score}` : "—",
          flight ? flight.zone.name : streak > 1 ? `${streak} day streak` : "One ascent today"),
      ),
      h("div", { className: "actions" },
        flight
          ? h("button", { className: "btn btn-primary", attrs: { type: "button" },
              onClick: () => go({ name: "report", flight, practice: false }) }, "Review today's ascent")
          : h("button", { className: "btn btn-primary", attrs: { type: "button" },
              onClick: () => startFlight(false) }, "Ignite today's flight"),
        h("button", { className: "btn btn-ghost", attrs: { type: "button" }, onClick: () => startFlight(true) }, "Practice scramble"),
      ),
      rulesBtn,
      state.rulesOpen && rules(),
      h("p", { className: "fine" },
        `Same seven burns for every pilot on this UTC day. A perfect flight, ${PERFECT_SCORE.toLocaleString("en-US")} points, meets the Moon at ${formatKm(MOON_KM)}.`),
    ),
  );
}

// ----- Burn (one timed round) -----

function renderBurn() {
  const s = state.screen;
  const round = s.mission.rounds[s.index];
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
  const meterFill = h("span");
  const chips = h("ul", { className: "chips" });
  const suggestList = h("ul", { className: "suggest", attrs: { role: "listbox" } });
  const note = h("p", { className: "note", attrs: { "aria-live": "polite" } });

  const input = h("input", {
    id: "burn-answer",
    attrs: {
      autocapitalize: "off",
      autocorrect: "off",
      spellcheck: "false",
      autocomplete: "off",
      enterkeyhint: round.kind === "list" ? "next" : "done",
      placeholder: round.kind === "list" ? "Type a name, Enter, keep going" : "One answer",
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
    if (bad) {
      void note.offsetWidth; // restart the shake animation
      note.classList.add("shake");
    }
  }

  function defaultNote() {
    const points = Math.min(LIST_CAP, sum(burn.hits));
    return round.kind === "list" ? `${points} of ${LIST_CAP} points on this stack` : "A wrong try does not end the burn.";
  }

  function drawChips() {
    if (round.kind !== "list") return;
    chips.hidden = burn.hits.length === 0;
    mount(chips, burn.hits.map((hit) =>
      h("li", { className: `chip tier-${hit.tier}` },
        h("span", {}, hit.canonical, h("small", { className: "chip-level" }, ` ${levelOf(hit.tier).name} +${hit.points}`)),
        h("button", {
          attrs: { type: "button", "aria-label": `Remove ${hit.canonical}` },
          onClick: () => {
            burn.hits = burn.hits.filter((x) => x.canonical !== hit.canonical);
            drawChips();
            stage.setScore(stageScore());
            setNote(defaultNote(), false);
          },
        }, "×"),
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
    const top = result.best === "galaxy" ? result.hits.findLast((x) => x.tier === "galaxy") : null;
    stage.boost(!!top);
    if (top) celebrateTop(top.canonical, top.points);
    if (round.kind === "list") input.focus();
    else finishBurn("seal");
  }

  burn.updateClock = () => {
    const left = Math.max(0, burn.deadline - Date.now());
    const secs = left / 1000;
    timer.textContent = `${secs >= 10 ? Math.ceil(secs) : secs.toFixed(1)}s`;
    timer.className = left < 5000 ? "timer is-low" : "timer";
    timer.setAttribute("aria-label", `${Math.ceil(secs)} seconds left`);
    meterFill.style.width = `${Math.max(0, Math.min(100, (left / burn.total) * 100))}%`;
  };

  drawChips();
  drawSuggestions();
  setNote(defaultNote(), false);
  burn.updateClock();
  burn.input = input;

  return h("form", {
    className: "folio play-card",
    onSubmit: (e) => {
      e.preventDefault();
      commit();
    },
  },
    h("div", { className: "play-top" },
      h("p", { className: "kicker" }, `${burnLabel(s.index, round.kind)} · ${s.index + 1} of 7`),
      timer,
    ),
    h("div", { className: "meter", attrs: { "aria-hidden": "true" } }, meterFill),
    h("h2", {}, round.prompt),
    h("p", { className: "blurb" }, round.blurb),
    round.kind === "list" && chips,
    h("div", { className: "answer-row" },
      h("label", { className: "sr-only", attrs: { for: "burn-answer" } }, "Answer"),
      input,
      h("button", { className: "btn btn-primary btn-inline", attrs: { type: "submit" } }, round.kind === "list" ? "Log" : "Lock"),
    ),
    round.kind === "closest" && suggestList,
    note,
    round.kind === "list" &&
      h("button", { className: "text-btn", attrs: { type: "button" }, onClick: () => finishBurn("seal") }, "Seal this burn"),
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

// ----- Between burns -----

/**
 * Big moment for a top (Galaxy) answer: gold flash, a burst of stars,
 * a "Top answer" banner. Sits over the screen without taking focus.
 */
function celebrateTop(name, points) {
  document.querySelector(".galaxy-burst")?.remove();
  const colors = ["#f0b429", "#fff3cf", "#f4ead8", "#e08a3c", "#c79bff"];
  const sparks = Array.from({ length: 46 }, (_, i) => {
    const angle = (i / 46) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 140 + Math.random() * Math.min(window.innerWidth, window.innerHeight) * 0.45;
    const star = i % 3 === 0;
    const spark = h("span", { className: star ? "galaxy-spark is-star" : "galaxy-spark" }, star ? "✦" : null);
    const vars = {
      "--dx": `${Math.cos(angle) * dist}px`,
      "--dy": `${Math.sin(angle) * dist}px`,
      "--rot": `${Math.round(Math.random() * 540 - 270)}deg`,
      "--size": `${4 + Math.random() * 7}px`,
      "--color": colors[i % colors.length],
      "--delay": `${Math.random() * 0.18}s`,
    };
    for (const [prop, value] of Object.entries(vars)) spark.style.setProperty(prop, value);
    return spark;
  });
  const burst = h("div", { className: "galaxy-burst", attrs: { "aria-live": "assertive" } },
    h("div", { className: "galaxy-flash" }),
    sparks,
    h("div", { className: "galaxy-banner tier-galaxy" },
      h("p", { className: "kicker" }, "Top answer"),
      h("strong", {}, name),
      h("span", { className: "level-pill" }, `Galaxy · Ultra rare · +${points}`),
    ),
  );
  document.body.append(burst);
  navigator.vibrate?.([30, 40, 80]);
  setTimeout(() => burst.remove(), 2300);
}

/** The rarest level among some hits, or null. */
function bestTier(hits) {
  return hits.reduce((best, x) => (!best || TIER_RANK[x.tier] > TIER_RANK[best] ? x.tier : best), null);
}

/**
 * Every top answer on this burn's chart (e.g. all Galaxy answers), with the
 * player's own answers highlighted and listed first.
 */
function topAnswersBlock(result) {
  const top = result.topAnswers ?? [{ name: result.gem, detail: null }]; // older saved flights
  const level = levelOf(result.topLevel ?? "galaxy");
  const yours = new Set(result.hits.map((x) => x.canonical));
  const ordered = result.kind === "closest" ? top : [...top.filter((t) => yours.has(t.name)), ...top.filter((t) => !yours.has(t.name))];
  const max = 12;
  const shown = ordered.slice(0, max);
  const found = top.filter((t) => yours.has(t.name)).length;
  const label =
    result.kind === "closest"
      ? top.length > 1 ? `Closest on the chart · ${level.name} · ${top.length} answers` : "Closest on the chart"
      : `${level.name} answers · ${level.rarity} · ${top.length}`;
  return h("div", { className: `top-answers tier-${level.id}` },
    h("p", { className: "kicker" }, label),
    h("ul", {}, shown.map((t) =>
      h("li", { className: yours.has(t.name) ? "is-yours" : "" }, t.name, t.detail && h("small", {}, ` ${t.detail}`)),
    )),
    ordered.length > max && h("p", { className: "fine" }, `+ ${ordered.length - max} more`),
    found > 0
      ? h("p", { className: "fine" }, top.length === 1 ? "You found it." : `You found ${found} of ${top.length}.`)
      : h("p", { className: "fine" }, "None of yours this time."),
  );
}

function renderBetween() {
  const s = state.screen;
  const just = s.just;
  const first = just.hits[0];
  const tier = just.kind === "list" ? bestTier(just.hits) ?? "drift" : first?.tier ?? "drift";
  const level = levelOf(tier);

  let title;
  let pill = null;
  if (just.kind === "list") {
    title = h("h2", {}, `${just.hits.length} logged`, h("span", {}, ` +${just.points}`));
    if (just.hits.length) pill = h("span", { className: "level-pill" }, `Best: ${level.name}${just.capped ? ` · Stack full, ${LIST_CAP} max` : ""}`);
  } else if (first) {
    title = h("h2", {}, h("span", { className: "level-word" }, level.name), h("span", {}, ` +${just.points}`));
    pill = h("span", { className: "level-pill" }, just.kind === "closest" ? `Closeness · ${level.name}` : `${level.name} · ${level.rarity}`);
  } else {
    title = h("h2", {}, "No answer", h("span", {}, " +0"));
  }

  return h("article", { className: `folio reveal tier-${tier}` },
    h("p", { className: "kicker" }, `Burn ${s.index + 1} sealed`),
    title,
    pill && h("p", {}, pill),
    first && just.kind !== "list" &&
      h("p", { className: "reveal-name" }, `You said ${first.canonical}`, first.deltaPct != null && first.value != null ? ` · ${formatDelta(first.deltaPct)}` : ""),
    topAnswersBlock(just),
    h("p", { className: "aside" }, just.aside),
    h("p", { className: "running" }, `Flight total ${sum(s.results)} of ${PERFECT_SCORE.toLocaleString("en-US")}`),
    h("button", { className: "btn btn-primary", attrs: { type: "button" }, onClick: () => nextBurn(s) },
      s.index === 6 ? "Read the ascent" : "Next burn"),
  );
}

// ----- Report -----

function renderReport() {
  const { flight, practice } = state.screen;
  const fleet = state.fleet;
  const average = !practice && fleet && fleet.pilots > 0 ? fleet.averageScore : null;
  const diff = average == null ? null : flight.score - average;
  const board = fleet?.board ?? [];
  const yourIndex = board.findIndex((x) => x.yours);
  const shown = board.slice(0, 8);
  if (yourIndex >= 8 && board[yourIndex]) shown.push(board[yourIndex]);
  let openId = null;

  const fleetDetail = !fleetEnabled
    ? "Fleet board not connected yet"
    : state.fleetError
      ? "Could not reach the fleet"
      : diff == null
        ? practice ? "Practice stays off the board" : fleet && fleet.pilots === 0 ? "You open the average" : "One flight per pilot"
        : `${diff >= 0 ? "+" : ""}${diff} vs the fleet`;

  const list = h("ol", { className: "burn-list" });
  const drawList = () =>
    mount(list, flight.rounds.map((r, i) => {
      const open = openId === r.id;
      const names = r.hits.map((x) => x.canonical).join(", ");
      return h("li", { className: open ? "is-open" : "" },
        h("button", {
          className: "burn-toggle",
          attrs: { type: "button", "aria-expanded": String(open) },
          onClick: () => {
            openId = open ? null : r.id;
            drawList();
          },
        },
          h("div", {},
            h("p", { className: "burn-index" }, i + 1),
            h("div", {},
              h("p", { className: "burn-prompt" }, r.prompt),
              h("p", { className: "burn-answer" },
                names || "No answer",
                r.hits.length === 1 && h("em", { className: `tier-${r.hits[0].tier}` }, " ", h("span", { className: "level-pill" }, levelOf(r.hits[0].tier).name)),
              ),
            ),
          ),
          h("strong", { className: r.hits.length ? `tier-${bestTier(r.hits)}` : "" }, r.points),
        ),
        open && h("div", { className: "gem-pillow" },
          topAnswersBlock(r),
          h("p", { className: "gem-fact" }, r.aside),
          h("p", { className: "fine" }, names ? `You logged ${names}.` : "You logged nothing on this burn."),
        ),
      );
    }));
  drawList();

  const copyBtn = h("button", { className: "btn btn-primary", attrs: { type: "button" } }, "Copy the flight");
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(shareText(flight, callsignLabel(), average));
      copyBtn.textContent = "Copied";
    } catch {
      copyBtn.textContent = "Copy the flight";
    }
  });

  return h("article", { className: "folio report" },
    h("p", { className: "kicker" }, practice ? "Practice · not in today's average" : `Flight ${flight.mission} · ${formatDay(flight.day)}`),
    h("h2", {}, flight.zone.name),
    h("p", { className: "altitude" }, formatKm(flight.altitudeKm)),
    h("p", { className: "zone-detail" }, flight.zone.detail),
    h("div", { className: "stat-row" },
      stat(callsignLabel(), `${flight.score}`, `of ${PERFECT_SCORE.toLocaleString("en-US")} points`),
      stat("Fleet today", state.fleetError || average == null ? "—" : `${average}`, fleetDetail),
    ),
    !practice && state.profile.streak > 1 && h("p", { className: "streak" }, `${state.profile.streak} day streak`),
    h("p", { className: "fine burn-hint" }, "Tap a burn for the best answer."),
    list,
    !practice && shown.length > 0 &&
      h("div", { className: "board" },
        h("p", { className: "kicker" }, "Each pilot today", yourIndex >= 0 ? ` · you are ${yourIndex + 1} of ${fleet?.pilots}` : ""),
        h("ol", {}, shown.map((x) =>
          h("li", { className: x.yours ? "is-you" : "" },
            h("span", {}, x.yours ? callsignLabel() : `Pilot ${board.indexOf(x) + 1}`),
            h("span", {}, `${x.score} · ${formatKm(x.altitudeKm)}`),
          ),
        )),
        board.length > shown.length && h("p", { className: "fine" }, `${board.length - shown.length} more pilots out today.`),
      ),
    h("div", { className: "actions" },
      copyBtn,
      h("button", { className: "btn btn-ghost", attrs: { type: "button" }, onClick: () => startFlight(true) }, "Practice scramble"),
    ),
    h("button", { className: "text-btn", attrs: { type: "button" }, onClick: () => go({ name: "pad" }) }, "Back to the pad"),
  );
}

// ----- Menu -----

function renderMenu() {
  const page = state.menu;
  const s = state.screen.name;
  const inBurn = s === "play";
  const canLeave = s !== "pad";
  const confirmLeave = s === "play" || s === "between";
  const close = () => openMenu(null);
  const toPage = (p) => () => openMenu(p);
  const leave = () => {
    state.menu = null;
    go({ name: "pad" });
  };
  const back = () => h("button", { className: "text-btn", attrs: { type: "button" }, onClick: toPage("root") }, "Back to the menu");
  const btn = (label, onClick, className) => h("button", { className, attrs: { type: "button" }, onClick }, label);

  let content;
  if (page === "root") {
    content = [
      h("p", { className: "kicker" }, "Fuelup"),
      h("h2", {}, "Menu"),
      inBurn && h("p", { className: "fine" }, "The clock keeps running while this is open."),
      h("div", { className: "menu-list" },
        canLeave && btn("Back to the pad", confirmLeave ? toPage("leave") : leave),
        btn("How to play", toPage("how")),
        btn("Terms", toPage("terms")),
        btn("Privacy", toPage("privacy")),
        btn(muted() ? "Sound on" : "Sound off", toggleMute),
        btn("Close", close),
      ),
    ];
  } else if (page === "leave") {
    content = [
      h("p", { className: "kicker" }, "Leave"),
      h("h2", {}, "Back to the pad?"),
      h("p", { className: "blurb" },
        "Nothing is logged until all seven burns are finished. Leave now and this ascent is gone. You can still ignite today's flight."),
      h("div", { className: "actions" },
        btn("Leave the flight", leave, "btn btn-primary"),
        btn("Stay", toPage("root"), "btn btn-ghost"),
      ),
    ];
  } else if (page === "how") {
    content = [h("p", { className: "kicker" }, "How to play"), h("h2", {}, "Seven burns"), rules(), back()];
  } else if (page === "terms") {
    content = [
      h("p", { className: "kicker" }, "Terms"),
      h("h2", {}, "The chart is the game"),
      h("div", { className: "legal" },
        h("p", {}, "Fuelup is a free daily game. One official flight per UTC day on this device. Practice does not change today's average."),
        h("p", {}, "Points come from a fixed chart. A rarer listed answer scores more. Something true but missing from the chart scores nothing. That is the game, not a ruling on the world."),
        h("p", {}, "Finish the seven burns and the score is what counts. Leaving early logs nothing."),
        h("p", {}, "The fleet board is anonymous scores. Don't try to stuff it. The game is offered as-is, and it can change."),
      ),
      back(),
    ];
  } else {
    content = [
      h("p", { className: "kicker" }, "Privacy"),
      h("h2", {}, "No account"),
      h("div", { className: "legal" },
        h("p", {}, "You can play without a name, an email, or a sign-in."),
        h("p", {}, "Your callsign stays in this browser. It is not sent with your score. A random id, invented on this device, is how today's average tells pilots apart. It says nothing about who you are."),
        h("p", {}, "When you finish today's flight, the answers are checked so the score is real, then thrown away. What is kept is the day, that random id, the score, and the altitude. Practice answers stay on this device."),
        h("p", {}, "There are no ads and nothing here is sold. Clearing this site's data removes the callsign and the id. A score already logged stays on the board as a number with no name."),
      ),
      back(),
    ];
  }

  return h("div", { className: "menu-layer", attrs: { role: "dialog", "aria-modal": "true", "aria-label": "Menu" } },
    h("button", { className: "menu-scrim", attrs: { type: "button", "aria-label": "Close menu" }, onClick: close }),
    h("div", { className: "menu-sheet" }, content),
  );
}

// ---------- Start ----------

watchViewport();
render();
