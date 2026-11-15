// Safety check: run before every deploy (Cloudflare) and on every push (GitHub).
// If anything here fails, the deploy stops and the live site keeps the last
// working version.
//
// Run it yourself before pushing:
//   node scripts/check.mjs
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;

function check(label, fn) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
  } catch (err) {
    failures++;
    console.log(`  ✗ ${label}\n      ${String(err?.message ?? err).split("\n").join("\n      ")}`);
  }
}

function filesUnder(dir, ext) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : filesUnder(path, ext);
    return path.endsWith(ext) ? [path] : [];
  });
}

console.log("Fuelup safety check\n");

// 1. Every JavaScript file has valid syntax.
console.log("JavaScript syntax");
for (const file of [...filesUnder(join(root, "src"), ".js"), ...filesUnder(join(root, "worker"), ".js"), ...filesUnder(join(root, "scripts"), ".mjs")]) {
  check(file.slice(root.length + 1), () => {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  });
}

// 2. Every question file is valid and connected to the game.
console.log("\nQuestion files");
const questionFiles = filesUnder(join(root, "questions"), ".json").map((f) => f.slice(join(root, "questions").length + 1));
check("every questions/**/*.json file is valid JSON", () => {
  for (const f of questionFiles) {
    try {
      JSON.parse(readFileSync(join(root, "questions", f), "utf8"));
    } catch (err) {
      throw new Error(`${f}: ${err.message}`);
    }
  }
});
check("every question file is imported in src/game/data.js or src/game/packs.js", () => {
  const loaders = ["src/game/data.js", "src/game/packs.js"].map((f) => readFileSync(join(root, f), "utf8")).join("\n");
  const missing = questionFiles.filter((f) => !loaders.includes(`questions/${f}"`));
  if (missing.length) throw new Error(`not imported: ${missing.join(", ")}`);
});

// 3. Questions load and pass the engine's own data rules (one Galaxy per burn, etc.).
console.log("\nQuestions and rules");
let engine;
let data;
try {
  data = await import(pathToFileURL(join(root, "src/game/data.js")).href);
  engine = await import(pathToFileURL(join(root, "src/game/engine.js")).href);
  console.log("  ✓ data.js and engine.js load, data rules pass");
  check("every topic in CHART_FILES is filled in", () => {
    const empty = [...data.CHART_FILES.keys()].filter((i) => !data.CHART_FILES[i]?.answers);
    if (empty.length) throw new Error(`empty slots at positions ${empty.join(", ")} (a doubled comma?)`);
  });
} catch (err) {
  failures++;
  console.log(`  ✗ data.js / engine.js failed to load\n      ${err.message}`);
}

