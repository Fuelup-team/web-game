// Fuelup on Cloudflare: serves the game's files and the fleet board API.
//
//   GET  /api/fleet?day=YYYY-MM-DD&pilotKey=...   today's board
//   POST /api/fleet  { day, pilotKey, rounds: [{ id, inputs }] }  log a flight
//
// Everything else is a static file (see wrangler.jsonc and .assetsignore).
// Scores live in Workers KV (binding FLEET), one key per pilot per day,
// with the score also kept in the key's metadata so the board needs one list().
import { readFleet, submitFlight, FleetError } from "../src/server/fleet-core.js";

const DAY_SECONDS = 86400;

/** Workers KV wrapped in the small store interface fleet-core expects. */
function kvStore(kv) {
  return {
    async list({ prefix }) {
      const blobs = [];
      let cursor;
      do {
        const page = await kv.list({ prefix, cursor });
        for (const k of page.keys) blobs.push({ key: k.name, data: k.metadata ?? null });
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return { blobs };
    },
    get: (key) => kv.get(key, { type: "json" }),
    // Keep a month of boards, then let them expire.
    setJSON: (key, value) =>
      kv.put(key, JSON.stringify(value), { metadata: value, expirationTtl: 31 * DAY_SECONDS }),
  };
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function fleet(request, env) {
  const store = kvStore(env.FLEET);
  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      return json(await readFleet(store, url.searchParams.get("day"), url.searchParams.get("pilotKey")));
    }
    if (request.method === "POST") {
      const body = await request.json().catch(() => null);
      return json(await submitFlight(store, body));
    }
    return json({ error: "Use GET or POST." }, 405);
  } catch (err) {
    if (err instanceof FleetError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: "The fleet board is having trouble." }, 500);
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/fleet") return fleet(request, env);
    return env.ASSETS.fetch(request);
  },
};
