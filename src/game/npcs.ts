import { ITEM_META, SHOP_STOCK } from "./catalog.ts";
import { buildingBox } from "./building-size.ts";
import { isGhost, resurrect, you } from "./player.ts";
import { astarToRange, tileOf } from "./pathfinding.ts";
import { appraiseRare, rareName } from "./rare.ts";
import { completeObjective, log } from "./world.ts";
import { emitNpcInteractionFx } from "./npc-interaction-animation.ts";
import type { ItemId, NpcRole, World } from "./types.ts";

export const BANK_RANGE = 2.4;
export const BANK_SLOTS = 125;

export function nearNpcRole(world: World, role: NpcRole, range = BANK_RANGE) {
  const self = you(world);
  if (!self) return false;
  return world.people.some((p) => p.role === role && Math.hypot(self.x - p.x, self.z - p.z) <= range);
}

function nearestNpc(world: World, roles: readonly NpcRole[]) {
  const self = you(world);
  if (!self) return null;
  return world.people
    .filter((person) => person.role && roles.includes(person.role))
    .sort((a, b) => Math.hypot(self.x - a.x, self.z - a.z) - Math.hypot(self.x - b.x, self.z - b.z))[0] ?? null;
}

function emitTransfer(world: World, kind: "trade" | "bank", direction: "in" | "out", item: ItemId | "gold" | "rare", roles: readonly NpcRole[]) {
  const npc = nearestNpc(world, roles);
  const self = you(world);
  emitNpcInteractionFx(world, {
    kind,
    targetId: npc?.id ?? null,
    x: npc?.x ?? self?.x ?? 0,
    z: npc?.z ?? self?.z ?? 0,
    direction,
    item,
  });
}

