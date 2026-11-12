// Fleet board logic, used by the Cloudflare Worker (worker/index.js).
// Kept separate from Cloudflare so it can be tested with a fake store.
//
// A store needs: list({ prefix }) -> { blobs: [{ key, data? }] },
// get(key) -> value or null, setJSON(key, value). If list() already returns
// each entry's data, no extra reads are needed.
//
// Storage: one entry per pilot per day, key "YYYY-MM-DD/<pilotKey>",
// value { score, at }. Only the day, the random pilot id and the score are
// kept; answers are re-scored here and then thrown away.
import { buildFlight, scoreRound, finishFlight, todayUtc, previousDay } from "../game/engine.js";

const PILOT_KEY = /^[a-f0-9]{32}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class FleetError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Only today's flight (or yesterday's, for pilots who finish just after midnight UTC). */
function checkDay(day, now) {
  if (typeof day !== "string" || !DAY.test(day)) throw new FleetError("Bad day.");
  const today = todayUtc(now);
  if (day !== today && day !== previousDay(today)) throw new FleetError("That flight is closed.");
}

function checkPilot(pilotKey) {
  if (typeof pilotKey !== "string" || !PILOT_KEY.test(pilotKey)) throw new FleetError("Bad pilot id.");
}

/** Today's board: { pilots, averageScore, board: [{ score, yours }] }, best first. */
export async function readFleet(store, day, pilotKey, now = new Date()) {
  checkDay(day, now);
  const { blobs } = await store.list({ prefix: `${day}/` });
  const entries = await Promise.all(
    blobs.map(async ({ key, data }) => ({ key, data: data ?? (await store.get(key, { type: "json" })) })),
  );
  const yourKey = PILOT_KEY.test(pilotKey ?? "") ? `${day}/${pilotKey}` : null;
  const board = entries
    .filter((e) => e.data && Number.isFinite(e.data.score))
    .map((e) => ({ score: e.data.score, yours: e.key === yourKey }))
    .sort((a, b) => b.score - a.score);
  const pilots = board.length;
  const averageScore = pilots ? Math.round(board.reduce((sum, x) => sum + x.score, 0) / pilots) : 0;
  return { pilots, averageScore, board };
}

/**
 * Log a finished flight. The answers are scored again here, from the same
 * daily burns every pilot got, so the board can't be fed fake scores.
 * One flight per pilot per day: a second submit keeps the first score.
 */
export async function submitFlight(store, body, now = new Date()) {
  const { day, pilotKey, rounds } = body ?? {};
  checkDay(day, now);
  checkPilot(pilotKey);
  const flight = buildFlight(day);
  if (!Array.isArray(rounds) || rounds.length !== flight.rounds.length) throw new FleetError("Expected seven burns.");

  const results = flight.rounds.map((round, i) => {
    const sent = rounds[i];
    if (!sent || sent.id !== round.id) throw new FleetError(`Burn ${i + 1} does not match today's flight.`);
    const inputs = Array.isArray(sent.inputs) ? sent.inputs : [];
    if (inputs.length > 120 || inputs.some((x) => typeof x !== "string" || x.length > 80)) throw new FleetError("Too many answers.");
    return scoreRound(round, inputs);
  });
  const { score } = finishFlight(day, flight.number, results);

  const key = `${day}/${pilotKey}`;
  const existing = await store.get(key, { type: "json" });
  const saved = existing ?? { score, at: now.toISOString() };
  if (!existing) await store.setJSON(key, saved);
  const fleet = await readFleet(store, day, pilotKey, now);
  // Some stores take a moment before a new entry shows up in list(): make sure
  // the pilot always sees their own score on the board they get back.
  if (!fleet.board.some((x) => x.yours)) {
    fleet.board = [...fleet.board, { score: saved.score, yours: true }].sort((a, b) => b.score - a.score);
    fleet.pilots += 1;
    fleet.averageScore = Math.round(fleet.board.reduce((sum, x) => sum + x.score, 0) / fleet.pilots);
  }
  return fleet;
}
