import { Button } from "@/components/ui/button";
import { COMMISSIONS, COMMISSION_HOURS } from "@/game/commissions";
import { ITEM_META } from "@/game/catalog";
import { useGame } from "@/game/store";

function remaining(expiresAt: number | null, hour: number) {
  return `${Math.max(0, Math.ceil(((expiresAt ?? hour) - hour) * 10 - 1e-9) / 10)}h left`;
}

export function CommissionDialog({ npcId, close }: { npcId: string; close: boolean }) {
  const state = useGame((s) => s.snap.player?.commission);
  const pack = useGame((s) => s.snap.player?.pack);
  const hour = useGame((s) => s.snap.hour);
  const ghost = useGame((s) => s.snap.player?.ghost);
  const act = useGame((s) => s.commission);
  const t = COMMISSIONS.find((t) => t.id === state?.templateId);
  if (!state || !t) return <p className="mt-3 text-xs text-muted">Talk to ask about work.</p>;
  if (state.npcId !== npcId) return state.status === "active" ? <p className="mt-3 text-xs text-muted">Finish or cancel your commission with its keeper first.</p> : <p className="mt-3 text-xs text-muted">Talk to ask about work.</p>;
  const active = state.status === "active";
  const held = pack?.[t.item] ?? 0;
  return (
    <section className="mt-3 rounded-[var(--radius-sm)] border border-border bg-surface-2 p-3" aria-label="Work order">
      <p className="font-display text-sm text-gold">{t.label}</p>
      <p className="mt-1 text-xs text-fg">{t.quantity} {ITEM_META[t.item].label} · {t.reward} gold</p>
      <p className="mt-1 text-xs text-muted">{active ? `${held}/${t.quantity} in pack · ${remaining(state.expiresAt, hour)}` : state.status === "completed" ? "Delivered and paid. Talk again for another order." : `Supply from your pack within ${COMMISSION_HOURS} in-game hours.`}</p>
      {state.status === "offered" && <Button className="mt-2 min-h-11 w-full" disabled={!close || ghost} onClick={() => act(npcId, "accept")}>Accept commission</Button>}
      {active && <div className="mt-2 flex gap-2">
        <Button className="min-h-11 flex-1" disabled={!close || ghost || held < t.quantity || hour >= (state.expiresAt ?? 0)} onClick={() => act(npcId, "deliver")}>Deliver goods</Button>
        <Button className="min-h-11" variant="secondary" disabled={!close || ghost} onClick={() => act(npcId, "cancel")}>Cancel order</Button>
      </div>}
      {!close && state.status !== "completed" && <p className="mt-1 text-xs text-muted">Walk closer to the keeper.</p>}
    </section>
  );
}

export function CommissionTracker() {
  const state = useGame((s) => s.snap.player?.commission);
  const snap = useGame((s) => s.snap);
  const obscured = useGame((s) => Boolean(s.selectedId || s.panel !== "none" || s.openCraft || s.openBook || s.ctx));
  const t = COMMISSIONS.find((t) => t.id === state?.templateId);
  if (obscured || state?.status !== "active" || !t) return null;
  const keeper = snap.people.find((p) => p.id === state.npcId);
  return <aside data-testid="commission-tracker" className="hud-glass absolute bottom-24 left-3 max-w-60 rounded-[var(--radius-md)] px-3 py-2 text-xs sm:top-20 sm:bottom-auto">
    <p className="font-display text-gold">Commission · {remaining(state.expiresAt, snap.hour)}</p>
    <p className="mt-1 text-fg">{Math.min(snap.player?.pack[t.item] ?? 0, t.quantity)}/{t.quantity} {ITEM_META[t.item].label} → {keeper?.name ?? "Keeper"}</p>
    <p className="mt-1 text-muted">{t.reward} gold on delivery</p>
  </aside>;
}
