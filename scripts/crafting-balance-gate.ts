#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MAP } from "../src/game/atlas.ts";
import { ITEM_FORM_CATALOG, MATERIAL_GRADES, GEM_CLARITIES } from "../src/game/crafting/forms.ts";
import { resolveItemStats } from "../src/game/crafting/resolve.ts";
import type { CraftedComponent, GemInlay, ItemFormDefinition, Workmanship } from "../src/game/crafting/types.ts";
import { RESOURCE_CATALOG, RESOURCE_IDS } from "../src/game/resources/catalog.ts";
import { resolveResourceNode, type ResourceNodeKind } from "../src/game/resources/nodes.ts";
import { successChance } from "../src/game/skills.ts";
import { createCraftedItem, rareName, workmanshipChances } from "../src/game/rare.ts";
import { createWorld } from "../src/game/world.ts";
import { writeSave, SAVE_KEY } from "../src/game/save.ts";
import { encodeRareInscription } from "../src/game/vault.ts";

const OUT_DIR = resolve("reports");
mkdirSync(OUT_DIR, { recursive: true });
const WORK_BEAT_SECONDS = 0.72;
const SURVEY_SECONDS_PER_NODE = 1.5;
const WORKMANSHIPS: readonly Workmanship[] = ["ordinary", "fine", "exceptional"];