if (engine) {
  // 3. A full year of daily flights builds and scores without errors.
  check("365 daily flights build and score", () => {
    const start = Date.UTC(2026, 0, 1);
    for (let d = 0; d < 365; d++) {
      const day = new Date(start + d * 864e5).toISOString().slice(0, 10);
      const flight = engine.buildFlight(day);
      if (flight.rounds.length !== 7) throw new Error(`${day}: ${flight.rounds.length} burns, expected 7`);
      const results = flight.rounds.map((r) => engine.scoreRound(r, []));
      const done = engine.finishFlight(day, flight.number, results);
      if (done.score !== 0) throw new Error(`${day}: empty flight scored ${done.score}`);
    }
  });

  // 4. The top answer of every burn really scores top points.
  check("every burn's top answer scores the maximum", () => {
    const rounds = [...data.LIST_ROUNDS, ...data.SINGLE_ROUNDS, ...(data.YEAR_ROUNDS ?? [])];
    for (const round of rounds) {
      const answer = round.kind === "year" ? engine.formatYear(round.year) : round.gem;
      const r = engine.tryAnswer(round, answer, []);
      if (!r.ok || r.hit.tier !== engine.TOP_LEVEL) throw new Error(`${round.id}: "${answer}" did not score ${engine.TOP_LEVEL}`);
    }
  });

  // 5. Every listed name and alias finds its own answer (no matching rule steals it).
  check("every answer and alias matches itself", () => {
    const bad = [];
    for (const round of [...data.LIST_ROUNDS, ...data.SINGLE_ROUNDS]) {
      for (const a of round.answers) {
        for (const spelling of [a.name, ...(a.aliases ?? [])]) {
          const m = engine.matchAnswer(round.answers, spelling);
          if (m?.canonical !== a.name) bad.push(`${round.id}: "${spelling}" -> ${m?.canonical ?? "nothing"}`);
        }
      }
    }
    if (bad.length) throw new Error(bad.slice(0, 8).join("\n"));
  });

  // 5b. Year bands: wider for older events, always growing from level to level.
  check("year bands grow with age and from level to level", () => {
    let last = 0;
    for (const year of [2026, 2020, 1998, 1969, 1900, 1616, 1326, 1000, 1, -44, -753, -3000]) {
      const widths = engine.yearBands(year).map((b) => b.within);
      if (widths.some((w, i) => i && w <= widths[i - 1])) throw new Error(`${year}: bands don't grow: ${widths}`);
      if (widths[1] < last) throw new Error(`${year}: older event got a tighter scale`);
      last = widths[1];
    }
    if (engine.yearScore(1948, 1998).tier !== "drift") throw new Error("50 years off Google should score nothing special");
    if (!["deepspace", "nebula"].includes(engine.yearScore(1376, 1326).tier)) throw new Error("50 years off a 700-year-old event should still score well");
  });

  // 6. A perfect flight is exactly the advertised maximum.
  check(`a perfect flight scores ${engine.PERFECT_SCORE}`, () => {
    for (const day of ["2026-01-01", "2026-06-15", "2026-11-12"]) {
      const flight = engine.buildFlight(day);
      const results = flight.rounds.map((round) => {
        if (round.kind === "closest") return engine.scoreRound(round, [engine.topAnswers(round).answers[0].name]);
        if (round.kind === "year") return engine.scoreRound(round, [String(round.year)]);
        if (round.kind === "rare") return engine.scoreRound(round, [round.gem]);
        return engine.scoreRound(round, round.answers.map((a) => a.name));
      });
      const { score } = engine.finishFlight(day, 1, results);
      if (score !== engine.PERFECT_SCORE) throw new Error(`${day}: perfect flight scored ${score}`);
    }
  });
}

// 7. Theme packs: every round's top answer works, and a perfect run is 1,000.
let packs;
try {
  packs = await import(pathToFileURL(join(root, "src/game/packs.js")).href);
} catch (err) {
  failures++;
  console.log(`  ✗ packs.js failed to load\n      ${err.message}`);
}
if (engine && packs) {
  console.log("\nTheme packs");
  const perfectInputs = (round) =>
    round.kind === "picture" ? round.parts.map(engine.partAnswer)
      : round.kind === "year" ? [String(round.year)]
        : round.kind === "rare" ? [round.gem]
          : round.answers.map((a) => a.name);
  for (const pack of packs.PACKS) {
    check(`${pack.name}: every answer and alias matches itself`, () => {
      const bad = [];
      for (const round of [...pack.lists, ...pack.singles]) {
        for (const a of round.answers) {
          for (const spelling of [a.name, ...(a.aliases ?? [])]) {
            const m = engine.matchAnswer(round.answers, spelling);
            if (m?.canonical !== a.name) bad.push(`${round.id}: "${spelling}" -> ${m?.canonical ?? "nothing"}`);
          }
        }
      }
      for (const round of pack.pictures) {
        round.parts.forEach((part, i) => {
          for (const a of part.answers ?? []) {
            for (const spelling of [a.name, ...(a.aliases ?? [])]) {
              const r = engine.scorePicturePart(round, i, spelling);
              if (r.canonical !== a.name) bad.push(`${round.id}: "${spelling}" -> ${r.canonical ?? "nothing"}`);
            }
          }
        });
      }
      if (bad.length) throw new Error(bad.slice(0, 8).join("\n"));
    });
    check(`${pack.name}: every top answer scores the maximum`, () => {
      for (const round of [...pack.lists, ...pack.singles, ...pack.years, ...pack.pictures]) {
        const r = engine.scoreRound(round, perfectInputs(round));
        const best = round.kind === "list" ? r.hits.some((h) => h.tier === engine.TOP_LEVEL) : r.points === 100;
        if (!best) throw new Error(`${round.id}: the top answer did not score the maximum`);
      }
    });
    check(`${pack.name}: 300 runs build, and a perfect run scores ${engine.PERFECT_SCORE}`, () => {
      for (let i = 0; i < 300; i++) {
        const run = engine.buildPackFlight(pack.id, `check-${i}`);
        if (run.rounds.length !== 7) throw new Error(`${run.rounds.length} burns, expected 7`);
        const empty = run.rounds.reduce((sum, r) => sum + engine.scoreRound(r, []).points, 0);
        if (empty !== 0) throw new Error(`an empty run scored ${empty}`);
        const perfect = run.rounds.reduce((sum, r) => sum + engine.scoreRound(r, perfectInputs(r)).points, 0);
        if (perfect !== engine.PERFECT_SCORE) throw new Error(`a perfect run scored ${perfect}`);
      }
    });
    check(`${pack.name}: every picture exists and is credited`, () => {
      const missing = pack.pictures.filter((p) => !existsSync(join(root, "public", p.image))).map((p) => p.image);
      if (missing.length) throw new Error(`missing in public/: ${missing.join(", ")}`);
    });
    check(`${pack.name}: has words for its theme`, () => {
      const t = packs.THEMES[pack.theme];
      if (!t) throw new Error(`no THEMES entry for "${pack.theme}"`);
      for (const id of ["sky", "orbit", "deepspace", "nebula", "galaxy", "drift"]) if (!t.levels[id]) throw new Error(`no name for level ${id}`);
      for (const s of engine.STAGES) if (!t.stages[s.id]) throw new Error(`no name for stage ${s.id}`);
    });
  }
}

