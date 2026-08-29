import { Button } from "@/components/ui/button";
import { STATIONS } from "@/game/atlas";
import { useGame } from "@/game/store";

export function GateGump() {
  const id = useGame((s) => s.openGateId);
  const travel = useGame((s) => s.travel);
  const close = useGame((s) => s.closeGate);
  if (!id) return null;
  const here = STATIONS.find((s) => s.id === id);
  return (
    <div className="pointer-events-auto absolute top-20 left-1/2 w-[min(100%-1.5rem,20rem)] -translate-x-1/2 rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4">
      <p className="font-display text-sm text-fg">{here?.name ?? "Moongate"}</p>
      <p className="mt-1 text-pretty text-xs leading-relaxed text-muted">
        The swirl holds. Pick a ring. The moons still hold.
      </p>
      <ul className="mt-3 space-y-1">
        {STATIONS.filter((s) => s.id !== id).map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => travel(s.id)}
              className="flex min-h-11 w-full items-center justify-between rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left"
            >
              <span className="text-sm text-fg">{s.name}</span>
              <span className="text-xs text-muted">{s.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
      <Button className="mt-3 w-full" variant="secondary" onClick={close}>
        Step back
      </Button>
    </div>
  );
}
