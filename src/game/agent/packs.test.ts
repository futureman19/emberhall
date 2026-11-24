/**
 * Agent content truth tests — the vale manual and the four role packs must cite
 * only real sim ids. Every vocabulary set is parsed from the source files
 * (types.ts unions, catalog.ts SKILL_META/LIVE_SKILLS, atlas.ts PLACES); no
 * copied lists. If the sim grows a skill, item, verb, or place, these docs are
 * forced to keep up.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {SKILL_META, LIVE_SKILLS, emptySkills } from "../catalog.ts";
import { ROLE_IDS, isRoleId } from "./account.ts";
import { PLACES } from "../atlas.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const manual = readFileSync(join(root, "docs", "vale-manual.md"), "utf8");
const packDir = join(root, "agent-packs");
const packFiles = readdirSync(packDir).filter((f) => f.endsWith(".md")).sort();
const packs = new Map(packFiles.map((f) => [f, readFileSync(join(packDir, f), "utf8")]));

// ---- vocabulary parsed from source, never copied ----
// Strip comments first: the SkillId union carries a mid-list comment whose
// semicolon would otherwise cut the lazy union match short.
const typesSrc = readFileSync(join(root, "src", "game", "types.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "");
function union(name: string): Set<string> {
  const m = typesSrc.match(new RegExp(`export type ${name} =([\\s\\S]*?);`));
  assert.ok(m, `types.ts must declare export type ${name}`);
  return new Set([...m[1].matchAll(/"([A-Za-z_]+)"/g)].map((x) => x[1]));
}
const skillIds = union("SkillId");
const itemIds = union("ItemId");
const ctxVerbs = union("CtxVerb");
const intentKinds = union("IntentKind");
const notoriety = union("Notoriety");

const liveSkills = new Set<string>(LIVE_SKILLS);
const skillLabels = new Map(Object.entries(SKILL_META).map(([id, m]) => [id, m.label]));
const placeNames = new Set(PLACES.map((p) => p.name));
const placeIds = new Set(PLACES.map((p) => p.id));

// Real identifiers outside the closed unions: harness functions, type names,
// save/storage keys, and the dotted state paths the manual names.
const extraIds = new Set([
  "observeWorld",
  "submitIntent",
  "CtxVerb",
  "IntentKind",
  "SkillId",
  "ItemId",
  "localStorage",
  "emberhall-save-v4",
  "player.chest",
  "player.vault",
  "world.gold",
  "building.chest",
]);
const allowed = new Set<string>([
  ...skillIds,
  ...itemIds,
  ...ctxVerbs,
  ...intentKinds,
  ...notoriety,
  ...placeIds,
  ...extraIds,
]);

function backtickTokens(doc: string): string[] {
  return [...doc.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
}

function checkVocabulary(file: string, doc: string) {
  for (const token of backtickTokens(doc)) {
    if (/^\d/.test(token)) continue; // numeric literals: 0.35, 20:00, 48
    if (token.includes("/")) {
      assert.ok(
        /^(src|docs|agent-packs|scripts)\//.test(token),
        `${file}: backticked path must be a repo path: \`${token}\``,
      );
      continue;
    }
    if (/\.(md|ts|mts|mjs)$/.test(token)) continue; // file names
    assert.ok(allowed.has(token), `${file}: unknown id \`${token}\` — not in any source union`);
  }
}

function checkPlaceCasing(file: string, doc: string) {
  const lower = doc.toLowerCase();
  for (const name of placeNames) {
    if (lower.includes(name.toLowerCase())) {
      assert.ok(doc.includes(name), `${file}: place "${name}" mentioned with wrong casing`);
    }
  }
}

function section(doc: string, heading: string, nextHeading: string): string {
  const start = doc.indexOf(heading);
  assert.ok(start >= 0, `missing section ${heading}`);
  const end = doc.indexOf(nextHeading, start + heading.length);
  assert.ok(end > start, `missing section after ${heading}: ${nextHeading}`);
  return doc.slice(start, end);
}

// ---- the manual ----
test("vale manual cites only real ids and exact place casing", () => {
  checkVocabulary("docs/vale-manual.md", manual);
  checkPlaceCasing("docs/vale-manual.md", manual);
});

test("vale manual lists every live skill with its catalog label, and only live skills", () => {
  const skills = section(manual, "## Skills", "### Book-only skills");
  const rows = [...skills.matchAll(/^- \*\*([^*]+)\*\* \(`([a-z_]+)`\)/gm)];
  assert.equal(rows.length, LIVE_SKILLS.length, "manual must list every live skill exactly once");
  const listed = new Set<string>();
  for (const [, label, id] of rows) {
    assert.ok(liveSkills.has(id), `manual lists non-live skill ${id}`);
    assert.equal(label, skillLabels.get(id), `manual label for ${id} must match SKILL_META`);
    assert.ok(!listed.has(id), `duplicate skill row ${id}`);
    listed.add(id);
  }
  assert.deepEqual([...listed].sort(), [...liveSkills].sort());
});

test("vale manual book-only list is exactly the non-live SKILL_META keys", () => {
  const book = section(manual, "### Book-only skills", "## Economy");
  const ids = backtickTokens(book).filter((t) => /^[a-z_]+$/.test(t));
  const placeholders = Object.keys(SKILL_META).filter((k) => !liveSkills.has(k));
  for (const id of ids) {
    assert.ok(id in SKILL_META, `book-only ${id} is not a real SkillId`);
    assert.ok(!liveSkills.has(id), `book-only ${id} is live`);
  }
  assert.deepEqual([...ids].sort(), placeholders.sort());
});

test("vale manual names every PLACES entry exactly, and no invented places", () => {
  const places = section(manual, "## Places", "## Verb menu");
  const names = [...places.matchAll(/^- \*\*([^*]+)\*\* —/gm)].map((m) => m[1]);
  assert.deepEqual([...names].sort(), [...placeNames].sort());
});

test("vale manual verb menu is exactly the CtxVerb union", () => {
  const verbs = section(manual, "## Verb menu", "## Work, craft, and land");
  const listed = [...verbs.matchAll(/^- `([A-Za-z]+)` —/gm)].map((m) => m[1]);
  assert.deepEqual([...listed].sort(), [...ctxVerbs].sort());
});

// ---- the packs ----
test("the four role packs exist", () => {
  assert.deepEqual(packFiles, ["banker.md", "mule.md", "ranger.md", "smith.md"]);
});

for (const [file, doc] of packs) {
  test(`${file}: real ids, exact place casing, required structure`, () => {
    checkVocabulary(`agent-packs/${file}`, doc);
    checkPlaceCasing(`agent-packs/${file}`, doc);

    for (const heading of [
      "## Role",
      "## Starting skills",
      "## Daily loop",
      "## Goal ladder",
      "### First hour",
      "### First day",
      "### First week",
      "## Journal",
    ]) {
      assert.ok(doc.includes(heading), `${file}: missing ${heading}`);
    }

    // Role fantasy is three lines.
    const role = section(doc, "## Role", "## Starting skills");
    const roleLines = role.split("\n").slice(1).filter((l) => l.trim().length > 0);
    assert.equal(roleLines.length, 3, `${file}: role fantasy must be 3 lines`);

    // Starting skills cite real, live SkillIds only.
    const skills = section(doc, "## Starting skills", "## Daily loop");
    const ids = backtickTokens(skills).filter((t) => /^[a-z_]+$/.test(t));
    assert.ok(ids.length >= 3, `${file}: name at least 3 starting skills`);
    for (const id of ids) {
      assert.ok(liveSkills.has(id), `${file}: starting skill ${id} is not live`);
    }

    // Bold emphasis is reserved for real skill labels and place names.
    const boldOk = new Set<string>([...skillLabels.values(), ...placeNames]);
    for (const [, phrase] of doc.matchAll(/\*\*([^*\n]+)\*\*/g)) {
      assert.ok(boldOk.has(phrase), `${file}: bold "${phrase}" is not a skill label or place name`);
    }

    // Journal style: first-person quoted entries, 1-2 lines each.
    const journal = doc.slice(doc.indexOf("## Journal"));
    const quotes = [...journal.matchAll(/^> (.+)$/gm)].map((m) => m[1]);
    assert.ok(quotes.length >= 2, `${file}: journal needs example entries`);
    for (const q of quotes) {
      assert.ok(q.split(/[.!?]/).filter((s) => s.trim()).length <= 3, `${file}: journal entry too long`);
    }
  });
}

