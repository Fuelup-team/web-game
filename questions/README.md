# Questions

Every question in Fuelup lives in this folder. You can edit these files directly.

- **`<topic>.json`**: one topic, for example `europe-countries.json`. It holds:
  - `topic`: a short name shown in the question bank
  - `gem`: the one Galaxy answer (the hardest, worth 100)
  - `rounds`: the questions that use this topic. `"kind": "list"` is "Name as many as you can",
    `"kind": "rare"` is "One answer". Each has a `prompt`, a short hint (`blurb`), a time limit in
    `seconds`, and a `fact` shown after the burn.
  - `answers`: every accepted answer, **from most to least well known**, one per line.
    `also` lists other names that count, for example `"also": ["hairless cat"]`.
- **`years.json`**: "Guess the year" questions. Use a negative year for BC (`-44` is 44 BC).
- **`gauges.json`**: "Closest number" charts (mountains, rivers and so on).
- **`<pack>/`**, for example `sports/`: a theme pack's own charts (same format as above), its
  `years.json`, and `pictures.json`. Pack files are loaded in `src/game/packs.js`, not `data.js`.

## Picture questions (`<pack>/pictures.json`)

```json
{
  "id": "sp-pic-owens",
  "image": "pictures/owens-1936.jpg",
  "prompt": "Who is this long jumper, in which city, and when?",
  "credit": {"author": "US National Archives", "license": "Public domain", "source": "https://commons.wikimedia.org/wiki/File:..."},
  "parts": [
    {"ask": "who", "label": "Who?", "answers": [{"name": "Jesse Owens", "level": "galaxy", "also": ["Owens"]}]},
    {"ask": "where", "label": "Which city?", "answers": [{"name": "Berlin", "level": "galaxy"}, {"name": "Germany", "level": "deepspace"}]},
    {"ask": "when", "label": "Which year?", "year": 1936}
  ],
  "fact": "At the 1936 Berlin Olympics Owens won four golds."
}
```

- 1 to 3 parts. Each is an equal share of 100. `galaxy` is the full share, `nebula` 75%, `deepspace`
  half, `orbit` a quarter. Give each `who`/`where` part exactly one `galaxy` answer.
- Put the photo in `public/pictures/` (about 900 px wide). Use only public domain or Creative Commons
  photos (Wikimedia Commons is the easiest place), and fill in the credit.

## Adding or changing answers

1. Edit the file. Keep the answers in order from most to least well known.
2. Run `node scripts/retier.mjs --write`. It sets every level from the order: about 35% Sky (never more
   than 20), then Orbit, Deep Space, and only the obscure tail is Nebula. Galaxy is only the `gem`.
3. Run `node scripts/check.mjs`. It catches typos, duplicate answers and broken files.

## Adding a new topic

1. Copy an existing topic file and give it a new name.
2. Add an import line for it in `src/game/data.js` and add it to `CHART_FILES` there (or, for a pack,
   in `src/game/packs.js` and the pack's file list).
3. Run the two commands above.

## Seeing everything

Run `python3 -m http.server 5173` in the repo folder and open
http://localhost:5173/tools/question-bank.html. It shows every question and answer by level, with a
search box. It's blocked on the live site so players can't use it to cheat.

Prefer closed, checkable sets (every US president, every Greek letter) so a correct answer is never
missing from the chart.
