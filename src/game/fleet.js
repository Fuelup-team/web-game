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

/**
 * Send a finished flight. With `friend` ({ code, name }) the answers are also
 * kept for friends who have this pilot's code.
 */
export async function submitFlight(day, pilotKey, rounds, friend = null) {
  if (!fleetEnabled) return null;
  const res = await fetch(FLEET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day, pilotKey, rounds, ...(friend ? { friendCode: friend.code, name: friend.name } : {}) }),
  });
  if (!res.ok) throw new Error(`Fleet ${res.status}`);
  return res.json();
}

/** Friends' flights for a day. Their answers come back only once you have played. */
export async function fetchFriends(day, pilotKey, codes) {
  if (!fleetEnabled || !codes.length) return null;
  const url = `/api/friends?day=${encodeURIComponent(day)}&pilotKey=${encodeURIComponent(pilotKey)}&codes=${codes.map(encodeURIComponent).join(",")}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Friends ${res.status}`);
  return res.json();
}
