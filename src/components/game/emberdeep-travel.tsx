import { useGame } from "@/game/store";
import { getWorld } from "@/game/live";
import { EMBERDEEP_ENTRY, EMBERDEEP_EXIT, enterEmberdeep, leaveEmberdeep, inEmberdeep } from "@/game/emberdeep";

export function EmberdeepTravel() {
  const snap = useGame(s => s.snap);
  const panel = useGame(s => s.panel);
  const inside = inEmberdeep(snap.youX, snap.youZ);
  const stair = inside ? EMBERDEEP_EXIT : EMBERDEEP_ENTRY;
  if (panel !== "none" || Math.hypot(snap.youX - stair.tx, snap.youZ - stair.ty) > 3) return null;
  // Band mode (<768px): ride above the combat band — a technique row plus a
  // full six-slot hotbar stand 118px tall, so the card clears them by
  // CHROME_GAP (8px) whether the minimap is open or shut. Desktop keeps
  // bottom-32: its combat band never reaches the card.
  return <div className="pointer-events-auto absolute bottom-32 left-1/2 w-64 max-w-[80vw] -translate-x-1/2 border border-amber-700 bg-stone-950/95 p-3 text-center text-amber-100 shadow-xl max-md:bottom-[calc(var(--corner-clear)+126px)]" data-testid="emberdeep-travel">
    <div className="mb-1 font-serif text-lg">{inside ? "The stair to daylight" : "The Emberdeep"}</div>
    <p className="mb-3 text-xs text-stone-300">{inside ? "Return to the Hollowvein road." : "Old halls beneath the eastern road."}</p>
    <button type="button" className="min-h-11 w-full border border-amber-600 bg-stone-800 px-3 py-2 text-sm hover:bg-stone-700" onClick={() => {
      const err = (inside ? leaveEmberdeep : enterEmberdeep)(getWorld());
      useGame.getState().flash(err ?? (inside ? "The daylight welcomes you." : "You descend into the Emberdeep."));
    }}>{inside ? "Leave the Emberdeep" : "Enter the Emberdeep"}</button>
  </div>;
}
