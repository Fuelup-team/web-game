// Fuelup game engine: matching answers, scoring burns, building the daily flight.
// Ported from the Grok demo. Pure functions only — no DOM here.
import { LIST_ROUNDS, SINGLE_ROUNDS, GAUGE_ROUNDS } from "./data.js";

/** Points per tier on a single-answer burn. */
export const SINGLE_POINTS = { drift: 8, vapor: 20, burn: 40, cruise: 60, orbit: 80, fuelup: 100 };
/** Points per tier on a list ("stack") burn. */
export const LIST_POINTS = { drift: 4, vapor: 8, burn: 16, cruise: 26, orbit: 36, fuelup: 48 };
/** A list burn never scores more than this. */
export const LIST_CAP = 160;
/** Score of a perfect flight. */
export const PERFECT_SCORE = 820;
/** Distance to the Moon, reached by a perfect flight. */
export const MOON_KM = 384400;
/** Tier ranking, for picking the best hit. */
export const TIER_RANK = { drift: 0, vapor: 1, burn: 2, cruise: 3, orbit: 4, fuelup: 5 };
/** Flight 1 was on this day. */
const FIRST_FLIGHT = Date.UTC(2026, 0, 1);
const DAY_MS = 86400000;

// ---------- Dates ----------

/** Today's date in UTC as YYYY-MM-DD. */
export function todayUtc(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** The day before a YYYY-MM-DD date. */
export function previousDay(day) {
  return new Date(Date.parse(`${day}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
}

/** Flight number for a day (1 Jan 2026 is flight 1). */
export function flightNumber(day) {
  return Math.floor((Date.parse(`${day}T00:00:00Z`) - FIRST_FLIGHT) / DAY_MS) + 1;
}

/** "11 Nov 2026" */
export function formatDay(day) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ---------- Formatting ----------

/** "12,345 km" */
export function formatKm(km) {
  return `${Math.max(0, Math.round(km)).toLocaleString("en-US")} km`;
}

/** Format a gauge value in its unit. */
export function formatValue(unit, value) {
  if (unit === "atomic") return String(value);
  if (unit === "meters") return `${Math.round(value).toLocaleString("en-US")} m`;
  if (unit === "kilometers") return `${Math.round(value).toLocaleString("en-US")} km`;
  if (value >= 1e6) {
    const millions = value / 1e6;
    const digits = millions >= 100 ? 0 : millions >= 10 ? 1 : 2;
    return `${millions.toFixed(digits)} million`;
  }
  return Math.round(value).toLocaleString("en-US");
}

/** "4.2% over", "12% under", "on the number" */
export function formatDelta(deltaPct) {
  const abs = Math.abs(deltaPct);
  if (abs < 0.05) return "on the number";
  return `${abs.toFixed(abs >= 10 ? 0 : 1)}% ${deltaPct < 0 ? "under" : "over"}`;
}

// ---------- Altitude ----------

/** Altitude in km for a score. 820 points reaches the Moon. */
export function altitudeFor(score) {
  const ratio = Math.max(0, score) / PERFECT_SCORE;
  return Math.round(MOON_KM * Math.min(1.05, ratio) ** 2.15);
}

/** Named zone for an altitude. */
export function zoneFor(km) {
  if (km < 80) return { id: "pad", name: "The pad", detail: "Still in the thick air. The next rare answer leaves the ground." };
  if (km < 2000) return { id: "leo", name: "Low orbit", detail: "Past the Kármán line. Earth has started to curve." };
  if (km < 20000) return { id: "meo", name: "Medium orbit", detail: "The atmosphere is a bright hem on the planet." };
  if (km < 42000) return { id: "geo", name: "Geostationary", detail: "You are holding over a single meridian." };
  if (km < 120000) return { id: "high", name: "High orbit", detail: "Earth is a full marble from up here." };
  if (km < 300000) return { id: "cislunar", name: "Cislunar space", detail: "The quiet stretch between two worlds." };
  if (km < 370000) return { id: "approach", name: "Lunar approach", detail: "The Moon is no longer a decoration." };
  if (km <= 392400) return { id: "moon", name: "The Moon", detail: "A perfect flight meets lunar distance." };
  return { id: "beyond", name: "Beyond the Moon", detail: "You kept burning after the chart ended." };
}

// ---------- Matching answers ----------

/** Lowercase, strip accents and punctuation, collapse spaces. */
export function normalize(text) {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Edit distance, capped: returns 3 for anything farther than 2. */
function editDistance(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ch = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ch === b.charCodeAt(j - 1) ? 0 : 1;
      const v = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > 2) return 3;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] ?? 3;
}

/** Every spelling (name + aliases) of every item, normalized. */
function spellings(items) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    for (const spelling of [item.name, ...(item.aliases ?? [])]) {
      const key = normalize(spelling);
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push({ canonical: item.name, tier: item.tier ?? "vapor", key, value: item.value });
      }
    }
  }
  return out;
}

/**
 * Find what the player meant. Exact match on any spelling first, then a
 * typo-tolerant match (1 typo, or 2 for long words) if it is unambiguous.
 */
export function matchAnswer(items, input) {
  const key = normalize(input);
  if (!key) return null;
  const all = spellings(items);
  const exact = all.find((s) => s.key === key);
  if (exact) return { canonical: exact.canonical, tier: exact.tier, value: exact.value, via: "exact" };
  if (key.length < 5 || /^\d+$/.test(key)) return null;

  let best = null;
  let bestDist = 99;
  let runnerUp = 99;
  for (const s of all) {
    if (s.key.length <= 3 || Math.abs(s.key.length - key.length) > 2) continue;
    const d = editDistance(key, s.key);
    if (d < bestDist) {
      runnerUp = bestDist;
      bestDist = d;
      best = s;
    } else if (d === bestDist || d < runnerUp) {
      runnerUp = d;
    }
  }
  const closeEnough = bestDist === 1 || (bestDist === 2 && key.length >= 8);
  if (!best || !closeEnough || runnerUp <= bestDist) return null;
  return { canonical: best.canonical, tier: best.tier, value: best.value, via: "fuzzy" };
}

/** Autocomplete suggestions for gauge rounds. */
export function suggest(items, input, limit = 5) {
  const key = normalize(input);
  if (!key) return [];
  const scored = [];
  for (const item of items) {
    let score = 0;
    for (const s of [item.name, ...(item.aliases ?? [])].map(normalize)) {
      if (!s) continue;
      if (s.startsWith(key)) score = Math.max(score, 3);
      else if (s.split(" ").some((w) => w.startsWith(key))) score = Math.max(score, 2);
      else if (s.includes(key)) score = Math.max(score, 1);
    }
    if (score) scored.push({ name: item.name, score, len: item.name.length });
  }
  scored.sort((a, b) => b.score - a.score || a.len - b.len);
  const names = [];
  for (const s of scored) {
    if (!names.includes(s.name)) names.push(s.name);
    if (names.length >= limit) break;
  }
  return names;
}

// ---------- Scoring ----------

/** Score a gauge answer by how close its value is to the target, on a ratio. */
export function gaugeScore(value, target) {
  const deltaPct = ((value - target) / target) * 100;
  const ratio = Math.max(value, target) / Math.max(1e-9, Math.min(value, target));
  if (ratio <= 1.025) return { tier: "fuelup", points: 100, deltaPct };
  if (ratio <= 1.07) return { tier: "orbit", points: 80, deltaPct };
  if (ratio <= 1.16) return { tier: "cruise", points: 60, deltaPct };
  if (ratio <= 1.35) return { tier: "burn", points: 40, deltaPct };
  if (ratio <= 1.9) return { tier: "vapor", points: 20, deltaPct };
  return { tier: "drift", points: 8, deltaPct };
}

/** The item on the chart nearest the target. */
function closestItem(items, target) {
  const miss = (v) => Math.max(v, target) / Math.min(v, target);
  return items.reduce((best, item) => (miss(item.value) < miss(best.value) ? item : best));
}

function foundGem(hits, gem) {
  const key = normalize(gem);
  return hits.some((h) => h.tier === "fuelup" || normalize(h.canonical) === key);
}

/**
 * Check one typed answer during a burn.
 * Returns { ok: true, hit } or { ok: false, reason }.
 */
export function tryAnswer(round, input, alreadyLogged) {
  const text = input.trim();
  if (!text) return { ok: false, reason: "Type an answer first." };

  if (round.kind === "closest") {
    const m = matchAnswer(round.items, text);
    if (!m || m.value == null) return { ok: false, reason: "Not on today's chart. Try another name." };
    const s = gaugeScore(m.value, round.target);
    return {
      ok: true,
      hit: { input: text, canonical: m.canonical, tier: s.tier, points: s.points, via: m.via, value: m.value, deltaPct: s.deltaPct },
    };
  }

  const m = matchAnswer(round.answers, text);
  if (!m) return { ok: false, reason: "Not on the chart. Spell it again, or burn a different answer." };
  if (alreadyLogged.includes(m.canonical)) return { ok: false, reason: `${m.canonical} is already on the stack.` };
  const points = (round.kind === "list" ? LIST_POINTS : SINGLE_POINTS)[m.tier];
  return { ok: true, hit: { input: text, canonical: m.canonical, tier: m.tier, points, via: m.via } };
}

/** Final result of a burn, from the canonical names the player logged. */
export function scoreRound(round, inputs) {
  if (round.kind === "closest") {
    const found = inputs.map((input) => ({ input, m: matchAnswer(round.items, input) })).find((x) => x.m?.value != null);
    const best = closestItem(round.items, round.target);
    let hit = null;
    if (found) {
      const s = gaugeScore(found.m.value, round.target);
      hit = {
        input: found.input,
        canonical: found.m.canonical,
        tier: s.tier,
        points: s.points,
        via: found.m.via,
        value: found.m.value,
        deltaPct: s.deltaPct,
      };
    }
    return {
      id: round.id,
      kind: "closest",
      prompt: round.prompt,
      hits: hit ? [hit] : [],
      points: hit?.points ?? 0,
      gem: best.name,
      gemDetail: `${best.name} · ${formatValue(round.unit, best.value)}`,
      gemHit: !!hit && (hit.tier === "fuelup" || normalize(hit.canonical) === normalize(best.name)),
      aside: round.aside,
      capped: false,
    };
  }

  const table = round.kind === "list" ? LIST_POINTS : SINGLE_POINTS;
  const hits = [];
  const seen = new Set();
  for (const input of inputs) {
    const m = matchAnswer(round.answers, input);
    if (!m || seen.has(m.canonical)) continue;
    seen.add(m.canonical);
    hits.push({ input, canonical: m.canonical, tier: m.tier, points: table[m.tier], via: m.via });
    if (round.kind === "rare") break;
  }
  const total = hits.reduce((sum, h) => sum + h.points, 0);
  return {
    id: round.id,
    kind: round.kind,
    prompt: round.prompt,
    hits,
    points: round.kind === "list" ? Math.min(LIST_CAP, total) : total,
    gem: round.gem,
    gemDetail: round.gem,
    gemHit: foundGem(hits, round.gem),
    aside: round.aside,
    capped: round.kind === "list" && total > LIST_CAP,
  };
}

// ---------- Daily flight ----------

/** FNV-1a hash of a string. */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seeded random number generator (mulberry32). */
function seededRandom(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 1831565813) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(list, random, count) {
  const pool = [...list];
  const out = [];
  for (let i = 0; i < count && pool.length; i++) {
    const [item] = pool.splice(Math.floor(random() * pool.length), 1);
    if (item) out.push(item);
  }
  return out;
}

function gaugePrompt(gauge, target) {
  const v = formatValue(gauge.unit, target);
  switch (gauge.id) {
    case "mountains": return `Name a mountain whose summit is closest to ${v}.`;
    case "towers": return `Name a tower whose height is closest to ${v}.`;
    case "rivers": return `Name a river whose length is closest to ${v}.`;
    case "population": return `Name a country with a population closest to ${v}.`;
    default: return `Name a chemical element with an atomic number closest to ${v}.`;
  }
}

/**
 * Build a flight of seven burns. The same seed always gives the same flight,
 * so every pilot gets identical burns on the same UTC day.
 */
export function buildFlight(seed, practice = false) {
  const random = seededRandom(hash(seed));
  const lists = pick(LIST_ROUNDS, random, 2);
  const singles = pick(SINGLE_ROUNDS, random, 4);
  const gauge = pick(GAUGE_ROUNDS, random, 1)[0];
  if (!gauge || lists.length < 2 || singles.length < 4) throw new Error("The chart is short a burn.");

  const target = gauge.targets[Math.floor(random() * gauge.targets.length)] ?? gauge.targets[0] ?? 1;
  const gaugeRound = {
    kind: "closest",
    id: gauge.id,
    prompt: gaugePrompt(gauge, target),
    blurb: gauge.blurb,
    aside: gauge.aside,
    seconds: gauge.seconds,
    unit: gauge.unit,
    target,
    noun: gauge.noun,
    items: gauge.items,
  };
  return {
    seed,
    day: practice ? todayUtc() : seed,
    number: practice ? 0 : flightNumber(seed),
    practice,
    rounds: [lists[0], singles[0], singles[1], gaugeRound, lists[1], singles[2], singles[3]],
  };
}

/** Summary of a finished flight. */
export function finishFlight(day, mission, rounds) {
  const score = rounds.reduce((sum, r) => sum + r.points, 0);
  const altitudeKm = altitudeFor(score);
  return { day, mission, score, altitudeKm, zone: zoneFor(altitudeKm), rounds };
}

/** Plain-text summary for the clipboard. */
export function shareText(flight, callsign, fleetAverage) {
  const lines = [
    `FUELUP · ${flight.mission ? `Flight ${flight.mission}` : "Practice"}`,
    `${callsign} · ${flight.score} pts · ${formatKm(flight.altitudeKm)} · ${flight.zone.name}`,
  ];
  if (fleetAverage != null) lines.push(`Fleet average today ${fleetAverage}`);
  flight.rounds.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.hits.map((h) => h.canonical).join(", ") || "—"} · ${r.points}`);
  });
  return lines.join("\n");
}

