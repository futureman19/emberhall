import { maxMana } from "@/game/magery";
import { useGame } from "@/game/store";
import { cn } from "@/lib/utils";

/**
 * Vitals as Direland/Diablo-style globes flanking the combat cluster: a
 * glass sphere whose fill drains from the top. Accessibility parity with the
 * old meter strips — each orb is a labelled meter.
 */
function Orb({
  value,
  max,
  label,
  fillClass,
  className,
  testid,
}: {
  value: number;
  max: number;
  label: string;
  fillClass: string;
  className?: string;
  testid: string;
}) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  // Fill level: the liquid's surface y in the 64×64 viewBox (r=26 globe at 32,32).
  const surfaceY = 32 + 26 - pct * 52;
  return (
    <div
      data-testid={testid}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      title={`${label} ${value}/${max}`}
      className={cn("hud-glass pointer-events-auto relative size-12 overflow-hidden rounded-full md:size-14", className)}
    >
      <svg viewBox="0 0 64 64" className="size-full" aria-hidden focusable="false">
        <clipPath id={`orb-clip-${testid}`}>
          <circle cx="32" cy="32" r="26" />
        </clipPath>
        <g clipPath={`url(#orb-clip-${testid})`}>
          <rect x="0" y={surfaceY} width="64" height={64 - surfaceY} className={fillClass} />
          {/* liquid surface glint */}
          <ellipse cx="32" cy={surfaceY} rx="26" ry="3" fill="currentColor" opacity={0.25} className={fillClass} />
        </g>
        {/* glass dome highlight */}
        <ellipse cx="24" cy="18" rx="10" ry="6" fill="white" opacity={0.18} />
        <circle cx="32" cy="32" r="26" fill="none" stroke="white" strokeOpacity={0.22} strokeWidth="1.5" />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold text-white tabular-nums [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
        {value}
      </span>
    </div>
  );
}

/** Health globe — left flank of the combat cluster. */
export function HealthOrb({ className }: { className?: string }) {
  const snap = useGame((s) => s.snap);
  const self = snap.people.find((p) => p.isPlayer);
  const ghost = Boolean(self?.ghost || snap.player?.ghost);
  const hp = ghost ? 0 : Math.round(self?.hp ?? 0);
  return <Orb testid="orb-health" label="Health" value={hp} max={self?.maxHp ?? 1} fillClass="fill-health text-health" className={className} />;
}

/** Mana globe — right flank of the combat cluster. */
export function ManaOrb({ className }: { className?: string }) {
  const snap = useGame((s) => s.snap);
  const self = snap.people.find((p) => p.isPlayer);
  const max = maxMana(self?.int ?? 8, snap.player?.skills.magery ?? 0);
  return <Orb testid="orb-mana" label="Mana" value={Math.round(snap.player?.mana ?? 0)} max={max} fillClass="fill-mana text-mana" className={className} />;
}
