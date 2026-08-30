import { AudioLines, Gem, Music2 } from "lucide-react";
import { useWallet } from "@1sat/react";
import { Button } from "@/components/ui/button";
import { musicMuted, toggleValeMusic } from "@/game/vale-music";
import { sfxMuted, toggleSfx } from "@/game/vale-sfx";
import { useGame } from "@/game/store";
import { cn } from "@/lib/utils";
import { useState } from "react";

/** The little room of levers — sounds and the chain wallet, off the dock. */
export function SettingsGump() {
  const open = useGame((s) => s.openSettings);
  if (!open) return null;
  return (
    <div
      className="pointer-events-auto absolute top-3 left-16 z-10 w-64 rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4"
      role="dialog"
      aria-label="Settings — sounds and the Vault"
    >
      <p className="font-display text-xs tracking-wider text-muted uppercase">The little room of levers</p>
      <div className="mt-3 space-y-1">
        <SoundRow kind="music" />
        <SoundRow kind="sfx" />
      </div>
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