class MemoryStorage {
  #values = new Map<string, string>();
  getItem(key: string): string | null { return this.#values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.#values.set(key, value); }
  removeItem(key: string): void { this.#values.delete(key); }
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]!;
}

function selectorAllows(selector: ItemFormDefinition["roles"][number]["accepts"], resourceId: string, form: string, grade: string): boolean {
  const def = RESOURCE_CATALOG[resourceId as keyof typeof RESOURCE_CATALOG];
  if (!def || def.qualityType !== selector.qualityType) return false;
  if (selector.resourceIds && !selector.resourceIds.includes(resourceId as never)) return false;
  if (selector.kinds && !selector.kinds.includes(def.kind as never)) return false;
  if (selector.forms && !selector.forms.includes(form as never)) return false;
  if (selector.qualities && !selector.qualities.includes(grade as never)) return false;
  return true;
}

function roleOptions(form: ItemFormDefinition): CraftedComponent[][] {
  return form.roles.map((role) => {
    const options: CraftedComponent[] = [];
    for (const resourceId of RESOURCE_IDS) {
      const def = RESOURCE_CATALOG[resourceId];
      if (def.qualityType !== "grade") continue;
      for (const resourceForm of def.forms) {
        for (const grade of MATERIAL_GRADES) {
          if (!selectorAllows(role.accepts, resourceId, resourceForm, grade)) continue;
          options.push({ role: role.role, resourceId, form: resourceForm, grade, amount: role.amount } as CraftedComponent);
        }
      }
    }
    return options;
  });
}

function cartesian<T>(sets: readonly T[][]): T[][] {
  return sets.reduce<T[][]>((rows, set) => rows.flatMap((row) => set.map((value) => [...row, value])), [[]]);
}

function legalInlays(form: ItemFormDefinition): Array<readonly GemInlay[]> {
  const rows: Array<readonly GemInlay[]> = [[]];
  if (form.maxInlays < 1) return rows;
  for (const resourceId of ["ruby", "sapphire"] as const) {
    const family = RESOURCE_CATALOG[resourceId].traitIds[0];
    if (!form.allowedGemFamilies.includes(family as never)) continue;
    for (const clarity of GEM_CLARITIES) rows.push([{ resourceId, clarity }]);
  }
  return rows;
}

function enumerateStats() {
  const forms: Record<string, unknown> = {};
  let legalCombinationCount = 0;
  for (const form of Object.values(ITEM_FORM_CATALOG)) {
    const componentSets = cartesian(roleOptions(form));
    const inlays = legalInlays(form);
    const maxima = { damage: 0, hitBonus: 0, armor: 0, fortune: 0 };
    let combinations = 0;
    let capViolations = 0;
    for (const components of componentSets) {
      for (const workmanship of WORKMANSHIPS) {
        for (const gemSet of inlays) {
          const result = resolveItemStats(form, { workmanship, components, inlays: gemSet });
          combinations += 1;
          maxima.damage = Math.max(maxima.damage, result.stats.damage);
          maxima.hitBonus = Math.max(maxima.hitBonus, result.stats.hitBonus);
          maxima.armor = Math.max(maxima.armor, result.stats.armor);
          maxima.fortune = Math.max(maxima.fortune, result.local.fortune);
          if (result.stats.damage > form.caps.damage || result.stats.hitBonus > form.caps.hitBonus || result.stats.armor > form.caps.armor || result.local.fortune > 5) capViolations += 1;
        }
      }
    }
    legalCombinationCount += combinations;
    forms[form.id] = { combinations, roleOptionCounts: roleOptions(form).map((x) => x.length), inlayOptions: inlays.length, maxima, caps: form.caps, capViolations };
  }
  return { legalCombinationCount, forms };
}

function acquisitionScenario(label: string, resourceId: string, nodeKind: ResourceNodeKind, required: number, skill: number, samples = 200) {
  const def = RESOURCE_CATALOG[resourceId as keyof typeof RESOURCE_CATALOG];
  const skillMinimum = def.spawn?.extractSkill.minimum ?? 0;
  const quantity = skill >= 100 ? 2 : 1;
  const inspections: number[] = [];
  const times: number[] = [];
  const failures: number[] = [];
  let completed = 0;
  for (let seed = 1; seed <= samples; seed += 1) {
    let found = 0;
    let inspected = 0;
    let blocked = 0;
    for (let i = 0; i < MAP * MAP && found < required; i += 1) {
      // MAP is 512: an odd multiplier permutes every tile exactly once.
      const index = (seed * 1103 + i * 7919) % (MAP * MAP);
      const tx = index % MAP;
      const ty = Math.floor(index / MAP);
      inspected += 1;
      const identity = resolveResourceNode({ seed, tx, ty, nodeKind }).identity;
      if (identity.resourceId !== resourceId) continue;
      if (skill < skillMinimum) { blocked += 1; continue; }
      found += quantity;
    }
    inspections.push(inspected);
    failures.push(blocked);
    times.push(inspected * SURVEY_SECONDS_PER_NODE + Math.ceil(required / quantity) * WORK_BEAT_SECONDS);
    if (found >= required) completed += 1;
  }
  return {
    label, resourceId, required, skill, samples, model: `${SURVEY_SECONDS_PER_NODE}s/node survey + ${WORK_BEAT_SECONDS}s/successful harvest impact; travel/loading excluded`,
    completionRate: completed / samples,
    inspections: { p50: percentile(inspections, 0.5), p90: percentile(inspections, 0.9), p99: percentile(inspections, 0.99), max: Math.max(...inspections) },
    modeledSeconds: { p50: +percentile(times, 0.5).toFixed(2), p90: +percentile(times, 0.9).toFixed(2), p99: +percentile(times, 0.99).toFixed(2) },
    blockedMatches: { p50: percentile(failures, 0.5), max: Math.max(...failures) },
  };
}

function skillCurves() {
  const skills = [0, 20, 35, 50, 55, 60, 75, 100];
  return skills.map((skill) => ({
    skill,
    bowSuccess: successChance(skill, 18),
    swordSuccess: successChance(skill, 20),
    bowWorkmanship: workmanshipChances(skill, 18),
    swordWorkmanship: workmanshipChances(skill, 20),
  }));
}

function representativeItems() {
  const world = createWorld();
  const builds: Array<{ label: string; formId: "bow" | "sword"; workmanship: Workmanship; components: CraftedComponent[]; inlays: GemInlay[] }> = [
    { label: "common", formId: "bow", workmanship: "ordinary", components: [{ role: "body", resourceId: "oak", form: "log", grade: "rough", amount: 5 }, { role: "binding", resourceId: "common_cloth", form: "cloth", grade: "sound", amount: 1 }], inlays: [] },
    { label: "skilled", formId: "bow", workmanship: "fine", components: [{ role: "body", resourceId: "oak", form: "board", grade: "choice", amount: 5 }, { role: "binding", resourceId: "fine_linen", form: "cloth", grade: "choice", amount: 1 }], inlays: [] },
    { label: "rare", formId: "bow", workmanship: "ordinary", components: [{ role: "body", resourceId: "redwood", form: "log", grade: "choice", amount: 5 }, { role: "binding", resourceId: "common_cloth", form: "cloth", grade: "sound", amount: 1 }], inlays: [{ resourceId: "ruby", clarity: "flawed" }] },
    { label: "highland", formId: "sword", workmanship: "fine", components: [{ role: "edge", resourceId: "highland_ore", form: "ingot", grade: "choice", amount: 5 }, { role: "hilt", resourceId: "oak", form: "board", grade: "sound", amount: 1 }, { role: "binding", resourceId: "common_cloth", form: "cloth", grade: "sound", amount: 1 }], inlays: [] },
    { label: "masterwork", formId: "sword", workmanship: "exceptional", components: [{ role: "edge", resourceId: "highland_ore", form: "ingot", grade: "pristine", amount: 5 }, { role: "hilt", resourceId: "redwood", form: "board", grade: "pristine", amount: 1 }, { role: "binding", resourceId: "fine_linen", form: "cloth", grade: "pristine", amount: 1 }], inlays: [{ resourceId: "ruby", clarity: "perfect" }] },
  ];
  return builds.map((build) => {
    const form = ITEM_FORM_CATALOG[build.formId];
    const item = createCraftedItem(world, { ...build, base: form.baseItem, maker: "Gatehand", recipeId: form.id, recipeVersion: form.recipeVersion });
    return { label: build.label, name: rareName(item), stats: item.resolvedStats, components: item.components, inlays: item.inlays, item };
  });
}

function payloadSizes(items: ReturnType<typeof representativeItems>) {
  const world = createWorld();
  world.player.rares.push(...items.map(({ item }) => structuredClone(item)));
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  writeSave(world);
  const save = storage.getItem(SAVE_KEY) ?? "";
  const inscriptions = items.map(({ item }) => JSON.stringify(encodeRareInscription(world, item))).filter(Boolean);
  return {
    representativeSaveBytes: Buffer.byteLength(save),
    fiveItemBytes: Buffer.byteLength(JSON.stringify(items.map(({ item }) => item))),
    vaultInscriptionBytes: { min: Math.min(...inscriptions.map((x) => Buffer.byteLength(x))), max: Math.max(...inscriptions.map((x) => Buffer.byteLength(x))), total: inscriptions.reduce((n, x) => n + Buffer.byteLength(x), 0) },
  };
}

function browserEvidence() {
  const path = resolve("screenshots/crafting-smoke-final2/verdict.json");
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return { available: true, ok: parsed.ok, viewports: Object.fromEntries(Object.entries(parsed.viewports).map(([name, value]: [string, any]) => [name, { passed: value.passed, overflow: value.overflow, errors: value.errors, state: value.state }])) };
  } catch {
    return { available: false, ok: false };
  }
}

