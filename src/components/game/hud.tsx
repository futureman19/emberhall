import {
  AudioLines,
  Backpack,
  CircleHelp,
  FastForward,
  Hammer,
  Anvil,
  Music2,
  Pause,
  Play,
  ScrollText,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContextMenu, PileGump } from "@/components/game/context-menu";
import { GateGump } from "@/components/game/gate-gump";
import { NpcGump } from "@/components/game/npc-gump";
import { YouDressing } from "@/components/game/paperdoll";
import { SpellbookGump } from "@/components/game/spell-gump";
import { CraftGump } from "@/components/game/craft-gump";
import { VaultGump } from "@/components/game/vault-gump";
import { SettingsGump } from "@/components/game/settings-gump";
import { PetsGump } from "@/components/game/pets-gump";
import { ValeChart, MiniVale } from "@/components/game/vale-map";
import { insideLabel } from "@/components/game/building-meshes";
import { PLACES, regionAt } from "@/game/atlas";
import { BUILD_ORDER, BUILDING_META, CLASS_META } from "@/game/catalog";
import { phaseName } from "@/game/gates";
import { getWorld } from "@/game/live";
import { maxMana } from "@/game/magery";
import { nearestHealer } from "@/game/player";
import { hasSave as hallHasSave } from "@/game/save";
import { IntroCinematic } from "@/components/game/intro-cinematic";
import { LookGump } from "@/components/game/look-gump";
import { startValeMusic, musicMuted, toggleValeMusic } from "@/game/vale-music";
import { sfxMuted, toggleSfx, warmSfx } from "@/game/vale-sfx";
import { useGame } from "@/game/store";
import type { PanelId, Speed } from "@/game/types";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

