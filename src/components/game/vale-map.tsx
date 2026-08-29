import { CHUNK, MAP, PLACES } from "@/game/atlas";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";
import { commandWalk } from "@/game/player";

export function ValeChart() {
  const seenRev = useGame((s) => s.snap.seenRev);
  const x = useGame((s) => s.snap.youX);
  const z = useGame((s) => s.snap.youZ);
  const corpse = useGame((s) => s.snap.player?.corpseAt ?? null);
  const flash = useGame((s) => s.flash);
  const w = getWorld();
  const size = 220;
  const s = size / MAP;
  return (
    <div>
      <h2 className="font-display text-sm text-fg">The vale</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">Tap a name to walk. Fog hides what you have not seen.</p>
      <svg viewBox={`0 0 ${size} ${size}`} className="mt-3 w-full rounded-[var(--radius-md)] border border-border bg-surface">
        {Object.keys(w.seen).map((k) => {
          const [cx, cy] = k.split(",").map(Number);
          return (
            <rect
              key={k + seenRev}
              x={(cx ?? 0) * CHUNK * s}
              y={(cy ?? 0) * CHUNK * s}
              width={CHUNK * s}
              height={CHUNK * s}
              fill="var(--color-surface-2)"
            />
          );
        })}
        {PLACES.map((p) => (
          <g key={p.id}>
            <circle cx={p.tx * s} cy={p.ty * s} r={2.2} fill="var(--color-gold)" />
            <text
              x={p.tx * s + 4}
              y={p.ty * s - 2}
              fill="var(--color-fg)"
              fontSize="7"
              className="cursor-pointer"
              onClick={() => {
                const err = commandWalk(w, p.tx, p.ty);
                if (err) flash(err);
              }}
            >
              {p.name}
            </text>
          </g>
        ))}
        {corpse && (
          <circle
            cx={corpse.tx * s}
            cy={corpse.ty * s}
            r={4}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.4"
            className="cursor-pointer"
            onClick={() => {
              const err = commandWalk(w, corpse.tx, corpse.ty);
              if (err) flash(err);
            }}
          />
        )}
        <circle cx={x * s} cy={z * s} r={3} fill="var(--color-accent)" />
      </svg>
    </div>
  );
}