const stats = enumerateStats();
const curves = skillCurves();
const acquisitions = [
  acquisitionScenario("oak bow body", "oak", "tree", 5, 50),
  acquisitionScenario("redwood bow body", "redwood", "tree", 5, 50),
  acquisitionScenario("highland sword edge", "highland_ore", "rock", 5, 55),
  acquisitionScenario("ruby inlay", "ruby", "rock", 1, 60),
  acquisitionScenario("sapphire inlay", "sapphire", "rock", 1, 65),
];
const items = representativeItems();
const sizes = payloadSizes(items);
const browser = browserEvidence();
const maxSkillBow = workmanshipChances(100, 18);
const maxSkillSword = workmanshipChances(100, 20);
const expansionReady = stats.legalCombinationCount > 0
  && Object.values(stats.forms as Record<string, any>).every((form) => form.capViolations === 0)
  && browser.ok
  && maxSkillBow.ordinary <= 0.5
  && maxSkillSword.ordinary <= 0.5;
const report = {
  generatedBy: "scripts/crafting-balance-gate.ts",
  assumptions: { WORK_BEAT_SECONDS, SURVEY_SECONDS_PER_NODE, acquisitionExcludes: ["player route distance", "loading time", "combat interruptions", "cloth acquisition"] },
  acquisitions,
  skillCurves: curves,
  supplySinks: {
    harvestSupply: { belowSkill100: 1, atSkill100: 2 },
    refining: { oakLogToBoard: "1:2", redwoodLogToBoard: "1:2", ironOreToIngot: "1:1", highlandOreToIngot: "1:1" },
    exactSinks: { bow: { timber: 5, cloth: 1, optionalGem: 1 }, sword: { ingot: 5, timber: 1, cloth: 1, optionalGem: 1 } },
  },
  workmanshipAtMaxSkill: { bow: maxSkillBow, sword: maxSkillSword },
  statEnumeration: stats,
  payloadSizes: sizes,
  browser,
  sampleItems: items.map(({ item: _item, ...row }) => row),
  decision: expansionReady ? "READY" : "HOLD",
  reasons: expansionReady ? [] : ["Max-skill workmanship still yields ordinary quality more than 50% of the time on rare inputs; add skill-banded workmanship minimums before expanding the catalog."],
};