function clockLabel(clock: number, day: number) {
  const h = Math.floor(clock) % 24;
  const m = Math.floor((clock % 1) * 60);
  return `Day ${day}  ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function Hud() {
  const phase = useGame((s) => s.phase);
  const introDone = useGame((s) => s.introDone);
  const lookDone = useGame((s) => s.lookDone);
  useEffect(() => {
    if (phase === "playing" || phase === "raising") startValeMusic();
  }, [phase]);
  if (phase === "title") return <TitleOverlay />;
  if (phase === "raising") return <RaisingOverlay />;
  if (phase === "intro") return <IntroCinematic onDone={introDone} />;
  if (phase === "looking") return <LookGump onDone={lookDone} />;
  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      <PlayingChrome />
    </div>
  );
}

function PlayingChrome() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    window.addEventListener("contextmenu", block);
    return () => window.removeEventListener("contextmenu", block);
  }, []);
  return (
    <>
      <TopBar />
      <BottomDock />
      <SidePanel />
      <SelectedCard />
      <PileGump />
      <GateGump />
      <NpcGump />
      <SpellbookGump />
      <CraftGump />
      <VaultGump />
      <SettingsGump />
      <PetsGump />
      <Toast />
      <GhostBanner />
      <BuildRibbon />
      <TravelRibbon />
      <Minimap />
      <ContextMenu />
    </>
  );
}

let startLock = 0;
function startHall(fresh: boolean) {
  const now = Date.now();
  if (now - startLock < 500) return;
  startLock = now;
  startValeMusic();
  warmSfx();
  useGame.getState().begin(fresh);
}

function TitleOverlay() {
  const [hasSave, setHasSave] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setHasSave(hallHasSave());
  }, []);
  useEffect(() => {
    const onDoc = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const hit = el.closest("[data-start]") as HTMLElement | null;
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      setBusy(true);
      startHall(hit.getAttribute("data-start") === "new");
    };
    document.addEventListener("click", onDoc, true);
    document.addEventListener("pointerdown", onDoc, true);
    return () => {
      document.removeEventListener("click", onDoc, true);
      document.removeEventListener("pointerdown", onDoc, true);
    };
  }, []);
  const go = (fresh: boolean) => {
    if (busy) return;
    setBusy(true);
    startHall(fresh);
  };
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-t from-bg via-bg/55 to-bg/15 p-4 pb-28">
      <div className="w-full max-w-md rounded-[var(--radius-xl)] border border-border bg-bg/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <p className="font-display text-xs tracking-[0.28em] text-muted uppercase">The vale remembers</p>
        <h1 className="mt-2 font-display text-4xl font-medium tracking-[0.08em] text-balance text-fg">Emberhall</h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted">
          You walk a country, not a yard. Dirt from Ridgewatch to Brinegate. Click the ground — or a name on the map —
          and walk. Skills rise by using them. The woods do not wait.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {hasSave && (
            <button
              type="button"
              data-start="continue"
              disabled={busy}
              className="h-14 w-full rounded-[var(--radius-md)] bg-accent text-base font-medium text-accent-fg"
              onClick={() => go(false)}
            >
              {busy ? "Opening…" : "Continue"}
            </button>
          )}
          <button
            type="button"
            data-start="new"
            disabled={busy}
            className={
              hasSave
                ? "h-14 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface-2 text-base font-medium text-fg"
                : "h-14 w-full rounded-[var(--radius-md)] bg-accent text-base font-medium text-accent-fg"
            }
            onClick={() => go(true)}
          >
            {busy ? "Raising…" : "New hall"}
          </button>
          <SoundToggles className="mt-3 justify-center" />
        </div>
      </div>
    </div>
  );
}

function RaisingOverlay() {
  const title = useGame((s) => s.loadTitle);
  const note = useGame((s) => s.loadNote);
  const progress = useGame((s) => s.loadProgress);
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg p-4" role="status" aria-live="polite" aria-busy="true">
      <div className="w-full max-w-md rounded-[var(--radius-xl)] border border-border bg-surface p-6">
        <p className="font-display text-xs tracking-[0.28em] text-muted uppercase">The dirt remembers</p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-[0.08em] text-fg">{title}</h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted">{note}</p>
        <div className="relative mt-6 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full origin-left bg-accent transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${Math.max(0.08, Math.min(1, progress))})` }}
          />
          <div className="ember-shimmer pointer-events-none absolute inset-y-0 w-1/3 bg-fg/20" />
        </div>
      </div>
    </div>
  );
}

