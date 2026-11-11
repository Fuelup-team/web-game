# Fuelup

A daily trivia game. Seven timed burns, the same for every pilot on a UTC day. The obvious answer still
lifts; the rare one goes farther. A perfect flight, 820 points, meets the Moon.

- **Rules for humans and AI assistants:** [AGENTS.md](AGENTS.md)
- **One-time setup (GitHub, hosting):** [SETUP.md](SETUP.md)

## Run it locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173. No install or build step needed.

## Burn types

- **Stack**: name as many as you can (elements, dog breeds, Shakespeare plays…). Capped at 160.
- **Single burn**: one answer. Retry until one locks. Rarer answers score up to 100.
- **Gauge**: name the thing whose number is closest to a target (mountain height, river length…).

Questions and answers live in [src/game/data.js](src/game/data.js).

## Not done yet

- **Fleet board** (today's average and the list of pilots). The demo stored scores on Grok's
  server. This version needs its own small backend; see [src/game/fleet.js](src/game/fleet.js)
  for the API it expects. Until then the game runs fine without it.

## Daily workflow

Both of us push straight to `main`. Every push deploys the live site.

```bash
git pull --rebase origin main
# ...make changes...
git add -A && git commit -m "Short description"
git pull --rebase origin main
git push origin main
```
