// Fleet board API on Netlify: today's anonymous scores from every pilot.
//   GET  /api/fleet?day=YYYY-MM-DD&pilotKey=...   → today's board
//   POST /api/fleet  { day, pilotKey, rounds: [{ id, inputs }] }  → log a flight, get the board
// Scores live in Netlify Blobs (store "fleet"). Logic: src/server/fleet-core.js
import { getStore } from "@netlify/blobs";
import { readFleet, submitFlight, FleetError } from "../../src/server/fleet-core.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export default async (req) => {
  const store = getStore({ name: "fleet", consistency: "strong" });
  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      return json(await readFleet(store, url.searchParams.get("day"), url.searchParams.get("pilotKey")));
    }
    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      return json(await submitFlight(store, body));
    }
    return json({ error: "Use GET or POST." }, 405);
  } catch (err) {
    if (err instanceof FleetError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: "The fleet board is having trouble." }, 500);
  }
};

export const config = { path: "/api/fleet" };
