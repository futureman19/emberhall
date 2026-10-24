import type { ItemId, NpcRole, World } from "./types.ts";
import { isGhost, you } from "./player.ts";
import { log } from "./world.ts";
import { emitNpcInteractionFx } from "./npc-interaction-animation.ts";

export interface CommissionState {
  templateId: string;
  npcId: string;
  status: "offered" | "active" | "completed";
  expiresAt: number | null;
}
export type CommissionAction = "accept" | "deliver" | "cancel";
export const COMMISSION_HOURS = 24;
export const COMMISSIONS: readonly {
  id: string; role: NpcRole; item: ItemId; quantity: number; reward: number; label: string; recipeId: string;
}[] = [
  { id: "boards", role: "provisioner", item: "board", quantity: 2, reward: 8, label: "Boards for the counter", recipeId: "board" },
  { id: "dressings", role: "healer", item: "bandage", quantity: 2, reward: 6, label: "Fresh dressings", recipeId: "cut_bandage" },
  { id: "draught", role: "alchemist", item: "potion_heal", quantity: 1, reward: 10, label: "A healing draught", recipeId: "potion_heal" },
];

export function isCommissionState(value: unknown): value is CommissionState {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return COMMISSIONS.some((t) => t.id === c.templateId)
    && typeof c.npcId === "string" && c.npcId.length > 0
    && (c.status === "offered" || c.status === "active" || c.status === "completed")
    && (c.status === "active" ? typeof c.expiresAt === "number" && Number.isFinite(c.expiresAt) && c.expiresAt >= 0 : c.expiresAt === null);
}

export function tickCommission(world: World) {
  const c = world.player.commission;
  if (c?.status === "active" && c.expiresAt !== null && world.hour >= c.expiresAt) {
    world.player.commission = { ...c, status: "offered", expiresAt: null };
    log(world, "Commission expired. Speak to the keeper to try again.");
  }
}

/** Called only after the normal talk range/life checks. Talking never replaces an active order. */
export function offerCommission(world: World, npcId: string) {
  tickCommission(world);
  if (isGhost(world) || world.player.commission?.status === "active") return;
  const npc = world.people.find((p) => p.id === npcId && !p.isPlayer);
  const self = you(world);
  const template = COMMISSIONS.find((t) => t.role === npc?.role);
  if (!npc || !self || !template || Math.hypot(self.x - npc.x, self.z - npc.z) > 2.4) return;
  world.player.commission = { templateId: template.id, npcId, status: "offered", expiresAt: null };
}

export function commandCommission(world: World, npcId: string, action: CommissionAction): string | null {
  tickCommission(world);
  if (isGhost(world)) return "Commissions are for the living.";
  const npc = world.people.find((p) => p.id === npcId && !p.isPlayer);
  const self = you(world);
  if (!npc || !self) return "The keeper is gone.";
  if (Math.hypot(self.x - npc.x, self.z - npc.z) > 2.4) return "Walk closer.";
  const c = world.player.commission;
  const t = COMMISSIONS.find((t) => t.id === c?.templateId && t.role === npc.role);
  if (!c || c.npcId !== npcId || !t) return "Speak to this keeper about work first.";
  if (action === "accept") {
    if (c.status !== "offered") return "Finish or cancel your active commission first.";
    world.player.commission = { ...c, status: "active", expiresAt: world.hour + COMMISSION_HOURS };
    log(world, `Commission accepted: ${t.label}. Due in ${COMMISSION_HOURS} hours.`);
    return null;
  }
  if (c.status !== "active") return "No active commission to deliver or cancel.";
  if (action === "cancel") {
    world.player.commission = { ...c, status: "offered", expiresAt: null };
    log(world, `Commission cancelled: ${t.label}.`);
    return null;
  }
  if (action !== "deliver") return "Unknown commission action.";
  const held = world.player.pack[t.item] ?? 0;
  if (held < t.quantity) return `Need ${t.quantity} ${t.item} in your pack (${held}/${t.quantity}).`;
  world.player.pack[t.item] = held - t.quantity;
  world.gold += t.reward;
  world.player.commission = { ...c, status: "completed", expiresAt: null };
  log(world, `Commission complete: ${t.label}. ${npc.name} pays ${t.reward} gold.`);
  emitNpcInteractionFx(world, { kind: "trade", targetId: npc.id, x: npc.x, z: npc.z, direction: "in", item: "gold" });
  return null;
}
