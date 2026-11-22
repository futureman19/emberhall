import { actorState } from "./actor.ts";
import { buildingBox } from "./building-size.ts";
import { isGhost, you } from "./player.ts";
import { emitNpcInteractionFx } from "./npc-interaction-animation.ts";
import type { ItemId, NpcRole, World } from "./types.ts";

export const BANK_RANGE = 2.4;
export const BANK_SLOTS = 125;

export function nearNpcRole(world: World, role: NpcRole, range = BANK_RANGE, actorId?: string) {
  const self = you(world, actorId);
  if (!self) return false;
  return world.people.some((p) => p.role === role && Math.hypot(self.x - p.x, self.z - p.z) <= range);
}

function nearestNpc(world: World, roles: readonly NpcRole[], actorId?: string) {
  const self = you(world, actorId);
  if (!self) return null;
  return world.people
    .filter((person) => person.role && roles.includes(person.role))
    .sort((a, b) => Math.hypot(self.x - a.x, self.z - a.z) - Math.hypot(self.x - b.x, self.z - b.z))[0] ?? null;
}

function emitTransfer(world: World, kind: "trade" | "bank", direction: "in" | "out", item: ItemId | "gold" | "rare", roles: readonly NpcRole[], actorId?: string) {
  const npc = nearestNpc(world, roles, actorId);
  const self = you(world, actorId);
  emitNpcInteractionFx(world, {
    kind,
    targetId: npc?.id ?? null,
    x: npc?.x ?? self?.x ?? 0,
    z: npc?.z ?? self?.z ?? 0,
    direction,
    item,
  });
}

export function nearBank(world: World, actorId?: string) {
  if (nearNpcRole(world, "banker", BANK_RANGE, actorId)) return true;
  const self = you(world, actorId);
  if (!self) return false;
  for (const b of world.buildings) {
    if (b.kind !== "bank") continue;
    if (Math.hypot(self.x - b.tx, self.z - b.ty) <= 3.2) return true;
    const box = buildingBox("bank", b.tx, b.ty);
    if (self.x >= box.x0 && self.x <= box.x1 && self.z >= box.z0 && self.z <= box.z1) return true;
  }
  return false;
}

export function chestSlots(chest: Partial<Record<string, number>> | undefined) {
  let n = 0;
  if (!chest) return 0;
  for (const v of Object.values(chest)) if ((v ?? 0) > 0) n += 1;
  return n;
}

function bankHands(world: World, actorId?: string) {
  if (isGhost(world, actorId)) return "The box is for the living.";
  if (!nearBank(world, actorId)) return "The banker is not here.";
  return null;
}

export function commandDeposit(world: World, n: number, actorId?: string) {
  const sheet = actorState(world, actorId);
  const err = bankHands(world, actorId);
  if (err) return err;
  if (n < 1 || world.gold < n) return "Not that much in the purse.";
  world.gold -= n;
  sheet.vault += n;
  emitTransfer(world, "bank", "in", "gold", ["banker"], actorId);
  return `The box holds ${sheet.vault} gold.`;
}

export function commandBankGold(world: World, actorId?: string) {
  const sheet = actorState(world, actorId);
  const err = bankHands(world, actorId);
  if (err) return err;
  if (world.gold < 1) return `The box holds ${sheet.vault} gold.`;
  return commandDeposit(world, world.gold, actorId);
}

export function commandWithdraw(world: World, n: number, actorId?: string) {
  const sheet = actorState(world, actorId);
  const err = bankHands(world, actorId);
  if (err) return err;
  if (n < 1 || sheet.vault < n) return "The box has not that much.";
  sheet.vault -= n;
  world.gold += n;
  emitTransfer(world, "bank", "out", "gold", ["banker"], actorId);
  return `Purse ${world.gold}.`;
}

export function commandBankItem(world: World, item: ItemId, n = 1, actorId?: string) {
  const sheet = actorState(world, actorId);
  const err = bankHands(world, actorId);
  if (err) return err;
  const have = sheet.pack[item] ?? 0;
  if (n < 1 || have < n) return "You do not carry that.";
  const had = sheet.chest[item] ?? 0;
  if (had < 1 && chestSlots(sheet.chest) >= BANK_SLOTS) return "The box is full.";
  sheet.pack[item] = have - n;
  sheet.chest[item] = had + n;
  emitTransfer(world, "bank", "in", item, ["banker"], actorId);
  return "Into the box.";
}

export function commandUnbankItem(world: World, item: ItemId, n = 1, actorId?: string) {
  const sheet = actorState(world, actorId);
  const err = bankHands(world, actorId);
  if (err) return err;
  const have = sheet.chest[item] ?? 0;
  if (n < 1 || have < n) return "The box has none.";
  sheet.chest[item] = have - n;
  sheet.pack[item] = (sheet.pack[item] ?? 0) + n;
  emitTransfer(world, "bank", "out", item, ["banker"], actorId);
  return "Out of the box.";
}
