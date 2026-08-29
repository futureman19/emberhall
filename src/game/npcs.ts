import { ITEM_META, SHOP_STOCK } from "./catalog";
import { isGhost, resurrect, you } from "./player";
import { completeObjective } from "./world";
import type { ItemId, World } from "./types";

export function commandApproach(world: World, id: string) {
  const t = world.people.find((p) => p.id === id);
  const you = world.people.find((p) => p.isPlayer);
  if (!t || !you) return "They are gone.";
  return null;
}

export function commandTalk(world: World, id: string) {
  const t = world.people.find((p) => p.id === id);
  const self = you(world);
  if (!t || !self) return "They are gone.";
  if (Math.hypot(self.x - t.x, self.z - t.z) > 2.4) return "Walk closer.";
  completeObjective(world, "npc");
  if (t.role === "banker") {
    if (isGhost(world)) return `${t.name}: The box is for the living.`;
    return `${t.name}: The box is yours. Gold in, gold out.`;
  }
  if (t.role === "healer") {
    if (isGhost(world)) {
      const msg = resurrect(world, { x: t.x, z: t.z });
      return `${t.name}: ${msg}`;
    }
    self.hp = self.maxHp;
    return `${t.name}: Sit. The wound closes.`;
  }
  if (t.role === "provisioner") {
    if (isGhost(world)) return `${t.name}: Dust will not sell to the dead.`;
    return `${t.name}: Dust, steel, and a blank rune if you have the coin.`;
  }
  return `${t.name} nods.`;
}

export function commandBuy(world: World, item: ItemId) {
  if (isGhost(world)) return "A ghost cannot.";
  const meta = ITEM_META[item];
  if (!SHOP_STOCK.includes(item)) return "They do not keep that.";
  if (world.gold < meta.buy) return `Need ${meta.buy} gold.`;
  world.gold -= meta.buy;
  world.player.pack[item] = (world.player.pack[item] ?? 0) + 1;
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
  return `Sold ${meta.label.toLowerCase()}.`;
}

export function commandDeposit(world: World, n: number) {
  if (isGhost(world)) return "A ghost cannot.";
  if (n < 1 || world.gold < n) return "Not that much in the purse.";
  world.gold -= n;
  world.player.vault += n;
  return `The box holds ${world.player.vault} gold.`;
}

export function commandWithdraw(world: World, n: number) {
  if (n < 1 || world.player.vault < n) return "The box has not that much.";
  world.player.vault -= n;
  world.gold += n;
  return `Purse ${world.gold}.`;
}

export function commandBankItem(world: World, item: ItemId) {
  const n = world.player.pack[item] ?? 0;
  if (n < 1) return "You do not carry that.";
  world.player.pack[item] = n - 1;
  world.player.chest[item] = (world.player.chest[item] ?? 0) + 1;
  return "Into the box.";
}

export function commandUnbankItem(world: World, item: ItemId) {
  const n = world.player.chest[item] ?? 0;
  if (n < 1) return "The box has none.";
  world.player.chest[item] = n - 1;
  world.player.pack[item] = (world.player.pack[item] ?? 0) + 1;
  return "Out of the box.";
}