test("role manifest packs.json is version 1 and matches the authored spread", () => {
  assert.ok(readdirSync(packDir).includes("packs.json"), "agent-packs/packs.json must exist");
  const manifest = JSON.parse(readFileSync(join(packDir, "packs.json"), "utf8")) as {
    version: number;
    roles: { id: string; label: string; summary: string; file: string; startingSkills: Record<string, number> }[];
  };
  assert.equal(manifest.version, 1, "manifest version is 1 (v1 §4)");
  assert.deepEqual(
    manifest.roles.map((r) => r.id).sort(),
    [...ROLE_IDS].sort(),
    "manifest covers exactly the four role ids",
  );
  const spread = emptySkills();
  for (const role of manifest.roles) {
    assert.ok(isRoleId(role.id), `role id ${role.id} is a known RoleId`);
    assert.ok(role.label.trim().length > 0, `${role.id}: label present`);
    assert.ok(role.summary.trim().length > 0, `${role.id}: summary present`);
    assert.equal(role.file, `agent-packs/${role.id}.md`, `${role.id}: file points at its authored pack`);
    assert.ok(readdirSync(packDir).includes(`${role.id}.md`), `${role.id}: authored pack exists`);
    assert.deepEqual(role.startingSkills, spread, `${role.id}: startingSkills equals the authored spread`);
    for (const [skill, value] of Object.entries(role.startingSkills)) {
      assert.ok(skill in SKILL_META, `${role.id}: skill ${skill} is a real SkillId`);
      assert.ok(Number.isFinite(value) && value >= 0 && value <= 100, `${role.id}: ${skill} within 0..100`);
    }
  }
});
