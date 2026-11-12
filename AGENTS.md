# AGENTS.md — shared rules for every AI assistant

This file is the single source of truth for how AI coding assistants (Claude Code, Grok, or any other)
work in this repo. Both maintainers use it. If a rule here conflicts with an assistant's defaults, this
file wins. Agree changes to these rules with each other before pushing them.

## Project

- **Fuelup**: a daily trivia game. Seven timed "burns" per UTC day; rarer answers score more and fly the
  rocket higher. 1,000 points reaches the Moon. Rebuilt from Eeli's Grok demo.
- **Stack: plain HTML, CSS and JavaScript (ES modules). No framework, no build step.**
  `index.html` loads `src/ui/app.js` directly. The only npm dependency is `@netlify/blobs`, used by the
  fleet board server (`netlify/functions/fleet.mjs`), never by the page. Don't add a framework, bundler
  or other packages without agreeing it together first.
- Live site deploys automatically from `main`.
- Run locally with any static server from the repo root, e.g. `python3 -m http.server 5173`, then open
  http://localhost:5173. (Opening `index.html` as a file won't work: browsers block modules from `file://`.)

## Structure

Keep to this layout so the two maintainers rarely edit the same files:

| Path | What lives there | Main owner |
|---|---|---|
| `questions/*.json` | **All questions and answers**, one file per topic (see `questions/README.md`) | _fill in_ |
| `src/game/data.js` | Loads the question files (add an import line for each new topic) | _fill in_ |
| `tools/question-bank.html` | Browse every question and answer by level (local only, blocked on the live site) | shared |
| `src/game/engine.js` | Rules: matching answers, scoring, daily flight, altitude | _fill in_ |
| `src/game/storage.js`, `sound.js`, `fleet.js` | Saved profile, sound effects, fleet board client | _fill in_ |
| `src/ui/` | Screens (`app.js`), altitude meter (`stage.js`), `styles.css` | _fill in_ |
| `src/server/fleet-core.js`, `netlify/functions/fleet.mjs` | Fleet board server (Netlify) | _fill in_ |
| `scripts/check.mjs` | Safety check, runs before every deploy | shared |
| `public/` | Art, pixel icons (pixelarticons, MIT), favicon, share image | shared |
| `docs/` | Design notes and decisions | shared |

### Game rules to keep intact

- `engine.js` must stay free of DOM code, so it can also run on a server to re-score flights.
- The daily flight is seeded from the date. Changing `buildFlight`, the order of rounds in `data.js`, or
  the random picker changes everyone's flight for that day — do it deliberately.
- `engine.js` validates `data.js` on load (duplicate answers, missing gem, etc.). If the page goes blank
  after editing questions, check the browser console.
- Rarity levels, most common to rarest, with the same points in every burn:
  `sky` Sky (Common, 10) · `orbit` Orbit (Uncommon, 25) · `deepspace` Deep Space (Rare, 50) ·
  `nebula` Nebula (Very rare, 75) · `galaxy` Galaxy (Ultra rare, 100). Defined in `LEVELS` in `engine.js`.
- Galaxy is the top answer: exactly one per round (two at most), and it must be the round's `gem`.
  `engine.js` refuses to load data that breaks this. Keep it very hard to find.
- A flight is 7 burns: 2 "name as many" lists, 3 "one answer", 1 "closest number" and 1 "guess the
  year" (`YEAR_ROUNDS` in `data.js`). Lists cap at 250. A perfect flight is 1,000 points.
- **Altitude is points.** 1 point = 1 step, 1,000 = the Moon, a named stage every 200 (`STAGES`).
  Don't reintroduce kilometres or curved scales.
- **Questions live in `questions/`, never in code.** One JSON file per topic, answers one per line.
- **Adding answers:** write each chart from most to least well known, then run
  `node scripts/retier.mjs --write`. It sets the levels from that order: about 35% Sky (never more than
  20), then Orbit, Deep Space, and only the obscure tail is Nebula. Galaxy is only the gem. High points
  must need an obscure answer.
- Prefer closed, checkable sets (every US president, every Greek letter) so a correct answer is never
  missing from the chart. Add common alternative names as aliases ("hairless cat" for Sphynx).
  Matching already ignores case, accents, spaces, plurals and category words like "cat" or "river".
- Every list and single round needs a `gem` that is one of its answers. Every year round needs a
  `year` (negative for BC) and an `aside` fact.

### Look and feel

- Pixel-art night theme. Square corners, pixel borders, the night sky behind everything.
- One accent color: Galaxy gold `#ffc83d`. The five rarity levels each have one color, used for that
  level everywhere (see `--lv-*` in `styles.css`). Don't bring back the old cream and copper.
- Fonts, all pixel: "Press Start 2P" for the logo and numbers; "Jersey 15" for anything big or bold
  (headings, questions, answer names, buttons); "Pixelify Sans" at regular weight for sentences.
  Never use bold Pixelify: it smears.
- Icons come from `public/icons` (pixelarticons). Add new ones there from the same set.
- Use plain words for burn types: "Name as many as you can", "One answer", "Closest number", "Guess the year".

Anyone can edit any folder. If you change the other person's area, mention it in the commit message.

## Git workflow

Both maintainers push straight to `main` — no pull requests or approvals needed. Every push to `main`
deploys the live site, so:

1. `git pull --rebase origin main` before starting and again right before pushing.
2. Make small commits that each leave the game working.
3. `git push origin main`. If the push is rejected, pull with `--rebase`, fix any conflicts, and push again.
4. Never force-push (`--force`) — GitHub blocks it on `main` anyway, because it would erase the other
   person's work.
5. For a big or risky change, use a branch (`daniel/<topic>` or `eeli/<topic>`) and merge it when ready.

Commit messages: short imperative summary line, e.g. `Add jump physics`, `Fix score reset on restart`.

## Secrets

- Never commit API keys, tokens, passwords or `.env` files. `.gitignore` blocks them; don't override it.
- Add new variable **names** (no values) to `.env.example`.
- Real values go in the hosting dashboard's environment variables and in each person's local `.env`.
- If a secret is ever committed, rotate it immediately. Deleting the commit isn't enough.

## Code style

- Readable over clever. Small functions, descriptive names.
- No new dependency without saying why in the commit message.
- Don't reformat or rename code outside the task: it causes merge conflicts for the other person.
- Keep the game playable on phones and desktops.

## Before pushing to main

- Run the safety check: `node scripts/check.mjs`. Netlify runs it too and **won't deploy** if it fails
  (the live site keeps the last working version). GitHub shows a ✓ or ✗ on every push.
- The game runs locally without console errors.
- You pulled the latest `main` first.

## For AI assistants specifically

- Read this file at the start of each session.
- Commit and push to `main` only when your human asks. Never force-push or rewrite history.
- Don't edit files outside the task's scope.
- When a decision affects both maintainers (stack, structure, dependencies), tell your human so they
  can agree it with the other maintainer first.
