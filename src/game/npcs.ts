import { offerCommission } from "./commissions.ts";
import { APOTHECARY_STOCK, hasTag, ITEM_META, SHOP_STOCK } from "./catalog.ts";
import { BANK_RANGE } from "./bank.ts";
export { BANK_RANGE, BANK_SLOTS, nearNpcRole, nearBank, chestSlots, commandDeposit, commandBankGold, commandWithdraw, commandBankItem, commandUnbankItem } from "./bank.ts";
import { actorState } from "./actor.ts";
import { isGhost, resurrect, you } from "./player.ts";
import { astarToRange, tileOf } from "./pathfinding.ts";
import { addToPile } from "./piles.ts";
import { appraiseRare, rareName } from "./rare.ts";
import { BRANN_BANDAGES, BRANN_NAME, BRANN_PAY, BRANN_WANT, completeObjective, log, RYN_NAME, RYN_PAY, RYN_WANT } from "./world.ts";
import { emitNpcInteractionFx } from "./npc-interaction-animation.ts";
import type { ItemId, NpcRole, World } from "./types.ts";



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



/** A stall's counter reach: the court's keeper stands a few paces off and
 *  still trades — but not from across the vale, and never with no keeper
 *  anywhere near. Checked at transaction time from canonical positions. */
export const SHOP_RANGE = 4.5;

/** Every keeper who runs a counter, and what each keeps. */
export const SHOP_ROLES: readonly NpcRole[] = ["provisioner", "alchemist"];

export function stockFor(role: NpcRole | null | undefined): readonly ItemId[] {
  return role === "alchemist" ? APOTHECARY_STOCK : SHOP_STOCK;
}

/** The alchemist weighs only reagents and finished draughts. */
export function alchemistBuys(item: ItemId): boolean {
  return hasTag(item, "reagent") || item.startsWith("potion_");
}

/** The nearest keeper within counter reach, any shop role — the counter you
 *  actually walked up to decides what stock you see. */
function keeperNear(world: World, roles: readonly NpcRole[] = SHOP_ROLES, actorId?: string) {
  const self = you(world, actorId);
  if (!self) return null;
  return world.people
    .filter((p) => p.role && roles.includes(p.role) && Math.hypot(self.x - p.x, self.z - p.z) <= SHOP_RANGE)
    .sort((a, b) => Math.hypot(self.x - a.x, self.z - a.z) - Math.hypot(self.x - b.x, self.z - b.z))[0] ?? null;
}

function shopHands(world: World, roles: readonly NpcRole[] = SHOP_ROLES, actorId?: string) {
  if (isGhost(world, actorId)) return "A ghost cannot.";
  if (!keeperNear(world, roles, actorId)) return "The keeper is not here.";
  return null;
}

/** Walk and talk trades are actor-owned: pack, rares, commission and intent
 *  resolve through actorState; gold, rep and quest flags stay shared world
 *  state. An omitted actorId resolves the legacy solo sheet. */
export function commandApproach(world: World, id: string, actorId?: string) {
  const t = world.people.find((p) => p.id === id);
  const self = you(world, actorId);
  if (!t || !self) return "They are gone.";
  if (Math.hypot(self.x - t.x, self.z - t.z) <= BANK_RANGE) return null;
  const from = tileOf(self.x, self.z);
  const path = astarToRange(world, from.tx, from.ty, t.x, t.z, BANK_RANGE);
  if (!path) return "The way is closed.";
  self.path = path.map((node) => ({ tx: node.x, ty: node.y }));
  const destination = path.at(-1);
  if (destination) actorState(world, actorId).intent = { kind: "walk", tx: destination.x, ty: destination.y, targetId: id, spell: null };
  return null;
}