export function nearBank(world: World) {
  if (nearNpcRole(world, "banker")) return true;
  const self = you(world);
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

function bankHands(world: World) {
  if (isGhost(world)) return "The box is for the living.";
  if (!nearBank(world)) return "The banker is not here.";
  return null;
}

export function commandApproach(world: World, id: string) {
  const t = world.people.find((p) => p.id === id);
  const self = you(world);
  if (!t || !self) return "They are gone.";
  if (Math.hypot(self.x - t.x, self.z - t.z) <= BANK_RANGE) return null;
  const from = tileOf(self.x, self.z);
  const path = astarToRange(world, from.tx, from.ty, t.x, t.z, BANK_RANGE);
  if (!path) return "The way is closed.";
  self.path = path.map((node) => ({ tx: node.x, ty: node.y }));
  const destination = path.at(-1);
  if (destination) world.player.intent = { kind: "walk", tx: destination.x, ty: destination.y, targetId: id, spell: null };
  return null;
}

export function commandTalk(world: World, id: string) {
  const t = world.people.find((p) => p.id === id);
  const self = you(world);
  if (!t || !self) return "They are gone.";
  if (Math.hypot(self.x - t.x, self.z - t.z) > 2.4) return "Walk closer.";
  completeObjective(world, "npc");
  const answer = (message: string, kind: "talk" | "heal" = "talk") => {
    emitNpcInteractionFx(world, { kind, targetId: t.id, x: t.x, z: t.z });
    return message;
  };
  if (t.role === "banker") {
    if (isGhost(world)) return answer(`${t.name}: The box is for the living.`);
    return answer(`${t.name}: The box is yours. Gold in, gold out.`);
  }
  if (t.role === "healer") {
    if (isGhost(world)) {
      const msg = resurrect(world, { x: t.x, z: t.z });
      return answer(`${t.name}: ${msg}`, "heal");
    }
    self.hp = self.maxHp;
    return answer(`${t.name}: Sit. The wound closes.`, "heal");
  }
  if (t.role === "provisioner") {
    if (isGhost(world)) return answer(`${t.name}: Dust will not sell to the dead.`);
    return answer(`${t.name}: Dust, steel, and a blank rune if you have the coin.`);
  }
  return answer(`${t.name} nods.`);
}

export function commandBuy(world: World, item: ItemId) {
  if (isGhost(world)) return "A ghost cannot.";
  const meta = ITEM_META[item];
  if (!SHOP_STOCK.includes(item)) return "They do not keep that.";
  if (world.gold < meta.buy) return `Need ${meta.buy} gold.`;
  world.gold -= meta.buy;
  world.player.pack[item] = (world.player.pack[item] ?? 0) + 1;
  emitTransfer(world, "trade", "out", item, ["provisioner"]);
  return `Bought ${meta.label.toLowerCase()}.`;
}

export function commandSell(world: World, item: ItemId) {
  if (isGhost(world)) return "A ghost cannot.";
  const n = world.player.pack[item] ?? 0;
  if (n < 1) return "You do not carry that.";
  const meta = ITEM_META[item];
  if (meta.sell <= 0) return "They will not take it.";
  world.player.pack[item] = n - 1;
  world.gold += meta.sell;
  emitTransfer(world, "trade", "in", item, ["provisioner"]);
  return `Sold ${meta.label.toLowerCase()}.`;
}

export function commandSellRare(world: World, uid: string) {
  if (isGhost(world)) return "A ghost cannot.";
  const rare = world.player.rares.find((r) => r.uid === uid);
  if (!rare) return "No such wonder.";
  const { total } = appraiseRare(rare);
  const name = rareName(rare);
  world.player.rares = world.player.rares.filter((r) => r.uid !== uid);
  for (const [slot, link] of Object.entries(world.player.wearRare)) {
    if (link === uid) world.player.wearRare[slot as keyof typeof world.player.wearRare] = undefined;
  }
  world.gold += total;
  emitTransfer(world, "trade", "in", "rare", ["provisioner"]);
  const note = `The keeper studies ${name}. "${total} gold — and lucky to have it."`;
  log(world, note);
  return note;
}

export function commandDeposit(world: World, n: number) {
  const err = bankHands(world);
  if (err) return err;
  if (n < 1 || world.gold < n) return "Not that much in the purse.";
  world.gold -= n;
  world.player.vault += n;
  emitTransfer(world, "bank", "in", "gold", ["banker"]);
  return `The box holds ${world.player.vault} gold.`;
}

export function commandBankGold(world: World) {
  const err = bankHands(world);
  if (err) return err;
  if (world.gold < 1) return `The box holds ${world.player.vault} gold.`;
  return commandDeposit(world, world.gold);
}

export function commandWithdraw(world: World, n: number) {
  const err = bankHands(world);
  if (err) return err;
  if (n < 1 || world.player.vault < n) return "The box has not that much.";
  world.player.vault -= n;
  world.gold += n;
  emitTransfer(world, "bank", "out", "gold", ["banker"]);
  return `Purse ${world.gold}.`;
}

export function commandBankItem(world: World, item: ItemId, n = 1) {
  const err = bankHands(world);
  if (err) return err;
  const have = world.player.pack[item] ?? 0;
  if (n < 1 || have < n) return "You do not carry that.";
  const had = world.player.chest[item] ?? 0;
  if (had < 1 && chestSlots(world.player.chest) >= BANK_SLOTS) return "The box is full.";
  world.player.pack[item] = have - n;
  world.player.chest[item] = had + n;
  emitTransfer(world, "bank", "in", item, ["banker"]);
  return "Into the box.";
}

export function commandUnbankItem(world: World, item: ItemId, n = 1) {
  const err = bankHands(world);
  if (err) return err;
  const have = world.player.chest[item] ?? 0;
  if (n < 1 || have < n) return "The box has none.";
  world.player.chest[item] = have - n;
  world.player.pack[item] = (world.player.pack[item] ?? 0) + n;
  emitTransfer(world, "bank", "out", item, ["banker"]);
  return "Out of the box.";
}
