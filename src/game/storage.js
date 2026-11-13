// Pilot profile saved in this browser: callsign, mute, streak and logged flights.
import { previousDay } from "./engine.js";

const KEY = "fuelup.v1";

function randomPilotKey() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function freshProfile() {
  return { version: 1, pilotKey: randomPilotKey(), callsign: "", muted: false, streak: 0, lastDay: null, flights: {}, packs: {} };
}

/** Load the profile, or start a new one if nothing valid is stored. */
export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshProfile();
    const p = JSON.parse(raw);
    if (p.version !== 1 || typeof p.pilotKey !== "string" || !/^[a-f0-9]{32}$/.test(p.pilotKey)) return freshProfile();
    return {
      version: 1,
      pilotKey: p.pilotKey,
      callsign: typeof p.callsign === "string" ? p.callsign.slice(0, 18) : "",
      muted: !!p.muted,
      streak: typeof p.streak === "number" ? p.streak : 0,
      lastDay: typeof p.lastDay === "string" ? p.lastDay : null,
      flights: p.flights && typeof p.flights === "object" ? p.flights : {},
      packs: p.packs && typeof p.packs === "object" ? p.packs : {},
    };
  } catch {
    return freshProfile();
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Private mode or storage blocked: the game still works, it just won't remember.
  }
}

/** Record today's official flight and update the daily streak. */
export function logFlight(profile, flight) {
  const streak =
    profile.flights[flight.day] || profile.lastDay === flight.day
      ? profile.streak
      : profile.lastDay === previousDay(flight.day)
        ? profile.streak + 1
        : 1;
  return {
    ...profile,
    streak: Math.max(1, streak),
    lastDay: flight.day,
    flights: { ...profile.flights, [flight.day]: flight },
  };
}

/** Record a finished theme-pack run: best score, runs played, last score. */
export function logPackRun(profile, packId, score) {
  const before = profile.packs?.[packId] ?? { best: 0, played: 0, last: null };
  return {
    ...profile,
    packs: { ...profile.packs, [packId]: { best: Math.max(before.best, score), played: before.played + 1, last: score } },
  };
}