export function commandTalk(world: World, id: string, actorId?: string) {
  const sheet = actorState(world, actorId);
  const t = world.people.find((p) => p.id === id);
  const self = you(world, actorId);
  if (!t || !self) return "They are gone.";
  if (Math.hypot(self.x - t.x, self.z - t.z) > 2.4) return "Walk closer.";
  completeObjective(world, "npc");
  offerCommission(world, id, actorId);
  const answer = (message: string, kind: "talk" | "heal" = "talk") => {
    emitNpcInteractionFx(world, { kind, targetId: t.id, x: t.x, z: t.z });
    return message;
  };
  if (t.role === "banker") {
    if (isGhost(world, actorId)) return answer(`${t.name}: The box is for the living.`);
    return answer(`${t.name}: The box is yours. Gold in, gold out.`);
  }
  if (t.role === "healer") {
    if (isGhost(world, actorId)) {
      const msg = resurrect(world, { x: t.x, z: t.z }, actorId);
      return answer(`${t.name}: ${msg}`, "heal");
    }
    self.hp = self.maxHp;
    return answer(`${t.name}: Sit. The wound closes.`, "heal");
  }
  if (t.name === BRANN_NAME) {
    if (isGhost(world, actorId)) return answer(`${t.name}: The dead keep no suppers.`);
    if ((world.rep[BRANN_WANT] ?? 0) > 0) {
      return answer(`${t.name}: The hall still speaks of your fish. I remember.`);
    }
    const fish = sheet.pack.cooked_fish ?? 0;
    if (fish < 1) {
      if (!world.quests.some((q) => q.id === BRANN_WANT)) {
        world.quests.push({ id: BRANN_WANT, title: "Bring Brann two cooked fish" });
      }
      return answer(`${t.name}: The hall wants supper. Bring two cooked fish from the pond south of the court — I'll pay.`);
    }
    if (fish < 2) {
      return answer(`${t.name}: One for the pot. One more and the hall eats.`);
    }
    sheet.pack.cooked_fish = fish - 2;
    world.gold += BRANN_PAY;
    const before = sheet.pack.bandage ?? 0;
    sheet.pack.bandage = before + BRANN_BANDAGES;
    if ((sheet.pack.bandage ?? 0) !== before + BRANN_BANDAGES) {
      addToPile(world, Math.round(t.x), Math.round(t.z), { bandage: BRANN_BANDAGES }, "drop", world.hour + 24, "Brann's thanks", 0);
    }
    world.rep[BRANN_WANT] = 1;
    const quest = world.quests.find((q) => q.id === BRANN_WANT);
    if (quest) quest.title = "Brann has his supper";
    else world.quests.push({ id: BRANN_WANT, title: "Brann has his supper" });
    log(world, `${t.name} takes the fish. ${BRANN_PAY} gold, ${BRANN_BANDAGES} bandages.`);
    return answer(`${t.name}: The hall eats well tonight. You have my thanks.`);
  }
  if (t.role === "provisioner") {
    if (isGhost(world, actorId)) return answer(`${t.name}: Dust will not sell to the dead.`);
    return answer(`${t.name}: Dust, steel, and a blank rune if you have the coin.`);
  }
  if (t.role === "alchemist") {
    if (isGhost(world, actorId)) return answer(`${t.name}: The dead lack the blood for draughts.`);
    return answer(`${t.name}: Draughts for the wound and the dark — and reagents by the ounce, nightshade among them.`);
  }
  if (t.name === RYN_NAME) {
    if (isGhost(world, actorId)) return answer(`${t.name}: The dead keep no bargains.`);
    if ((world.rep[RYN_WANT] ?? 0) > 0) {
      return answer(`${t.name}: The hollow stays fallen. I remember.`);
    }
    const hides = sheet.pack.hide ?? 0;
    if (hides < 1) {
      if (!world.quests.some((q) => q.id === RYN_WANT)) {
        world.quests.push({ id: RYN_WANT, title: "Bring Ryn a hide" });
      }
      return answer(`${t.name}: Wolfhollow took my last hide. Bring me one. I'll pay.`);
    }
    sheet.pack.hide = hides - 1;
    world.gold += RYN_PAY;
    world.rep[RYN_WANT] = 1;
    const quest = world.quests.find((q) => q.id === RYN_WANT);
    if (quest) quest.title = "Ryn has her hide";
    else world.quests.push({ id: RYN_WANT, title: "Ryn has her hide" });
    log(world, `${t.name} takes the hide. ${RYN_PAY} gold.`);
    return answer(`${t.name}: That's the one. Don't sleep in the hollow.`);
  }
  return answer(`${t.name} nods.`);
}

export function commandBuy(world: World, item: ItemId, actorId?: string) {
  const sheet = actorState(world, actorId);
  const err = shopHands(world, SHOP_ROLES, actorId);
  if (err) return err;
  const keeper = keeperNear(world, SHOP_ROLES, actorId);
  const meta = ITEM_META[item];
  if (!stockFor(keeper?.role).includes(item)) return "They do not keep that.";
  if (world.gold < meta.buy) return `Need ${meta.buy} gold.`;
  world.gold -= meta.buy;
  sheet.pack[item] = (sheet.pack[item] ?? 0) + 1;
  emitTransfer(world, "trade", "out", item, SHOP_ROLES, actorId);
  return `Bought ${meta.label.toLowerCase()}.`;
}

export function commandSell(world: World, item: ItemId, actorId?: string) {
  const sheet = actorState(world, actorId);
  const err = shopHands(world, SHOP_ROLES, actorId);
  if (err) return err;
  const keeper = keeperNear(world, SHOP_ROLES, actorId);
  if (keeper?.role === "alchemist" && !alchemistBuys(item)) return "They will not take it.";
  const n = sheet.pack[item] ?? 0;
  if (n < 1) return "You do not carry that.";
  const meta = ITEM_META[item];
  if (meta.sell <= 0) return "They will not take it.";
  sheet.pack[item] = n - 1;
  world.gold += meta.sell;
  emitTransfer(world, "trade", "in", item, SHOP_ROLES, actorId);
  return `Sold ${meta.label.toLowerCase()}.`;
}

export function commandSellRare(world: World, uid: string, actorId?: string) {
  const sheet = actorState(world, actorId);
  // The loupe stays at the provisioner's counter; the alchemist keeps scales.
  const err = shopHands(world, ["provisioner"], actorId);
  if (err) return err;
  const rare = sheet.rares.find((r) => r.uid === uid);
  if (!rare) return "No such wonder.";
  const { total } = appraiseRare(rare);
  const name = rareName(rare);
  sheet.rares = sheet.rares.filter((r) => r.uid !== uid);
  for (const [slot, link] of Object.entries(sheet.wearRare)) {
    if (link === uid) sheet.wearRare[slot as keyof typeof sheet.wearRare] = undefined;
  }
  world.gold += total;
  emitTransfer(world, "trade", "in", "rare", ["provisioner"], actorId);
  const note = `The keeper studies ${name}. "${total} gold — and lucky to have it."`;
  log(world, note);
  return note;
}
