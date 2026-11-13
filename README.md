# Fuelup

**Play it:** https://fuelup.daniel-kaltio.workers.dev (hosted on Cloudflare).

A daily trivia game. Seven timed burns, the same for every pilot on a UTC day. The obvious answer still
lifts; the rare one goes farther. A perfect flight, 1,000 points, meets the Moon.

- **Rules for humans and AI assistants:** [AGENTS.md](AGENTS.md)
- **One-time setup (GitHub, hosting):** [SETUP.md](SETUP.md)

## Run it locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173. No install or build step needed. (The fleet board only works on
Cloudflare; locally it shows as "Live on the real site".)

## Before you push

```bash
node scripts/check.mjs
```

The same safety check runs on Cloudflare before every deploy. If it fails, nothing goes live.

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

- **One answer** (3 per flight): retry until one locks. Up to 100.
- **Guess the year** (1 per flight): exact year is Galaxy, then within 2, 5, 15 and 40 years.
- **Name as many as you can** (2 per flight): name as many as you can (elements, dog breeds…). Each answer adds its
  points, up to 250.
- **Closest number** (1 per flight): name the thing whose number is closest to a target (mountain height, river
  length…). Galaxy only for the single closest answer on the chart; then Nebula within 7%, Deep Space
  16%, Orbit 35%, Sky 90%, otherwise Off course (5).

Perfect flight: 3 × 100 + 100 + 100 + 2 × 250 = 1,000. Your points are your altitude: 1,000 lands on
the Moon, with a named stage every 200 points.

Questions and answers live in [questions/](questions/), one JSON file per topic.

## Theme packs

Below the daily flight is a **Theme packs** shelf. A pack is one subject you can replay as often as you
like, with its own look and its own words. Packs don't count toward the fleet board.

- **Sports** (stadium at night): NBA and NHL teams, martial arts, World Cup hosts and winners, Olympic
  hosts, hockey world champions, the Ryder Cup, Wimbledon, sports years and **picture questions**.
  Levels are Bench, Starter, All-Star, MVP and Hall of Fame; a run is a season, from Preseason to
  Champions at 1,000 points.
- **History** (a dig site at night): Roman emperors, English and British monarchs, Soviet republics, US
  presidents, Henry VIII's wives, the Seven Wonders, 21 dates and 13 picture questions. Finds are
  Shard, Coin, Scroll, Crown and Lost Treasure, and your score digs back through time, from Present
  day to the Dawn of history at 1,000 points.
- **Picture questions** show a photo and ask who, where or when (one to three of them). Each part
  scores on its own, with partial credit: the right city instead of the stadium is half, a near year
  still scores. Photos are public domain or Creative Commons, credited under each picture.

To add a pack, see the top of [src/game/packs.js](src/game/packs.js).

## Fleet board

Today's average and the list of pilots come from a small Cloudflare Worker
([worker/index.js](worker/index.js)) that stores scores in Workers KV.
It re-scores every flight itself, keeps only the day, a random pilot id and the score, and allows one
flight per pilot per day.

## Daily workflow

Both of us push straight to `main`. Every push deploys the live site.

```bash
git pull --rebase origin main
# ...make changes...
git add -A && git commit -m "Short description"
git pull --rebase origin main
git push origin main
```