function TopBar() {
  const snap = useGame((s) => s.snap);
  const self = snap.people.find((p) => p.isPlayer);
  const max = maxMana(self?.int ?? 8, snap.player?.skills.magery ?? 0);
  const ghost = Boolean(self?.ghost || snap.player?.ghost);
  const hp = ghost ? 0 : self ? self.hp / self.maxHp : 0;
  const mana = (snap.player?.mana ?? 0) / max;
  const inside = insideLabel(snap.buildings, snap.youX, snap.youZ);
  const panel = useGame((s) => s.panel);
  const setPanel = useGame((s) => s.setPanel);
  const speed = useGame((s) => s.speed);
  const cur = useGame((s) => s.snap.speed);
  return (
    <div className="pointer-events-none absolute top-3 right-3 left-3 flex items-start justify-between gap-3">
      <div className="flex flex-col items-start gap-1.5">
        <div className="min-w-0 rounded-[var(--radius-md)] border border-border bg-bg/80 px-3 py-2">
          <button
            type="button"
            onClick={() => setPanel("vale")}
            className="pointer-events-auto block max-w-48 truncate text-left font-display text-xs tracking-wider text-gold uppercase hover:text-fg"
            aria-label="Open the vale map"
            title="The chart of the vale"
          >
            {inside ? BUILDING_META[inside].label : snap.region}
          </button>
          <p className="text-xs text-muted tabular-nums">
            {ghost ? "Ghost" : clockLabel(snap.clock, snap.day)} · {phaseName(snap.hour)} · {snap.weather.label}
          </p>
          <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-accent" style={{ width: `${Math.max(0, Math.min(1, hp)) * 100}%` }} />
          </div>
          <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-gold" style={{ width: `${Math.max(0, Math.min(1, mana)) * 100}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPanel("you")}
          className={cn(
            "pointer-events-auto relative z-10 grid size-11 place-items-center rounded-[var(--radius-md)] border border-border bg-bg/80 text-muted",
            panel === "you" && "bg-surface-2 text-fg",
          )}
          aria-label="You — pack, paperdoll, skills"
        >
          <Backpack className="size-4" />
        </button>
        <SettingsButton />
      </div>
      <div className="flex items-start gap-1.5">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-[var(--radius-md)] border border-border bg-bg/80 p-1">
          <button
            type="button"
            onClick={() => speed((cur === 0 ? 1 : 0) as Speed)}
            className="grid size-9 place-items-center rounded-[var(--radius-xs)] text-muted hover:text-fg"
            aria-label={cur === 0 ? "Resume time" : "Pause time"}
          >
            {cur === 0 ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => speed(cur === 3 ? 1 : 3)}
            className={cn("grid size-9 place-items-center rounded-[var(--radius-xs)] hover:text-fg", cur === 3 ? "text-accent" : "text-muted")}
            aria-label={cur === 3 ? "Normal time" : "Faster time"}
          >
            <FastForward className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsButton() {
  const open = useGame((s) => s.openSettings);
  const toggleSettings = useGame((s) => s.toggleSettings);
  return (
    <button
      type="button"
      onClick={toggleSettings}
      className={cn(
        "pointer-events-auto relative z-10 grid size-11 place-items-center rounded-[var(--radius-md)] border border-border bg-bg/80 text-muted",
        open && "bg-surface-2 text-fg",
      )}
      aria-label="Settings — sounds and the Vault"
      aria-expanded={open}
    >
      <Settings className="size-4" />
    </button>
  );
}

function BottomDock() {
  const panel = useGame((s) => s.panel);
  const setPanel = useGame((s) => s.setPanel);
  const openBook = useGame((s) => s.openBookGump);
  const openCraft = useGame((s) => s.openCraftGump);
  const items: { id: PanelId; icon: typeof CircleHelp; label: string }[] = [
    { id: "help", icon: CircleHelp, label: "Guide" },
    { id: "build", icon: Hammer, label: "Hold" },
  ];
  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-[var(--radius-lg)] border border-border bg-bg/90 p-1">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => setPanel(it.id)}
            className={cn(
              "grid size-11 place-items-center rounded-[var(--radius-md)] text-muted",
              panel === it.id && "bg-surface-2 text-fg",
            )}
            aria-label={it.label}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
      <button type="button" onClick={openBook} className="grid size-11 place-items-center rounded-[var(--radius-md)] text-accent" aria-label="Spellbook">
        <ScrollText className="size-4" />
      </button>
      <button type="button" onClick={openCraft} className="grid size-11 place-items-center rounded-[var(--radius-md)] text-gold" aria-label="Work">
        <Anvil className="size-4" />
      </button>
    </div>
  );
}

function SoundToggles({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <MusicToggle />
      <SfxToggle />
    </div>
  );
}

function MusicToggle() {
  const [mute, setMute] = useState(musicMuted);
  return (
    <button
      type="button"
      onClick={() => setMute(toggleValeMusic())}
      className={cn("grid size-11 place-items-center text-muted", mute && "opacity-40")}
      aria-label={mute ? "Music off" : "Music on"}
      aria-pressed={!mute}
      title={mute ? "Music is still" : "Still the lute"}
    >
      <Music2 className="size-4" />
    </button>
  );
}

function SfxToggle() {
  const [mute, setMute] = useState(sfxMuted);
  return (
    <button
      type="button"
      onClick={() => setMute(toggleSfx())}
      className={cn("grid size-11 place-items-center text-muted", mute && "opacity-40")}
      aria-label={mute ? "Sounds off" : "Sounds on"}
      aria-pressed={!mute}
      title={mute ? "Work sounds are still" : "Still the chop and the spell"}
    >
      <AudioLines className="size-4" />
    </button>
  );
}

function SidePanel() {
  const panel = useGame((s) => s.panel);
  if (panel === "none") return null;
  return (
    <div className="pointer-events-auto absolute top-16 bottom-20 left-16 w-[min(100%-5rem,22rem)] overflow-auto rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4">
      {panel === "help" && <GuideTabs />}
      {panel === "you" && <YouDressing />}
      {panel === "journal" && <JournalPanel />}
      {panel === "vale" && <ValeChart />}
      {panel === "roster" && <RosterPanel />}
      {panel === "build" && <HoldPanel />}
    </div>
  );
}

/** One reading lamp, three pages — the Guide, the Journal, and the Roster. */
function GuideTabs() {
  const [tab, setTab] = useState<"guide" | "journal" | "roster">("guide");
  const tabs = [
    { id: "guide" as const, label: "Guide" },
    { id: "journal" as const, label: "Journal" },
    { id: "roster" as const, label: "Roster" },
  ];
  return (
    <div>
      <div className="flex gap-1" role="tablist" aria-label="Reading pages">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "min-h-9 flex-1 rounded-[var(--radius-xs)] border px-2 text-xs",
              tab === t.id ? "border-border-strong bg-surface-2 text-fg" : "border-border bg-surface text-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-3">
        {tab === "guide" && <HelpPanel />}
        {tab === "journal" && <JournalPanel />}
        {tab === "roster" && <RosterPanel />}
      </div>
    </div>
  );
}

function HelpPanel() {
  const objectives = useGame((s) => s.snap.objectives);
  return (
    <div>
      <h2 className="font-display text-sm text-fg">The vale is a country</h2>
      <p className="mt-2 text-pretty text-xs leading-relaxed text-muted">
        Click the ground to walk. Click a tree to chop, stone to mine, a beast to hunt. Right-click a live beast and Tame
        — hares yield, wolves rarely do. Open You for the paperdoll. Tap a hatchet, pick, hoe, or sword in the pack — it
        sits in your Hand. Tap the Hand to put it away. Chop needs the hatchet held. Mine needs the pick. Farm needs the
        hoe. The book in the pack is magery. Open it. Right-click a tamed beast and Care opens its loyalty and whereabouts.
        Mark writes this dirt on a rune. Walk off. Tap the mark — Recall folds you back. The moons still hold. Towns keep
        a banker, a healer, a stall. Die and you walk pale — Ione at the hall can return you. Your corpse keeps what it
        took until you come back living. Right-click the hall to read the roster — who has joined, who might. Open
        Hold to raise timber on the dirt — dorm, kitchen, forge, tavern. Walk
        through a door and the roof goes thin so you can see the room. The yard saws logs into boards. Raise a forge —
        Hold, then the dirt — to smelt ore and beat iron. Raise a farm the same way — eight beds inside a fence. Or open
        Hold and Till a plot on grass. Walk a bed. Click it to sow a seed — cabbage, wheat, garlic. Wait. Click ripe
        green to take the crop and more seed. Farming is a skill. Eat cabbage from You.
        Eight stone rings hold the moons. Walk into the
        swirl east of the steps. North of Oakstand the height goes to snow. Wolfhollow is pine and wolf. Hearthfen is peat
        marsh. Southmere is warm thick green. Brinegate is salt and sand. The hall stays green. Tap your region's name up
        top for the chart — or a town — and you walk there.
      </p>
      <p className="mt-3 text-pretty text-xs leading-relaxed text-muted">
        A lute in the air — RandomMind, given to the dirt. The note stills the lute. The lines still the chop, the mine, the spell.
      </p>
      <ul className="mt-4 space-y-2">
        {objectives.map((o) => (
          <li key={o.id} className="flex items-start gap-2 text-sm">
            <span className={cn("mt-1 size-2 shrink-0 rounded-full", o.done ? "bg-accent" : "border border-border-strong")} />
            <span className={cn("text-fg", o.done && "text-muted line-through")}>{o.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function JournalPanel() {
  const log = useGame((s) => s.snap.log);
  return (
    <div>
      <h2 className="font-display text-sm text-fg">Journal</h2>
      <ul className="mt-3 space-y-2">
        {log.map((l, i) => (
          <li key={i} className="text-pretty text-sm leading-relaxed text-muted">
            {l.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RosterPanel() {
  const people = useGame((s) => s.snap.people);
  const recruit = useGame((s) => s.recruit);
  const select = useGame((s) => s.select);
  return (
    <div>
      <h2 className="font-display text-sm text-fg">Roster</h2>
      <ul className="mt-3 space-y-1">
        {people
          .filter((p) => !p.role)
          .map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => (p.member || p.isPlayer ? select(p.id) : recruit(p.id))}
                className="flex min-h-11 w-full items-center justify-between rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 text-left"
              >
                <span className="text-sm text-fg">{p.name}</span>
                <span className="text-xs text-muted">{p.isPlayer ? "You" : p.member ? CLASS_META[p.cls].label : "Recruit"}</span>
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}

function HoldPanel() {
  const gold = useGame((s) => s.snap.gold);
  const buildings = useGame((s) => s.snap.buildings);
  const armed = useGame((s) => s.buildKind);
  const tillArmed = useGame((s) => s.tillArmed);
  const armBuild = useGame((s) => s.armBuild);
  const armTill = useGame((s) => s.armTill);
  return (
    <div>
      <h2 className="font-display text-sm text-fg">The hold</h2>
      <p className="mt-1 text-pretty text-xs leading-relaxed text-muted">
        Timber cubes, red cloth, gold lintels. Pick a building, then drag the shade on the dirt. Gold if it sits, rust
        if the ground is taken. Lift to raise. One of each. The forge is the fire for ore. The farm is eight beds and a
        fence. Till a plot on any grass — the hoe cuts a framed bed. Sow seed. Wait. Take.
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
                  armed === kind && "border-border-strong",
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

function SelectedCard() {
  const id = useGame((s) => s.selectedId);
  const people = useGame((s) => s.snap.people);
  const fauna = useGame((s) => s.snap.fauna);
  const p = people.find((x) => x.id === id);
  const c = fauna.find((x) => x.id === id);
  if (!p && !c) return null;
  if (p?.role) return null;
  return (
    <div className="pointer-events-auto absolute right-3 bottom-20 w-52 rounded-[var(--radius-md)] border border-border bg-bg/90 p-3">
      <p className="font-display text-sm text-fg">{p?.name ?? c?.kind}</p>
      <p className="text-xs text-muted">{p ? CLASS_META[p.cls].label : c?.task}</p>
    </div>
  );
}

function GhostBanner() {
  const ghost = useGame((s) => Boolean(s.snap.player?.ghost || s.snap.people.find((p) => p.isPlayer)?.ghost));
  const corpse = useGame((s) => s.snap.player?.corpseAt ?? null);
  const x = useGame((s) => s.snap.youX);
  const z = useGame((s) => s.snap.youZ);
  const walkTile = useGame((s) => s.useTile);
  if (!ghost) return null;
  const dist = corpse ? Math.round(Math.hypot(corpse.tx - x, corpse.ty - z)) : 0;
  const place = corpse ? regionAt(corpse.tx, corpse.ty).name : "";
  return (
    <div className="pointer-events-auto absolute bottom-20 left-1/2 w-[min(100%-1.5rem,24rem)] -translate-x-1/2 rounded-[var(--radius-md)] border border-border bg-bg/92 p-3">
      <p className="text-center font-display text-sm text-fg">You are a ghost.</p>
      <p className="mt-1 text-center text-pretty text-xs leading-relaxed text-muted">
        {corpse
          ? `Your body lies ${dist} pace${dist === 1 ? "" : "s"} toward ${place}. A healer can return you.`
          : "Your body is gone. A healer can still return you."}
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          className="flex-1"
          variant="secondary"
          onClick={() => {
            const h = nearestHealer(getWorld());
            if (h) walkTile(Math.round(h.x), Math.round(h.z));
          }}
        >
          Walk to healer
        </Button>
        {corpse && (
          <Button className="flex-1" variant="secondary" onClick={() => walkTile(corpse.tx, corpse.ty)}>
            Walk to body
          </Button>
        )}
      </div>
    </div>
  );
}

function Toast() {
  const toast = useGame((s) => s.toast);
  if (!toast) return null;
  return (
    <p className="pointer-events-none absolute bottom-48 left-1/2 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-[var(--radius-md)] border border-border bg-bg/90 px-4 py-2 text-center font-display text-sm text-fg sm:top-24 sm:bottom-auto">
      {toast}
    </p>
  );
}

function BuildRibbon() {
  const kind = useGame((s) => s.buildKind);
  const till = useGame((s) => s.tillArmed);
  const armBuild = useGame((s) => s.armBuild);
  const armTill = useGame((s) => s.armTill);
  if (till) {
    return (
      <div className="pointer-events-auto absolute top-20 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-bg/90 px-3 py-1">
        <p className="font-display text-xs tracking-wider text-fg uppercase">Till a plot · click grass or dirt</p>
        <button type="button" className="text-xs text-muted" onClick={() => armTill(false)}>
          Cancel
        </button>
      </div>
    );
  }
  if (!kind) return null;
  return (
    <div className="pointer-events-auto absolute top-20 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-bg/90 px-3 py-1">
      <p className="font-display text-xs tracking-wider text-fg uppercase">Raise {BUILDING_META[kind].label} · drag the shade, lift to raise</p>
      <button type="button" className="text-xs text-muted" onClick={() => armBuild(null)}>
        Cancel
      </button>
    </div>
  );
}

function TravelRibbon() {
  const n = useGame((s) => s.snap.youPath);
  const intent = useGame((s) => s.snap.player?.intent);
  const armed = useGame((s) => s.snap.player?.armedSpell);
  if (armed === "magicarrow") {
    return (
      <p className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 rounded-[var(--radius-md)] border border-border bg-bg/80 px-3 py-1 font-display text-xs tracking-wider text-fg uppercase">
        Magic Arrow · click a beast
      </p>
    );
  }
  if (armed === "fireball") {
    return (
      <p className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 rounded-[var(--radius-md)] border border-border bg-bg/80 px-3 py-1 font-display text-xs tracking-wider text-fg uppercase">
        Fireball · click a beast
      </p>
    );
  }
  if (armed === "teleport") {
    return (
      <p className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 rounded-[var(--radius-md)] border border-border bg-bg/80 px-3 py-1 font-display text-xs tracking-wider text-fg uppercase">
        Teleport · click the ground
      </p>
    );
  }
  if (!intent || intent.kind === "none" || n < 8) return null;
  const dest = PLACES.reduce(
    (best, p) => {
      const d = Math.hypot(p.tx - intent.tx, p.ty - intent.ty);
      return d < best.d ? { p, d } : best;
    },
    { p: PLACES[0]!, d: Infinity },
  );
  const name = dest.d < 16 ? dest.p.name : "the road";
  return (
    <p className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 rounded-[var(--radius-md)] border border-border bg-bg/80 px-3 py-1 font-display text-xs tracking-wider text-fg uppercase">
      {name} · {n} paces
    </p>
  );
}

function Minimap() {
  const panel = useGame((s) => s.panel);
  const openBook = useGame((s) => s.openBook);
  const openCraft = useGame((s) => s.openCraft);
  if (panel === "vale" || openBook || openCraft) return null;
  return (
    <div className="pointer-events-auto absolute right-3 bottom-20">
      <MiniVale />
    </div>
  );
}
