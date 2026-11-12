// Re-level every answer chart in src/game/data.js from its order.
//
// Each chart is written from most to least well known. This script gives:
//   Sky (Common)       the first ~35% of answers, never more than 20
//   Orbit (Uncommon)   the next 40% of the rest
//   Deep Space (Rare)  the next 35% of the rest
//   Nebula (Very rare) the obscure tail
//   Galaxy             only the round's gem (its one top answer)
// So high points always need an obscure answer.
//
// The current levels count as the starting order (answers already sorted by
// level stay in that order), so you can also move an answer up or down by
// hand and run this to even things out.
//
// Usage:  node scripts/retier.mjs           (shows what would change)
//         node scripts/retier.mjs --write   (updates data.js)
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "src/game/data.js");
const data = await import(pathToFileURL(file).href);
const write = process.argv.includes("--write");

const RANK = { sky: 1, orbit: 2, deepspace: 3, nebula: 4, galaxy: 5 };
const SKY_MAX = 20;

/** New level for each answer name in one chart. */
function levelsFor(answers, gem) {
  const others = answers
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.name !== gem)
    .sort((x, y) => RANK[x.a.tier] - RANK[y.a.tier] || x.i - y.i);
  const n = others.length;
  const sky = Math.max(1, Math.min(SKY_MAX, Math.round(n * 0.35)));
  const rest = n - sky;
  const orbit = Math.round(rest * 0.4);
  const deep = Math.round(rest * 0.35);
  const out = new Map([[gem, "galaxy"]]);
  others.forEach(({ a }, k) => {
    out.set(a.name, k < sky ? "sky" : k < sky + orbit ? "orbit" : k < sky + orbit + deep ? "deepspace" : "nebula");
  });
  return out;
}

// Find each chart's gem (charts shared by two rounds must agree).
const named = Object.entries(data).filter(([, v]) => Array.isArray(v) && v[0]?.tier);
const nameOf = new Map(named.map(([k, v]) => [v, k]));
const charts = new Map(); // answers array -> { label, gem }
for (const round of [...data.LIST_ROUNDS, ...data.SINGLE_ROUNDS]) {
  const prev = charts.get(round.answers);
  if (prev && prev.gem !== round.gem) throw new Error(`${round.id}: shares answers with a round that has a different gem`);
  charts.set(round.answers, { label: nameOf.get(round.answers) ?? null, roundId: round.id, gem: round.gem });
}

let source = readFileSync(file, "utf8");
let changed = 0;

/** Rewrite the levels inside source[start, end). */
function rewrite(start, end, levels) {
  const before = source.slice(start, end);
  const after = before.replace(/answer\(\s*"([^"]+)",\s*"(\w+)"/g, (m, name, tier) => {
    const next = levels.get(name);
    if (!next || next === tier) return m;
    changed++;
    return m.replace(`"${tier}"`, `"${next}"`);
  });
  source = source.slice(0, start) + after + source.slice(end);
}

for (const [answers, chart] of charts) {
  const levels = levelsFor(answers, chart.gem);
  let start;
  let end;
  if (chart.label) {
    start = source.indexOf(`export const ${chart.label} = [`);
    end = source.indexOf("\n];", start);
  } else {
    const at = source.indexOf(`id: "${chart.roundId}"`);
    start = source.indexOf("answers: [", at);
    end = source.indexOf("\n    ],", start);
  }
  if (start < 0 || end < 0) throw new Error(`Couldn't find the answers for ${chart.label ?? chart.roundId}`);
  rewrite(start, end, levels);

  const counts = {};
  for (const t of levels.values()) counts[t] = (counts[t] ?? 0) + 1;
  console.log(`${(chart.label ?? chart.roundId).padEnd(18)} ${String(answers.length).padStart(3)} answers  sky ${counts.sky ?? 0}, orbit ${counts.orbit ?? 0}, deep space ${counts.deepspace ?? 0}, nebula ${counts.nebula ?? 0}, galaxy ${counts.galaxy ?? 0}`);
}

console.log(`\n${changed} answers ${write ? "re-levelled" : "would change"}.`);
if (write) writeFileSync(file, source);
else console.log("Run with --write to save.");