writeFileSync(resolve(OUT_DIR, "crafting-balance-gate.json"), `${JSON.stringify(report, null, 2)}\n`);
const md = `# Crafting balance and expansion gate\n\n**Decision: ${report.decision}**\n\n## Why\n${report.reasons.length ? report.reasons.map((reason) => `- ${reason}`).join("\n") : "- All measured gates passed."}\n\n## Evidence\n- Legal combinations enumerated: **${stats.legalCombinationCount.toLocaleString()}**; cap violations: **${Object.values(stats.forms as Record<string, any>).reduce((n, form) => n + form.capViolations, 0)}**.\n- Max-skill bow workmanship: ordinary ${(maxSkillBow.ordinary * 100).toFixed(1)}%, fine ${(maxSkillBow.fine * 100).toFixed(1)}%, exceptional ${(maxSkillBow.exceptional * 100).toFixed(1)}%.\n- Max-skill sword workmanship: ordinary ${(maxSkillSword.ordinary * 100).toFixed(1)}%, fine ${(maxSkillSword.fine * 100).toFixed(1)}%, exceptional ${(maxSkillSword.exceptional * 100).toFixed(1)}%.\n- Representative save payload: **${sizes.representativeSaveBytes.toLocaleString()} bytes**; largest Vault inscription: **${sizes.vaultInscriptionBytes.max.toLocaleString()} bytes**.\n- Desktop/mobile browser journey: **${browser.ok ? "PASS" : "FAIL/UNAVAILABLE"}**.\n\n## Acquisition model\nDeterministic 200-seed simulations use ${SURVEY_SECONDS_PER_NODE}s per surveyed node plus ${WORK_BEAT_SECONDS}s per successful harvest impact. Travel, loading, combat, and cloth acquisition are explicitly excluded.\n\n| Goal | Skill | p50 inspections | p90 | p99 | Modeled p50 seconds |\n|---|---:|---:|---:|---:|---:|\n${acquisitions.map((x) => `| ${x.label} | ${x.skill} | ${x.inspections.p50} | ${x.inspections.p90} | ${x.inspections.p99} | ${x.modeledSeconds.p50} |`).join("\n")}\n\n## Supply and sinks\n- Harvest: 1 unit below skill 100; 2 at skill 100.\n- Timber refining: 1 log → 2 boards, family and grade preserved.\n- Ore refining: 1 ore → 1 ingot, family and grade preserved.\n- Bow: 5 timber + 1 cloth + optional 1 gem.\n- Sword: 5 ingots + 1 timber + 1 cloth + optional 1 gem.\n\n## Stat caps\n${Object.entries(stats.forms as Record<string, any>).map(([id, x]) => `- **${id}:** ${x.combinations.toLocaleString()} legal combinations; max damage ${x.maxima.damage}/${x.caps.damage}, hit ${x.maxima.hitBonus}/${x.caps.hitBonus}, armor ${x.maxima.armor}/${x.caps.armor}, local Fortune ${x.maxima.fortune}/5; ${x.capViolations} violations.`).join("\n")}\n\n## Five representative items\n${items.map((x) => `- **${x.label}:** ${x.name} — damage ${x.stats?.damage}, hit ${x.stats?.hitBonus}, armor ${x.stats?.armor}${x.inlays?.length ? `; inlay ${x.inlays[0]!.resourceId} ${x.inlays[0]!.clarity}` : ""}.`).join("\n")}\n\n## Expansion rule\nDo not add the full catalog yet. First prevent high-skill use of rare/max-grade materials from producing ordinary workmanship more than half the time. The existing bow/sword vertical slices remain release-testable; this HOLD applies to catalog expansion.\n\nFull machine-readable evidence: \`reports/crafting-balance-gate.json\`.\n`;
writeFileSync(resolve(OUT_DIR, "crafting-balance-gate.md"), md);
console.log(JSON.stringify({ decision: report.decision, legalCombinations: stats.legalCombinationCount, capViolations: Object.values(stats.forms as Record<string, any>).reduce((n, form) => n + form.capViolations, 0), browserOk: browser.ok, saveBytes: sizes.representativeSaveBytes, maxVaultBytes: sizes.vaultInscriptionBytes.max }, null, 2));
if (stats.legalCombinationCount === 0 || !browser.ok || Object.values(stats.forms as Record<string, any>).some((form) => form.capViolations > 0)) process.exitCode = 1;
