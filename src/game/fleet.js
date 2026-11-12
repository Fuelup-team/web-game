// Fleet board: today's anonymous scores from every pilot.
// Talks to the Cloudflare Worker at /api/fleet (worker/index.js).
// When running locally with a plain static server there is no API, so the
// board is switched off on localhost.

export const FLEET_URL = "/api/fleet";

/** True where the fleet API exists (the live site on Cloudflare). */
export const fleetEnabled =
  typeof location !== "undefined" && !["localhost", "127.0.0.1", ""].includes(location.hostname);

export async function fetchFleet(day, pilotKey) {
  if (!fleetEnabled) return null;
  const url = `${FLEET_URL}?day=${encodeURIComponent(day)}&pilotKey=${encodeURIComponent(pilotKey)}`;
  const res = await fetch(url, { cache: "no-store" });
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
