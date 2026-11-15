// Pilot profile saved in this browser: callsign, mute, streak and logged flights.
import { previousDay } from "./engine.js";

const KEY = "fuelup.v1";

function randomPilotKey() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A friend code: 6 letters and digits, no look-alikes (0/O, 1/I/L). */
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const FRIEND_CODE = /^[A-HJ-KM-NP-Z2-9]{6}$/;
function randomFriendCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

function freshProfile() {
  return {
    version: 1, pilotKey: randomPilotKey(), callsign: "", muted: false, streak: 0, lastDay: null, flights: {}, packs: {},
    friendCode: randomFriendCode(), shareWithFriends: false, friends: [],
  };
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
      friendCode: typeof p.friendCode === "string" && FRIEND_CODE.test(p.friendCode) ? p.friendCode : randomFriendCode(),
      shareWithFriends: !!p.shareWithFriends,
      friends: Array.isArray(p.friends)
        ? p.friends.filter((f) => f && FRIEND_CODE.test(f.code)).map((f) => ({ code: f.code, name: String(f.name ?? "").slice(0, 18) })).slice(0, 30)
        : [],
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

/** Add a friend by code (with an optional name), or rename one already added. */
export function addFriend(profile, code, name = "") {
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!FRIEND_CODE.test(clean)) return { profile, error: "A friend code is 6 letters and numbers, like K7QF2M." };
  if (clean === profile.friendCode) return { profile, error: "That's your own code. Send it to your friend instead." };
  const others = profile.friends.filter((f) => f.code !== clean);
  if (others.length >= 30) return { profile, error: "You can have up to 30 friends." };
  return { profile: { ...profile, friends: [...others, { code: clean, name: name.trim().slice(0, 18) }] } };
}

export function removeFriend(profile, code) {
  return { ...profile, friends: profile.friends.filter((f) => f.code !== code) };
}
