// Re-level every answer chart in questions/*.json from its order.
//
// Each chart is written from most to least well known. This script gives:
//   Sky (Common)       the first ~35% of answers, never more than 20
//   Orbit (Uncommon)   the next 40% of the rest
//   Deep Space (Rare)  the next 35% of the rest
//   Nebula (Very rare) the obscure tail
//   Galaxy             only the chart's gem (its one top answer)
// So high points always need an obscure answer.
//
// The current levels count as the starting order (answers already sorted by
// level stay in that order), so you can also move an answer up or down by
// hand and run this to even things out.
//
// Usage:  node scripts/retier.mjs           (shows what would change)
//         node scripts/retier.mjs --write   (updates the files)
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "questions");
const write = process.argv.includes("--write");

const RANK = { sky: 1, orbit: 2, deepspace: 3, nebula: 4, galaxy: 5 };
const SKY_MAX = 20;

/** New level for each answer in one chart. */
export function levelsFor(answers, gem) {
  const others = answers
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.name !== gem)
    .sort((x, y) => RANK[x.a.level] - RANK[y.a.level] || x.i - y.i);
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

/** Chart file text: the header pretty-printed, then one answer per line. */
export function formatChart(chart) {
  const { answers, ...head } = chart;
  const lines = JSON.stringify(head, null, 2).split("\n");
  lines.pop();
  lines[lines.length - 1] += ",";
  lines.push('  "answers": [');
  answers.forEach((a, i) => {
    const obj = { name: a.name, level: a.level, ...(a.also?.length ? { also: a.also } : {}) };
    const line = JSON.stringify(obj).replace(/":/g, '": ').replace(/,"/g, ', "');
    lines.push(`    ${line}${i < answers.length - 1 ? "," : ""}`);
  });
  lines.push("  ]", "}", "");
  return lines.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let changed = 0;
  // Answer charts in questions/ and in each pack folder (questions/sports/...).
  // Years, gauges and pictures are not charts and are left alone.
  const NOT_CHARTS = ["years.json", "gauges.json", "pictures.json"];
  const chartsIn = (sub) =>
    readdirSync(join(dir, sub))
      .filter((f) => f.endsWith(".json") && !NOT_CHARTS.includes(f))
      .map((f) => (sub ? `${sub}/${f}` : f))
      .sort();
  const packs = readdirSync(dir).filter((f) => statSync(join(dir, f)).isDirectory()).sort();
  const files = [...chartsIn(""), ...packs.flatMap(chartsIn)];
  for (const file of files) {
    const path = join(dir, file);
    const chart = JSON.parse(readFileSync(path, "utf8"));
    const levels = levelsFor(chart.answers, chart.gem);
    const counts = {};
    for (const a of chart.answers) {
      const next = levels.get(a.name);
      if (next !== a.level) changed++;
      a.level = next;
      counts[next] = (counts[next] ?? 0) + 1;
    }
    if (write) writeFileSync(path, formatChart(chart));
    console.log(`${file.replace(".json", "").padEnd(28)} ${String(chart.answers.length).padStart(3)} answers  sky ${counts.sky ?? 0}, orbit ${counts.orbit ?? 0}, deep space ${counts.deepspace ?? 0}, nebula ${counts.nebula ?? 0}, galaxy ${counts.galaxy ?? 0}`);
  }
  console.log(`\n${changed} answers ${write ? "re-levelled" : "would change"}.`);
  if (!write) console.log("Run with --write to save.");
}
