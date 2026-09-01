import { AudioLines, Gem, Music2, SunMedium, Trees } from "lucide-react";
import { useWallet } from "@1sat/react";
import { Button } from "@/components/ui/button";
import {
  HORIZON_TREE_REDUCTIONS,
  updateGraphicsSettings,
  useGraphicsSettings,
  type HorizonTreeReduction,
} from "@/game/graphics-settings";
import { musicMuted, toggleValeMusic } from "@/game/vale-music";
import { sfxMuted, toggleSfx } from "@/game/vale-sfx";
import { useGame } from "@/game/store";
import { cn } from "@/lib/utils";
import { useState } from "react";

/** The little room of levers — sound, graphics and the chain wallet, off the dock. */
export function SettingsGump() {
  const open = useGame((s) => s.openSettings);
  if (!open) return null;
  return (
    <div
      className="pointer-events-auto absolute top-3 left-16 z-10 w-72 max-w-[calc(100vw-5rem)] rounded-[var(--radius-lg)] border border-border bg-bg p-4 shadow-2xl"
      role="dialog"
      aria-label="Settings — sound, graphics and the Vault"
    >
      <p className="font-display text-xs tracking-wider text-muted uppercase">The little room of levers</p>
      <div className="mt-3 space-y-1">
        <SoundRow kind="music" />
        <SoundRow kind="sfx" />
      </div>
      <GraphicsSection />
      <VaultRow />
      <CloseRow />
    </div>
  );
}

function SoundRow({ kind }: { kind: "music" | "sfx" }) {
  const [mute, setMute] = useState(kind === "music" ? musicMuted : sfxMuted);
  const Icon = kind === "music" ? Music2 : AudioLines;
  const label = kind === "music" ? "The lute" : "The work";
  const hint = kind === "music" ? "RandomMind, given to the dirt" : "chop, mine, spell";
  return (
    <button
      type="button"
      onClick={() => setMute(kind === "music" ? toggleValeMusic() : toggleSfx())}
      className="flex min-h-11 w-full items-center justify-between rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left"
      aria-pressed={!mute}
      aria-label={`${label}: ${mute ? "off" : "on"}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon className={cn("size-4 shrink-0", mute ? "text-muted/50" : "text-accent")} />
        <span className="min-w-0">
          <span className="block text-sm text-fg">{label}</span>
          <span className="block truncate text-[11px] text-muted">{hint}</span>
        </span>
      </span>
      <span className={cn("text-xs", mute ? "text-muted" : "text-gold")}>{mute ? "Still" : "On"}</span>
    </button>
  );
}

function GraphicsSection() {
  const graphics = useGraphicsSettings();
  return (
    <section className="mt-3 border-t border-border pt-3" aria-labelledby="graphics-heading">
      <p id="graphics-heading" className="mb-1 font-display text-xs tracking-wider text-gold uppercase">
        Graphics
      </p>
      <button
        type="button"
        onClick={() => updateGraphicsSettings({ shadows: !graphics.shadows })}
        className="flex min-h-11 w-full items-center justify-between rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left"
        aria-pressed={graphics.shadows}
        aria-label={`Dynamic shadows: ${graphics.shadows ? "on" : "off"}`}
      >
        <span className="flex items-center gap-2">
          <SunMedium className={cn("size-4", graphics.shadows ? "text-accent" : "text-muted/50")} />
          <span>
            <span className="block text-sm text-fg">Dynamic shadows</span>
            <span className="block text-[11px] text-muted">largest GPU cost</span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className={cn("relative h-5 w-9 rounded-full border transition-colors", graphics.shadows ? "border-accent bg-accent/35" : "border-border-strong bg-bg")}>
            <span className={cn("absolute top-0.5 size-3.5 rounded-full bg-fg transition-transform", graphics.shadows ? "translate-x-4" : "translate-x-0.5")} />
          </span>
          <span className={cn("text-xs", graphics.shadows ? "text-gold" : "text-muted")}>{graphics.shadows ? "On" : "Off"}</span>
        </span>
      </button>

      <div className="mt-1 rounded-[var(--radius-xs)] border border-border bg-surface-2 p-2" role="group" aria-label="Distant tree density">
        <span className="flex items-center gap-2 px-1">
          <Trees className="size-4 text-accent" />
          <span>
            <span className="block text-sm text-fg">Distant trees</span>
            <span className="block text-[11px] text-muted">fewer horizon instances</span>
          </span>
        </span>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {HORIZON_TREE_REDUCTIONS.map((reduction) => (
            <TreeDensityButton
              key={reduction}
              reduction={reduction}
              selected={graphics.horizonTreeReduction === reduction}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function TreeDensityButton({ reduction, selected }: { reduction: HorizonTreeReduction; selected: boolean }) {
  const label = reduction === 0 ? "Full" : `${reduction}% fewer`;
  return (
    <button
      type="button"
      className={cn(
        "h-11 rounded-[var(--radius-xs)] border text-[10px]",
        selected ? "border-accent bg-accent/15 text-gold" : "border-border bg-bg/55 text-muted hover:text-fg",
      )}
      aria-pressed={selected}
      aria-label={`Distant trees: ${reduction === 0 ? "full" : `${reduction}% fewer`}`}
      onClick={() => updateGraphicsSettings({ horizonTreeReduction: reduction })}
    >
      {label}
    </button>
  );
}

function VaultRow() {
  const closeSettings = useGame((s) => s.closeSettings);
  const openVault = useGame((s) => s.openVaultGump);
  const { status } = useWallet();
  const linked = status === "connected";
  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => {
          closeSettings();
          openVault();
        }}
        className="flex min-h-11 w-full items-center justify-between rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Gem className="size-4 shrink-0 text-accent" />
          <span className="min-w-0">
            <span className="block text-sm text-fg">The Vault</span>
            <span className="block truncate text-[11px] text-muted">
              {linked ? "wallet linked — mint, list, redeem" : "link your BSV wallet inside"}
            </span>
          </span>
        </span>
        <span className={cn("text-xs", linked ? "text-gold" : "text-muted")}>{linked ? "Linked" : "Open"}</span>
      </button>
    </div>
  );
}

function CloseRow() {
  const closeSettings = useGame((s) => s.closeSettings);
  return (
    <Button className="mt-3 w-full" variant="ghost" onClick={closeSettings}>
      Close
    </Button>
  );
}