// 8. The fleet board server logic, against an in-memory stand-in for Workers KV.
console.log("\nFleet board");
try {
  const fleet = await import(pathToFileURL(join(root, "src/server/fleet-core.js")).href);
  const memory = new Map();
  const store = {
    list: async ({ prefix }) => ({ blobs: [...memory.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }),
    get: async (key) => memory.get(key) ?? null,
    setJSON: async (key, value) => void memory.set(key, value),
  };
  const now = new Date("2026-11-12T12:00:00Z");
  const day = "2026-11-12";
  const flight = engine.buildFlight(day);
  const perfect = flight.rounds.map((r) => ({
    id: r.id,
    inputs: r.kind === "closest" ? [engine.topAnswers(r).answers[0].name]
      : r.kind === "year" ? [engine.formatYear(r.year)]
      : r.kind === "rare" ? [r.gem] : r.answers.map((a) => a.name),
  }));
  const empty = flight.rounds.map((r) => ({ id: r.id, inputs: [] }));
  const a = "a".repeat(32), b = "b".repeat(32);
  let res = await fleet.submitFlight(store, { day, pilotKey: a, rounds: perfect }, now);
  check("a perfect flight is re-scored to 1000", () => { if (res.board[0].score !== 1000) throw new Error(JSON.stringify(res)); });
  res = await fleet.submitFlight(store, { day, pilotKey: b, rounds: empty }, now);
  check("average and board across two pilots", () => {
    if (res.pilots !== 2 || res.averageScore !== 500) throw new Error(JSON.stringify(res));
    if (!res.board.find((x) => x.yours && x.score === 0)) throw new Error("own score not marked");
  });
  res = await fleet.submitFlight(store, { day, pilotKey: b, rounds: perfect }, now);
  check("a second submit can't replace the first score", () => { if (res.averageScore !== 500) throw new Error(JSON.stringify(res)); });
  let oldRefused = false;
  try { await fleet.submitFlight(store, { day: "2026-01-01", pilotKey: a, rounds: perfect }, now); } catch { oldRefused = true; }
  check("an old day is refused", () => { if (!oldRefused) throw new Error("accepted an old day"); });
  let refused = false;
  try { await fleet.submitFlight(store, { day, pilotKey: "x", rounds: perfect }, now); } catch { refused = true; }
  check("a bad pilot id is refused", () => { if (!refused) throw new Error("accepted a bad pilot id"); });

  // Friends: answers are kept only with a friend code, and only shown to someone who has played.
  const c = "c".repeat(32), d = "d".repeat(32);
  await fleet.submitFlight(store, { day, pilotKey: c, rounds: perfect, friendCode: "K7QF2M", name: "Eeli" }, now);
  let friends = await fleet.readFriends(store, day, d, "K7QF2M,ABCDEF,bad!", now);
  check("a friend's score shows, but not their answers before you play", () => {
    const f = friends.friends.find((x) => x.code === "K7QF2M");
    if (!f?.played || f.score !== 1000 || f.name !== "Eeli" || f.rounds) throw new Error(JSON.stringify(friends));
    if (friends.friends.find((x) => x.code === "ABCDEF")?.played !== false) throw new Error("unknown code should be not played");
    if (friends.friends.some((x) => x.code === "BAD!")) throw new Error("bad code was not dropped");
  });
  await fleet.submitFlight(store, { day, pilotKey: d, rounds: empty }, now);
  friends = await fleet.readFriends(store, day, d, "K7QF2M", now);
  check("after you play, a friend's answers show and re-score to their score", () => {
    const f = friends.friends[0];
    if (!f.rounds || f.rounds.length !== 7) throw new Error(JSON.stringify(friends));
    const rescored = flight.rounds.reduce((sum, r, i) => sum + engine.scoreRound(r, f.rounds[i].inputs).points, 0);
    if (rescored !== f.score) throw new Error(`re-scored ${rescored}, saved ${f.score}`);
  });
  check("no friend code, no answers kept", () => {
    if ([...memory.keys()].some((k) => k.startsWith("friends/") && !k.endsWith("K7QF2M"))) throw new Error([...memory.keys()].join(", "));
  });
  check("the day's average estimate blends with real scores", () => {
    const est = engine.estimatedAverage(day);
    if (est < 340 || est > 460 || engine.blendedAverage(day, []) !== est) throw new Error(`estimate ${est}`);
    const many = Array(500).fill(900);
    if (engine.blendedAverage(day, many) < 880) throw new Error("real scores should take over");
  });
} catch (err) {
  failures++;
  console.log(`  ✗ fleet board logic failed\n      ${err.message}`);
}

// 9. Every file the page points at exists.
console.log("\nFiles");
check("index.html links point at real files", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  const local = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((p) => !/^(https?:|#|data:)/.test(p));
  const missing = local.filter((p) => !existsSync(join(root, p)));
  if (missing.length) throw new Error(`missing: ${missing.join(", ")}`);
});
check("private folders are never published", () => {
  const ignore = readFileSync(join(root, ".assetsignore"), "utf8").split("\n").map((l) => l.trim());
  const missing = ["tools", "scripts", "worker", "src/server", ".git"].filter((p) => !ignore.includes(p));
  if (missing.length) throw new Error(`.assetsignore must list: ${missing.join(", ")}`);
});
check("pictures and icons used in code exist", () => {
  const code = filesUnder(join(root, "src"), ".js").map((f) => readFileSync(f, "utf8")).join("\n");
  const assets = [...code.matchAll(/asset\("([^"`$]+)"\)/g)].map((m) => m[1]);
  const icons = [...code.matchAll(/icon\("([a-z0-9-]+)"\)/g)].map((m) => `icons/${m[1]}.svg`);
  const css = readFileSync(join(root, "src/ui/styles.css"), "utf8");
  const cssFiles = [...css.matchAll(/url\("\.\.\/\.\.\/public\/([^"]+)"\)/g)].map((m) => m[1]);
  const missing = [...new Set([...assets, ...icons, ...cssFiles])].filter((f) => !existsSync(join(root, "public", f)));
  if (missing.length) throw new Error(`missing in public/: ${missing.join(", ")}`);
});

console.log(failures ? `\n✗ ${failures} problem${failures === 1 ? "" : "s"} found. Not safe to deploy.\n` : "\n✓ All good. Safe to deploy.\n");
process.exit(failures ? 1 : 0);