/** Label for burn number `index` (0-based). */
export function burnLabel(index, kind) {
  if (index === 0) return "Ignition";
  if (index === 6) return "Escape burn";
  if (kind === "list") return "Stack";
  if (kind === "closest") return "Gauge";
  return "Single burn";
}

/** Heading for the "best answer" panel in the report. */
export function bestAnswerLabel(kind) {
  if (kind === "closest") return "Closest on the chart";
  if (kind === "list") return "Best single answer";
  return "Best answer";
}

/** Split a list-burn entry on commas, semicolons or new lines. */
export function splitEntries(text) {
  return text.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
}

// ---------- Data checks (run once on load, like the demo) ----------

function validate() {
  const ids = [...LIST_ROUNDS, ...SINGLE_ROUNDS, ...GAUGE_ROUNDS].map((r) => r.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate prompt id");
  for (const round of [...LIST_ROUNDS, ...SINGLE_ROUNDS]) {
    const keys = new Set();
    for (const a of round.answers) {
      for (const s of [a.name, ...(a.aliases ?? [])]) {
        const k = normalize(s);
        if (!k) throw new Error(`Empty answer in ${round.id}`);
        if (keys.has(k)) throw new Error(`Duplicate answer ${k} in ${round.id}`);
        keys.add(k);
      }
    }
    if (!keys.has(normalize(round.gem))) throw new Error(`Gem ${round.gem} missing from ${round.id}`);
  }
  for (const g of GAUGE_ROUNDS) {
    if (g.targets.length < 3 || g.items.length < 8) throw new Error(`Thin chart ${g.id}`);
    const names = new Set();
    for (const item of g.items) {
      const k = normalize(item.name);
      if (names.has(k)) throw new Error(`Duplicate metric ${item.name} in ${g.id}`);
      names.add(k);
      if (!(item.value > 0)) throw new Error(`Bad value ${item.name}`);
    }
  }
}
validate();
