import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { BUILD_ORDER, BUILDING_META } from "@/game/catalog";
import { PLACEABLE_BY_ID, PLACEABLE_CATALOG, PLACEABLE_CATEGORIES } from "@/game/placeables/catalog";
import { getHoldBuild } from "@/game/placeables/build-mode";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";

const CATEGORY_LABEL: Record<(typeof PLACEABLE_CATEGORIES)[number], string> = {
  frames: "Frames",
  roofs: "Roofs",
  doors: "Doors",
  hearths: "Hearths",
  work: "Work",
  keeping: "Keeping",
  comfort: "Comfort",
  signs: "Signs",
  garden: "Garden",
};

function costLine(id: string) {
  const def = PLACEABLE_BY_ID[id];
  if (!def) return "";
  return def.cost.map((c) => `${c.n} ${c.item}`).join(", ");
}

export function HoldPanel() {
  const holdRev = useGame((s) => s.holdRev);
  const gold = useGame((s) => s.snap.gold);
  const buildings = useGame((s) => s.snap.buildings);
  const pack = useGame((s) => s.snap.player?.pack);
  const armedCivic = useGame((s) => s.buildKind);
  const tillArmed = useGame((s) => s.tillArmed);
  const armBuild = useGame((s) => s.armBuild);
  const armTill = useGame((s) => s.armTill);
  const armHoldPiece = useGame((s) => s.armHoldPiece);
  const reclaimHold = useGame((s) => s.reclaimHold);
  const placed = getWorld().placedObjects;
  void holdRev;
  const hold = getHoldBuild();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof PLACEABLE_CATEGORIES)[number] | "all">("all");
  const pieces = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PLACEABLE_CATALOG.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return p.label.toLowerCase().includes(q) || p.id.includes(q) || p.description.toLowerCase().includes(q);
    });
  }, [query, category]);
  return (
    <div data-testid="hold-panel">
      <h2 className="font-display text-sm text-fg">The Hold</h2>
      <p className="mt-1 text-pretty text-xs leading-relaxed text-muted">
        Timber kit. Search, pick a piece, drag the shade. Gold if it sits, rust if not. Lift to set. Close The Hold and
        the shade leaves without writing the dirt.
      </p>
      <label className="mt-3 block text-xs text-muted">
        Search
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-sm text-fg"
          placeholder="Floor, wall, door…"
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setCategory("all")}
          className={cn("min-h-8 rounded-[var(--radius-xs)] border px-2 text-xs", category === "all" ? "border-border-strong bg-surface-2 text-fg" : "border-border text-muted")}
        >
          All
        </button>
        {PLACEABLE_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn("min-h-8 rounded-[var(--radius-xs)] border px-2 text-xs", category === c ? "border-border-strong bg-surface-2 text-fg" : "border-border text-muted")}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      {hold.definitionId ? (
        <p className="mt-3 text-xs text-fg">
          Selected: {PLACEABLE_BY_ID[hold.definitionId]?.label} — {costLine(hold.definitionId)}
          {hold.reason ? ` · ${hold.reason}` : ""}
        </p>
      ) : null}
      <ul className="mt-3 space-y-1">
        {pieces.map((p) => {
          const need = p.cost[0];
          const have = need ? (pack?.[need.item as keyof typeof pack] as number | undefined) ?? 0 : 0;
          const short = Boolean(need && have < need.n);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => armHoldPiece(p.id)}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between rounded-[var(--radius-xs)] border px-3 text-left",
                  hold.definitionId === p.id ? "border-border-strong bg-surface-2 text-fg" : "border-border bg-surface-2 text-fg",
                  short && "text-muted",
                )}
              >
                <span className="text-sm">{p.label}</span>
                <span className="text-xs text-muted">{costLine(p.id)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {placed.length > 0 ? (
        <div className="mt-4">
          <h3 className="font-display text-xs text-fg">Your pieces</h3>
          <ul className="mt-2 space-y-1">
            {placed.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => reclaimHold(o.id)}
                  className="flex min-h-11 w-full items-center justify-between rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left"
                >
                  <span className="text-sm">{PLACEABLE_BY_ID[o.definitionId]?.label ?? o.definitionId}</span>
                  <span className="text-xs text-muted">Reclaim</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <h3 className="mt-6 font-display text-xs text-fg">Town halls</h3>
      <p className="mt-1 text-pretty text-xs leading-relaxed text-muted">
        One of each civic hall. Till a plot on grass. This is not the kit.
      </p>
      <button
        type="button"
        onClick={() => armTill(!tillArmed)}
        className={cn(
          "mt-3 flex min-h-11 w-full items-center justify-between rounded-[var(--radius-xs)] border px-3 text-left",
          tillArmed ? "border-border-strong bg-surface-2 text-fg" : "border-border bg-surface-2 text-fg",
        )}
      >
        <span className="text-sm">Till a plot</span>
        <span className="text-xs text-muted">{tillArmed ? "Armed" : "Hoe"}</span>
      </button>
      <ul className="mt-3 space-y-1">
        {BUILD_ORDER.map((kind) => {
          const cost = kind === "dormitory" ? 40 : 28;
          const stood = buildings.some((b) => b.kind === kind);
          return (
            <li key={kind}>
              <button
                type="button"
                disabled={stood || gold < cost}
                onClick={() => armBuild(kind)}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between rounded-[var(--radius-xs)] border px-3 text-left",
                  stood ? "border-border bg-surface text-muted" : "border-border bg-surface-2 text-fg",
                  armedCivic === kind && "border-border-strong",
                )}
              >
                <span className="text-sm">{BUILDING_META[kind].label}</span>
                <span className="text-xs text-muted">{stood ? "Stands" : `${cost}g`}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
