/**
 * Phase 4 mock fixtures — canned accounts, characters, statuses, journal and
 * the role manifest for contract-based development (v1 §1–§6 wire shapes).
 *
 * The console worker develops against these while the host implementation
 * proceeds independently; the host worker's tests reuse the same vectors so
 * both sides prove they speak the same wire. Values are illustrative — no
 * sim truth lives here, and the manifest's skill numbers are mocks (the real
 * manifest is generated from the authored packs; see agent-packs/packs.json).
 * Timestamps are Unix milliseconds; ticks are authoritative shard ticks.
 */
import {
  BETA_BILLING,
  type Account,
  type Character,
  type CharacterStatus,
  type CharacterView,
  type JournalPage,
  type RolePackManifest,
} from "../account.ts";

export function fixtureAccount(): Account {
  return { id: "acct-demo", createdAt: 1_800_000_000_000, billing: BETA_BILLING };
}

/** A `ready` character on a cloud mind. */
export function fixtureCloudCharacter(): Character {
  return {
    characterId: "char-wren",
    accountId: "acct-demo",
    name: "Wren",
    roleId: "ranger",
    directive: "Chop, sell, eat, sleep. Stay out of trouble.",
    mind: { kind: "cloud", provider: "openai-compatible", model: "gpt-4o-mini" },
    lifecycle: "ready",
    revision: 1,
    billing: BETA_BILLING,
    createdAt: 1_800_000_000_000,
    updatedAt: 1_800_000_000_000,
    unleashedAt: null,
    recalledAt: null,
  };
}

/** A `ready` character on a local endpoint (the sleeping-mind path). */
export function fixtureLocalCharacter(): Character {
  return {
    ...fixtureCloudCharacter(),
    characterId: "char-bram",
    name: "Bram",
    mind: { kind: "local", endpointUrl: "http://127.0.0.1:11434/v1", model: "qwen3:8b" },
  };
}

/** The public projection: Character plus its secret-free mind view. */
export function fixtureCharacterView(): CharacterView {
  const character = fixtureCloudCharacter();
  return {
    character,
    publicMind: { config: character.mind ?? { kind: "cloud", provider: "openai-compatible", model: "gpt-4o-mini" }, secretHint: "configured" },
  };
}

/** Unleashed, mind awake, mind driving. */
export function fixtureStatusAwake(): CharacterStatus {
  return {
    characterId: "char-wren",
    lifecycle: "unleashed",
    runtimeState: "running",
    driver: "mind",
    mindState: "awake",
    reflexState: "ready",
    reasonCode: null,
    autopilotSince: null,
    lastMindExchangeTick: 4120,
    lastReflexTick: 4188,
    lastAppliedActionTick: 4188,
    configRevision: 1,
    body: { hp: 38, maxHp: 40, x: 256, z: 293, task: "chop" },
    journalTail: [
      "Sold 12 logs to Mira for 36 gold.",
      "The east stand is thinning; I'll work the north trees tomorrow.",
    ],
  };
}

/** Unleashed, local mind asleep, reflexes driving — the autopilot state. */
export function fixtureStatusAsleep(): CharacterStatus {
  return {
    characterId: "char-bram",
    lifecycle: "unleashed",
    runtimeState: "running",
    driver: "reflex",
    mindState: "asleep",
    reflexState: "ready",
    reasonCode: null,
    autopilotSince: 3900,
    lastMindExchangeTick: 3860,
    lastReflexTick: 4188,
    lastAppliedActionTick: 4188,
    configRevision: 1,
    body: { hp: 40, maxHp: 40, x: 255, z: 291, task: "walk" },
    journalTail: [
      "Banked 40 gold.",
      "(autopilot) Bram's mind is asleep; instincts take over.",
    ],
  };
}

/** Recalled: the body rests, no runtime, reflexes off. */
export function fixtureStatusRecalled(): CharacterStatus {
  return {
    characterId: "char-wren",
    lifecycle: "recalled",
    runtimeState: "inactive",
    driver: "none",
    mindState: "asleep",
    reflexState: "unavailable",
    reasonCode: null,
    autopilotSince: null,
    lastMindExchangeTick: 4120,
    lastReflexTick: 4188,
    lastAppliedActionTick: 4188,
    configRevision: 1,
    body: { hp: 38, maxHp: 40, x: 256, z: 293, task: "idle" },
    journalTail: ["(autopilot) Wren is recalled; the body rests."],
  };
}

/** A paged journal response (v1 §2): mind voice plus a marked system line. */
export function fixtureJournalPage(): JournalPage {
  return {
    entries: [
      { sequence: 1, tick: 4120, source: "mind", text: "Sold 12 logs to Mira for 36 gold." },
      { sequence: 2, tick: 4188, source: "system", text: "(autopilot) Wren's mind is asleep; instincts take over." },
    ],
    nextCursor: null,
  };
}

/** Illustrative manifest — the content lane owns the real numbers. */
export function fixtureRoleManifest(): RolePackManifest {
  return {
    version: 1,
    roles: [
      {
        id: "ranger",
        label: "Ranger",
        summary: "Works the wilds: chops, hunts, tracks, eats what it finds.",
        file: "agent-packs/ranger.md",
        startingSkills: { archery: 30, tracking: 20, cooking: 10 },
      },
      {
        id: "smith",
        label: "Smith",
        summary: "Mines, smelts, and hammers; sells ironwork at the forge.",
        file: "agent-packs/smith.md",
        startingSkills: { mining: 30, smithing: 30 },
      },
      {
        id: "banker",
        label: "Banker",
        summary: "Holds court at the bank; trades, stashes, and keeps books.",
        file: "agent-packs/banker.md",
        startingSkills: { anatomy: 10, healing: 10 },
      },
      {
        id: "mule",
        label: "Mule",
        summary: "Hauls for everyone: pack runs between woods, forge, and bank.",
        file: "agent-packs/mule.md",
        startingSkills: { lumberjack: 10, mining: 10 },
      },
    ],
  };
}
