// Derive the committed per-hour timeline + pressure-event register for the
// water-survival live proof (t_4e2c4d13) from the gitignored raw observation
// log and the harness report. Proof-only tooling; no game/host mutation.
// Usage: node scripts/water-survival-timeline.mjs [--out evidence/water-survival-live]
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
const arg = (flag, fallback) => { const i = process.argv.indexOf(flag); return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback; };
const outDir = resolve(arg("--out", "evidence/water-survival-live"));
const report = JSON.parse(readFileSync(join(outDir, "report.json"), "utf8"));
const obsLines = readFileSync(join(outDir, "raw/observations.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));

const hourly = [];
let lastKey = null;
for (const o of obsLines) {
  const k = Math.floor(o.hour);
  if (k === lastKey) continue;
  lastKey = k;
  hourly.push({ hour: k, tick: o.tick, isNight: o.isNight, hp: o.you.hp, hunger: o.you.hunger, thirst: o.you.thirst, energy: o.you.energy, x: o.you.x, z: o.you.z, inWater: o.you.inWater, drowning: o.you.drowning });
}

// First occurrence of each notable log line (nightfall, quiet window, drink,
// drowning, dehydration, hunger) with its vale-hour and tick.
const logEvents = [];
const seen = new Set();
for (const o of obsLines) {
  const lines = Array.isArray(o.logTail) ? o.logTail.map((x) => (typeof x === "string" ? x : x?.text ?? JSON.stringify(x))) : [];
  for (const line of lines) {
    if (!/night|quiet|daybreak|dawn|drink|drown|thirst|hungry|starv|water|shore/i.test(line)) continue;
    if (seen.has(line)) continue;
    seen.add(line);
    logEvents.push({ hour: o.hour, tick: o.tick, line });
  }
}

// First executed decision per trigger kind (from the committed compact rows).
const firstDecisionByTrigger = {};
for (const d of report.decisions ?? []) {
  for (const kind of d.triggers ?? []) {
    if (!firstDecisionByTrigger[kind]) firstDecisionByTrigger[kind] = { hour: d.hour, tick: d.tick, verb: d.verb, outcome: d.outcome };
  }
}

const w = report.waterExposure ?? {};
const wrapped = (h) => ((h % 24) + 24) % 24;
const inQuiet = (h) => { const x = wrapped(h); return x >= 22 || x < 6; };
const quietEntry = hourly.find((h) => inQuiet(h.hour));
const quietExit = hourly.find((h, i) => i > 0 && inQuiet(hourly[i - 1].hour) && !inQuiet(h.hour));
const criterion3 = {
  thirstLowTrigger: (report.triggerCounts?.["vitals.thirst_low"] ?? 0) > 0,
  drinkAck: (w.drinkAckedOk ?? 0) > 0,
  hungerLowTrigger: (report.triggerCounts?.["vitals.hunger_low"] ?? 0) > 0,
  eatAck: (w.eatAckedOk ?? 0) > 0,
  nightfall: hourly.some((h) => h.isNight),
  quietWindowEntry: quietEntry ? { hour: quietEntry.hour } : null,
  quietWindowExit: quietExit ? { hour: quietExit.hour } : (report.triggerCounts?.["world.daybreak"] ? { trigger: "world.daybreak" } : null),
  daybreakTrigger: (report.triggerCounts?.["world.daybreak"] ?? 0) > 0,
};
const timeline = {
  schema: "emberhall-water-live-timeline-v1",
  task: "t_4e2c4d13",
  revision: report.revision,
  seed: report.initialConditions?.seed,
  startHour: report.initialConditions?.startHour,
  simHours: report.duration?.simHours,
  hourly,
  logEvents,
  firstDecisionByTrigger,
  triggerCounts: report.triggerCounts,
  criterion3,
};
writeFileSync(join(outDir, "timeline.json"), JSON.stringify(timeline, null, 2));
console.log(JSON.stringify({ hourlyPoints: hourly.length, logEvents: logEvents.length, criterion3, notable: logEvents.slice(0, 25).map((e) => `${e.hour.toFixed(2)}h ${e.line}`) }, null, 1));
