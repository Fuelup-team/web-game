// Fleet board: today's anonymous scores from every pilot.
//
// The Grok demo kept these on Grok's own server, which we can't copy. Until we
// add our own backend, FLEET_URL stays empty and the game runs without a board.
//
// To connect one, set FLEET_URL to an API with two endpoints:
//   GET  {FLEET_URL}?day=YYYY-MM-DD&pilotKey=...
//   POST {FLEET_URL}  body: { day, pilotKey, rounds: [{ id, inputs: [names] }] }
// Both return: { pilots, averageScore, board: [{ score, altitudeKm, yours }] }
// The server should re-score `rounds` itself (engine.js runs in Node too) so
// nobody can post a fake score.

export const FLEET_URL = "";

/** True when a fleet backend is configured. */
export const fleetEnabled = Boolean(FLEET_URL);

export async function fetchFleet(day, pilotKey) {
  if (!fleetEnabled) return null;
  const url = `${FLEET_URL}?day=${encodeURIComponent(day)}&pilotKey=${encodeURIComponent(pilotKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fleet ${res.status}`);
  return res.json();
}

export async function submitFlight(day, pilotKey, rounds) {
  if (!fleetEnabled) return null;
  const res = await fetch(FLEET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day, pilotKey, rounds }),
  });
  if (!res.ok) throw new Error(`Fleet ${res.status}`);
  return res.json();
}
