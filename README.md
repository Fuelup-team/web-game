# Fuelup

A daily trivia game. Seven timed burns, the same for every pilot on a UTC day. The obvious answer still
lifts; the rare one goes farther. A perfect flight, 1,000 points, meets the Moon.

- **Rules for humans and AI assistants:** [AGENTS.md](AGENTS.md)
- **One-time setup (GitHub, hosting):** [SETUP.md](SETUP.md)

## Run it locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173. No install or build step needed.

## Scoring

Every answer has a rarity level. Same points in every burn:

| Level | Rarity | Points |
|---|---|---|
| Sky | Common | 10 |
| Orbit | Uncommon | 25 |
| Deep Space | Rare | 50 |
| Nebula | Very rare | 75 |
| Galaxy | Ultra rare | 100 |

Each burn has exactly **one** Galaxy answer (the hardest one, with a fun fact). Finding it sets off a
special top-answer effect.

## Burn types

- **Single burn** (4 per flight): one answer. Retry until one locks. Up to 100.
- **Stack** (2 per flight): name as many as you can (elements, dog breeds…). Each answer adds its
  points, up to 250.
- **Gauge** (1 per flight): name the thing whose number is closest to a target (mountain height, river
  length…). Galaxy only for the single closest answer on the chart; then Nebula within 7%, Deep Space
  16%, Orbit 35%, Sky 90%, otherwise Off course (5).

Perfect flight: 4 × 100 + 100 + 2 × 250 = 1,000.

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
