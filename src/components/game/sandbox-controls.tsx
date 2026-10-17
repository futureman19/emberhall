import { useGame } from "@/game/store";
import { getWorld } from "@/game/live";
import { isSandbox } from "@/game/god";
import { prepareSandbox } from "@/game/sandbox";

function switchMode(on: boolean) {
  const game = useGame.getState();
  // Save before navigating: a failed write leaves this session untouched.
  if (game.phase === "playing" && !game.saveNow()) return;
  const url = new URL(window.location.href);
  url.searchParams.set("god", on ? "1" : "0");
  url.searchParams.set("testkit", "0");
  url.searchParams.set("play", "1");
  window.location.assign(url.href);
}

export function SandboxControls() {
  const phase = useGame(s => s.phase);
  const active = phase === "playing" && isSandbox(getWorld());
  return (
    <section aria-label="Godmode sandbox" className="mt-3 space-y-2 border-t border-border pt-3 text-xs text-muted">
        <p className="font-display text-gold">{active ? "Godmode sandbox" : "Try Godmode"}</p>
        <p>Every catalog item, 999 of every resource stack, all skills at 100 and full mana. Separate save; your normal hall is kept. No Vault or real-value exports.</p>
        <p>Spells use their usual targets and reagents; techniques need their weapon. Unimplemented skills remain placeholders. This is not invulnerability.</p>
        <button type="button" className="min-h-11 w-full rounded border border-gold px-3 text-gold" onClick={() => switchMode(!active)}>
          {active ? "Return to normal hall" : "Enter Godmode sandbox"}
        </button>
        {active && <button type="button" className="min-h-11 w-full rounded border border-border px-3" onClick={() => {
          prepareSandbox(getWorld());
          useGame.getState().saveNow();
          useGame.getState().flash("Sandbox supplies replenished.");
        }}>Replenish sandbox supplies</button>}
    </section>
  );
}
