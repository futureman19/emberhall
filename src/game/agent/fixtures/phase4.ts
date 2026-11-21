/**
 * Phase 4 mock fixtures — canned accounts, characters, statuses, and the
 * role manifest for contract-based development.
 *
 * The console worker develops against these while the host implementation
 * proceeds independently; the host worker's tests reuse the same vectors so
 * both sides prove they speak the same wire. Values are illustrative — no
 * sim truth lives here.
 */
import {
  BETA_BILLING,
  type Account,
  type Character,
  type CharacterStatus,
  type RolePackManifest,
} from "../account.ts";

export function fixtureAccount(): Account {
  return { id: "acct-demo", createdAt: 1_800_000_000_000, billing: BETA_BILLING };
}

/** A `ready` character on a cloud mind. */
export function fixtureCloudCharacter(): Character {
  return {
    id: "char-wren",
    accountId: "acct-demo",
    name: "Wren",
    roleId: "ranger",
    directive: "Chop, sell, eat, sleep. Stay out of trouble.",
    mind: { kind: "cloud", provider: "openai-compatible", model: "gpt-4o-mini" },
    lifecycle: "ready",
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
    id: "char-bram",
    name: "Bram",
    mind: { kind: "local", endpointUrl: "http://127.0.0.1:11434/v1", model: "qwen3:8b" },
  };
}

/** Unleashed, mind awake, mind driving. */
export function fixtureStatusAwake(): CharacterStatus {
  return {
    characterId: "char-wren",
    lifecycle: "unleashed",
    driver: "mind",
    mindState: "awake",
    autopilotSince: null,
    lastMindExchangeTick: 4120,
    lastReflexTick: 4188,
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
    driver: "reflex",
    mindState: "asleep",
    autopilotSince: 3900,
    lastMindExchangeTick: 3860,
    lastReflexTick: 4188,
    body: { hp: 40, maxHp: 40, x: 255, z: 291, task: "walk" },
    journalTail: [
      "Banked 40 gold.",
      "(autopilot) Bram's mind is asleep; instincts take over.",
    ],
  };
}

/** Illustrative manifest — the content lane owns the real numbers. */
export function fixtureRoleManifest(): RolePackManifest {
  return {
    packs: [
      {
        id: "ranger",
        label: "Ranger",
        summary: "Works the wilds: chops, hunts, tracks, eats what it finds.",
        file: "agent-packs/ranger.md",
        startingSkills: { lumberjack: 30, tracking: 20, cooking: 10 },
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
