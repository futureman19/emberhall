import { create } from "zustand";
import { commandTravel } from "./gates.ts";
import { commandCraft, commandCraftBatch, craftReach, stationOf } from "./craft.ts";
import { commandHarvest, commandPlant, commandTill, commandWorkPlot, plotAt } from "./farm.ts";
import { getWorld, resetWorld, setWorld, snapshot } from "./live.ts";
import { commandCast, forgetMark, SPELL_META, hasBook } from "./magery.ts";
import type { CastTarget } from "./magery.ts";
import {
  commandApproach,
  commandBankItem,
  commandBuy,
  commandDeposit,
  commandSell,
  commandSellRare,
  commandTalk,
  commandUnbankItem,
  commandWithdraw,
} from "./npcs.ts";
import {
  commandChop,
  commandCook,
  commandDrop,
  commandEat,
  commandEquip,
  commandEquipRare,
  commandFeed,
  commandFollow,
  commandHeal,
  commandHunt,
  commandLoot,
  commandMine,
  commandRelease,
  commandSkin,
  commandStay,
  commandTame,
  commandUnequip,
  commandWalk,
  you,
} from "./player.ts";
import { commandNamePet } from "./pets.ts";
import { takeFromPile, takeGoldFromPile } from "./piles.ts";
import { clearSave, hasSave, loadSave, writeSave } from "./save.ts";
import { recruitPerson, setSpeed, tickWorld } from "./sim.ts";
import { completeObjective, placeBuilding } from "./world.ts";
import { COURT, stationNear } from "./atlas.ts";
import type { BuildingKind, CtxTarget, CtxVerb, ItemId, PanelId, Speed, SpellId, Snapshot, WearSlot } from "./types.ts";
import { applyMint, applyMintRare, applyRedeem } from "./vault.ts";

export type Phase = "title" | "raising" | "playing";

interface GameUI {
  phase: Phase;
  snap: Snapshot;
  selectedId: string | null;
  panel: PanelId;
  ctx: { x: number; y: number; target: CtxTarget } | null;
  toast: string | null;
  openBook: boolean;
  openCraft: boolean;
  openVault: boolean;
  openPets: boolean;
  /** Pet id the companions panel should open in rename mode, if any. */
  renamePetId: string | null;
  openPileId: string | null;
  openGateId: string | null;
  gateIgnoreId: string | null;
  buildKind: BuildingKind | null;
  buildAt: { tx: number; ty: number } | null;
  tillArmed: boolean;
  tillAt: { tx: number; ty: number } | null;
  loadNote: string;
  loadProgress: number;
  loadTitle: string;
  begin: (fresh?: boolean) => void;
  tick: (dt: number) => void;
  flash: (msg: string) => void;
  select: (id: string | null) => void;
  setPanel: (p: PanelId) => void;
  useTile: (tx: number, ty: number) => void;
  hunt: (id: string) => void;
  stayPet: (id: string) => void;
  followPet: (id: string) => void;
  releasePet: (id: string) => void;
  feedPet: (id: string) => void;
  doVerb: (verb: CtxVerb, t: CtxTarget) => void;
  openCtx: (x: number, y: number, t: CtxTarget) => void;
  closeCtx: () => void;
  drop: (item: ItemId) => void;
  equip: (item: ItemId) => void;
  equipRare: (uid: string) => void;
  unequip: (slot: WearSlot) => void;
  heal: () => void;
  cook: () => void;
  eat: () => void;
  talk: (id: string) => void;
  buy: (item: ItemId) => void;
  sell: (item: ItemId) => void;
  sellRare: (uid: string) => void;
  deposit: (n: number) => void;
  withdraw: (n: number) => void;
  bankItem: (item: ItemId) => void;
  unbankItem: (item: ItemId) => void;
  openPile: (id: string) => void;
  takePile: (id: string, item?: ItemId) => void;
  takePileGold: (id: string) => void;
  travel: (destId: string) => void;
  closeGate: () => void;
  openBookGump: () => void;
  closeBook: () => void;
  openCraftGump: () => void;
  closeCraft: () => void;
  openVaultGump: () => void;
  closeVault: () => void;
  openPetsGump: () => void;
  closePets: () => void;
  /** Open the companions panel, optionally with one pet in rename mode. */
  openPetRename: (id: string | null) => void;
  namePet: (id: string, name: string) => void;
  /** Chain mint confirmed — remove the item from the pack and re-snapshot. */
  mintApplied: (item: ItemId) => void;
  /** Chain mint confirmed — remove the rare from the keeping and re-snapshot. */
  mintRareApplied: (uid: string) => void;
  /** Chain burn confirmed — return the item (or the rare, with its affixes) and re-snapshot. */
  redeemApplied: (item: ItemId, rare?: { name: string; affixes: string[]; maker?: string }) => void;
  makeRecipe: (id: string) => void;
  makeRecipeBatch: (id: string, times: number) => void;
  useStation: (id: string) => void;
  cast: (spell: SpellId, target?: CastTarget) => void;
  forgetMark: (id: string) => void;
  recruit: (id: string) => void;
  speed: (s: Speed) => void;
  armBuild: (kind: BuildingKind | null) => void;
  hoverBuild: (tx: number, ty: number) => void;
  armTill: (on: boolean) => void;
  hoverTill: (tx: number, ty: number) => void;
}

let uiAcc = 0;
let saveAcc = 0;
let toastTimer = 0;
/** Identity of the world-log line the toast bridge has already seen. */
let lastLogTop: string | null = null;
let buildHeld = false;

export function dropBuildHold() {
  buildHeld = false;
}

export function markBuildHold() {
  buildHeld = true;
}

export function takeBuildHold() {
  const held = buildHeld;
  buildHeld = false;
  return held;
}

export const useGame = create<GameUI>((set, get) => ({
  phase: "title",
  snap: snapshot(),
  selectedId: null,
  panel: "none",
  ctx: null,
  toast: null,
  openBook: false,
  openCraft: false,
  openVault: false,
  openPets: false,
  renamePetId: null,
  openPileId: null,
  openGateId: null,
  gateIgnoreId: null,
  buildKind: null,
  buildAt: null,
  tillArmed: false,
  tillAt: null,
  loadNote: "The dirt is listening.",
  loadProgress: 0,
  loadTitle: "Raising the vale",
  begin: (fresh = false) => {
    if (get().phase === "raising") return;
    const started = performance.now();
    set({
      phase: "raising",
      toast: null,
      loadTitle: fresh ? "Raising the vale" : "Opening the hall",
      loadNote: fresh ? "The dirt is listening." : "The vale is waiting.",
      loadProgress: 0.12,
    });
    const paint = () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    void (async () => {
      try {
        await paint();
        await wait(140);
        set({
          loadNote: fresh ? "Laying the hills." : "Reading what you left.",
          loadProgress: 0.34,
        });
        await wait(50);
        if (fresh) {
          clearSave();
          resetWorld();
        } else {
          const loaded = loadSave();
          if (loaded) setWorld(loaded);
          else resetWorld();
        }
        set({ loadNote: "Raising the hall.", loadProgress: 0.72 });
        await paint();
        getWorld().speed = 1;
        set({ loadNote: "The door is open.", loadProgress: 1 });
        const left = 1100 - (performance.now() - started);
        if (left > 0) await wait(left);
        lastLogTop = null; // a fresh world — its history must not toast
        set({
          phase: "playing",
          selectedId: null,
          buildKind: null,
          buildAt: null,
          panel: "help",
          ctx: null,
          openPileId: null,
          openGateId: null,
          gateIgnoreId: null,
          openBook: false,
          openCraft: false,
          openVault: false,
          openPets: false,
          renamePetId: null,
          snap: snapshot(),
        });
      } catch (err) {
        console.error("[emberhall] begin failed", err);
        set({ phase: "title", toast: "Could not open the hall.", loadProgress: 0 });
      }
    })();
  },
  tick: (dt) => {
    const w = getWorld();
    const wasGhost = Boolean(w.player.ghost);
    tickWorld(w, dt);
    if (!wasGhost && w.player.ghost) {
      toastTimer = 0;
      set({ toast: "You are a ghost." });
    }
    // The notice bridge — every result the sim writes to the log (the chop
    // lands, the seed takes, the ore splits, the work sings) also surfaces
    // as a toast. Immediate rejects already flash; this covers the outcomes.
    const top = w.log[0];
    if (top) {
      const topKey = `${top.t}:${top.text}`;
      if (lastLogTop === null) {
        lastLogTop = topKey; // first tick after a load — history stays history
      } else if (topKey !== lastLogTop) {
        const fresh: string[] = [];
        for (const line of w.log) {
          if (`${line.t}:${line.text}` === lastLogTop) break;
          fresh.push(line.text);
          if (fresh.length >= 3) break;
        }
        fresh.reverse();
        lastLogTop = topKey;
        toastTimer = 0;
        set({ toast: fresh.join(" · ") });
      }
    }
    uiAcc += dt;
    saveAcc += dt;
    if (get().toast) {
      toastTimer += dt;
      if (toastTimer > 3.2) {
        toastTimer = 0;
        set({ toast: null });
      }
    }
    if (uiAcc > 0.12) {
      uiAcc = 0;
      const extra: Partial<GameUI> = { snap: snapshot() };
      const self = you(w);
      if (self && get().phase === "playing") {
        const st = stationNear(self.x, self.z, 0.9);
        if (st) {
          if (!get().openGateId && get().gateIgnoreId !== st.id && w.hour >= (w.player.gateCoolUntil ?? 0)) {
            extra.openGateId = st.id;
            extra.panel = "none";
            extra.selectedId = null;
            extra.ctx = null;
            extra.openPileId = null;
          }
        } else if (get().gateIgnoreId) extra.gateIgnoreId = null;
      }
      set(extra);
    }
    if (saveAcc > 8) {
      saveAcc = 0;
      if (get().phase === "playing") writeSave(w);
    }
  },
  flash: (msg) => {
    toastTimer = 0;
    set({ toast: msg, snap: snapshot() });
  },
  select: (id) => {
    set({ selectedId: id, ctx: null });
    if (!id) return;
    const w = getWorld();
    const p = w.people.find((x) => x.id === id);
    if (p?.role) {
      const err = commandApproach(w, id);
      if (err) get().flash(err);
      set({ snap: snapshot(), selectedId: id, panel: "none" });
    }
  },
  setPanel: (p) => {
    const next = p === get().panel ? "none" : p;
    set({ panel: next, ctx: null, openBook: next === "none" ? get().openBook : false, openCraft: next === "none" ? get().openCraft : false });
  },
  useTile: (tx, ty) => {
    const w = getWorld();
    if (w.player.ghost) {
      const err = commandWalk(w, tx, ty);
      if (err) get().flash(err);
      set({ snap: snapshot(), ctx: null });
      return;
    }
    if (get().buildKind) {
      const kind = get().buildKind;
      if (!kind) return;
      const err = placeBuilding(w, kind, tx, ty);
      if (err) {
        get().flash(err);
        set({ snap: snapshot(), ctx: null, buildAt: { tx, ty } });
        return;
      }
      get().flash(`The ${kind} is raised.`);
      set({ buildKind: null, buildAt: null, snap: snapshot(), ctx: null, panel: "none" });
      return;
    }
    if (get().tillArmed) {
      if (plotAt(w, tx, ty)) {
        const err = commandWorkPlot(w, tx, ty);
        if (err) get().flash(err);
        set({ snap: snapshot(), ctx: null, tillAt: { tx, ty } });
        return;
      }
      const err = commandTill(w, tx, ty);
      if (err) get().flash(err);
      set({ snap: snapshot(), ctx: null, tillAt: { tx, ty } });
      return;
    }
    if (w.player.armedSpell === "teleport") {
      const err = commandCast(w, "teleport", { kind: "tile", tx, ty });
      if (err) get().flash(err);
      else get().flash(SPELL_META.teleport.words);
      set({ snap: snapshot(), ctx: null, openBook: false });
      return;
    }
    if (w.player.armedSpell) {
      w.player.armedSpell = null;
      get().flash("The words fade.");
    }
    const t = w.tiles[ty]?.[tx];
    let err: string | null = null;
    if (plotAt(w, tx, ty)) err = commandWorkPlot(w, tx, ty);
    else if (t?.kind === "tree") err = commandChop(w, tx, ty);
    else if (t?.kind === "rock") err = commandMine(w, tx, ty);
    else err = commandWalk(w, tx, ty);
    if (err) get().flash(err);
    set({ snap: snapshot(), ctx: null });
  },
  hunt: (id) => {
    const w = getWorld();
    if (w.player.armedSpell === "magicarrow" || w.player.armedSpell === "fireball") {
      const err = commandCast(w, w.player.armedSpell, { kind: "fauna", id });
      if (err) get().flash(err);
      else get().flash(SPELL_META[w.player.armedSpell].words);
      set({ selectedId: id, snap: snapshot(), ctx: null, openBook: false });
      return;
    }
    const err = commandHunt(w, id);
    if (err) get().flash(err);
    set({ selectedId: id, snap: snapshot(), ctx: null });
  },
  stayPet: (id) => {
    const err = commandStay(getWorld(), id);
    if (err) get().flash(err);
    else set({ snap: snapshot(), ctx: null });
  },
  followPet: (id) => {
    const err = commandFollow(getWorld(), id);
    if (err) get().flash(err);
    else set({ snap: snapshot(), ctx: null });
  },
  releasePet: (id) => {
    const err = commandRelease(getWorld(), id);
    if (err) get().flash(err);
    else set({ selectedId: null, snap: snapshot(), ctx: null });
  },
  feedPet: (id) => {
    const err = commandFeed(getWorld(), id);
    if (err) get().flash(err);
    else set({ snap: snapshot(), ctx: null });
  },
  doVerb: (verb, t) => {
    const w = getWorld();
    let err: string | null = null;
    if (verb === "walk") err = commandWalk(w, t.tx, t.ty);
    else if (verb === "chop") err = commandChop(w, t.tx, t.ty);
    else if (verb === "mine") err = commandMine(w, t.tx, t.ty);
    else if (verb === "hunt" && t.kind === "fauna") err = commandHunt(w, t.id);
    else if (verb === "skin" && t.kind === "fauna") err = commandSkin(w, t.id);
    else if (verb === "loot") err = commandLoot(w, t.id);
    else if (verb === "talk" && t.kind === "person") err = commandTalk(w, t.id);
    else if (verb === "tame" && t.kind === "fauna") err = commandTame(w, t.id);
    else if (verb === "stay" && t.kind === "fauna") err = commandStay(w, t.id);
    else if (verb === "follow" && t.kind === "fauna") err = commandFollow(w, t.id);
    else if (verb === "release" && t.kind === "fauna") err = commandRelease(w, t.id);
    else if (verb === "feed" && t.kind === "fauna") err = commandFeed(w, t.id);
    else if (verb === "name" && t.kind === "fauna") {
      get().openPetRename(t.id);
      return;
    }
    else if (verb === "fireball" && t.kind === "fauna") err = commandCast(w, "fireball", { kind: "fauna", id: t.id });
    else if (verb === "cast" && t.kind === "fauna") err = commandCast(w, "magicarrow", { kind: "fauna", id: t.id });
    else if (verb === "teleport") err = commandCast(w, "teleport", { kind: "tile", tx: t.tx, ty: t.ty });
    else if (verb === "enter") {
      const st = stationNear(t.tx, t.ty, 1.2);
      if (st) set({ openGateId: st.id, ctx: null });
    } else if (verb === "roster") {
      get().setPanel("roster");
      set({ ctx: null });
      return;
    } else if (verb === "use") get().useStation(t.id);
    else if (verb === "harvest") err = commandHarvest(w, t.tx, t.ty);
    else if (verb === "till") err = commandTill(w, t.tx, t.ty);
    else if (verb === "sowCabbage") err = commandPlant(w, t.tx, t.ty, "cabbage");
    else if (verb === "sowWheat") err = commandPlant(w, t.tx, t.ty, "wheat");
    else if (verb === "sowGarlic") err = commandPlant(w, t.tx, t.ty, "garlic");
    if (err) get().flash(err);
    set({ ctx: null, snap: snapshot() });
  },
  openCtx: (x, y, t) => set({ ctx: { x, y, target: t } }),
  closeCtx: () => set({ ctx: null }),
  drop: (item) => {
    const err = commandDrop(getWorld(), item);
    if (err) get().flash(err);
    set({ snap: snapshot() });
  },
  equip: (item) => {
    if (item === "spellbook") {
      get().openBookGump();
      return;
    }
    const err = commandEquip(getWorld(), item);
    if (err) get().flash(err);
    set({ snap: snapshot() });
  },
  equipRare: (uid) => {
    const err = commandEquipRare(getWorld(), uid);
    if (err) get().flash(err);
    set({ snap: snapshot() });
  },
  unequip: (slot) => {
    const err = commandUnequip(getWorld(), slot);
    if (err) get().flash(err);
    set({ snap: snapshot() });
  },
  heal: () => {
    const err = commandHeal(getWorld());
    if (err) get().flash(err);
    set({ snap: snapshot() });
  },
  cook: () => {
    const err = commandCook(getWorld());
    if (err) get().flash(err);
    set({ snap: snapshot() });
  },
  eat: () => {
    const err = commandEat(getWorld());
    if (err) get().flash(err);
    set({ snap: snapshot() });
  },
  talk: (id) => {
    const err = commandTalk(getWorld(), id);
    if (err) get().flash(err);
    set({ snap: snapshot() });
  },
  buy: (item) => {
    const err = commandBuy(getWorld(), item);
    if (err) get().flash(err);
    set({ snap: snapshot() });
  },
  sell: (item) => {
    const err = commandSell(getWorld(), item);
    if (err) get().flash(err);
    set({ snap: snapshot() });
  },
  sellRare: (uid) => {
    const err = commandSellRare(getWorld(), uid);
    if (err) get().flash(err);
    set({ snap: snapshot() });
  },
  deposit: (n) => {
    const err = commandDeposit(getWorld(), n);
    if (err) get().flash(err);
    set({ snap: snapshot() });
  },
  withdraw: (n) => {
    const err = commandWithdraw(getWorld(), n);
    if (err) get().flash(err);
    set({ snap: snapshot() });
  },
  bankItem: (item) => {
    const err = commandBankItem(getWorld(), item);
    if (err) get().flash(err);
    set({ snap: snapshot() });
  },
  unbankItem: (item) => {
    const err = commandUnbankItem(getWorld(), item);
    if (err) get().flash(err);
    set({ snap: snapshot() });
  },
  openPile: (id) => set({ openPileId: id, selectedId: null, ctx: null, panel: "none", snap: snapshot() }),
  takePile: (id, item) => {
    const err = takeFromPile(getWorld(), id, item);
    if (err) get().flash(err);
    const pile = getWorld().piles.find((p) => p.id === id);
    set({ snap: snapshot(), openPileId: pile ? id : null });
  },
  takePileGold: (id) => {
    const taken = takeGoldFromPile(getWorld(), id);
    if (taken > 0) get().flash(`${taken} gold.`);
    const pile = getWorld().piles.find((p) => p.id === id);
    set({ snap: snapshot(), openPileId: pile ? id : null });
  },
  travel: (destId) => {
    const err = commandTravel(getWorld(), destId);
    if (err) get().flash(err);
    set({ openGateId: null, gateIgnoreId: destId, ctx: null, snap: snapshot() });
  },
  closeGate: () => {
    const id = get().openGateId;
    set({ openGateId: null, gateIgnoreId: id });
  },
  openBookGump: () => {
    const w = getWorld();
    if (w.player.ghost) {
      get().flash("The dead have no words.");
      return;
    }
    if (!hasBook(w)) {
      get().flash("You need a spellbook.");
      return;
    }
    completeObjective(w, "book");
    set({ openBook: true, openCraft: false, openVault: false, panel: "none", ctx: null, selectedId: null, openPileId: null, snap: snapshot() });
  },
  closeBook: () => set({ openBook: false }),
  openCraftGump: () => {
    const w = getWorld();
    if (w.player.ghost) {
      get().flash("A ghost cannot.");
      return;
    }
    set({ openCraft: true, openBook: false, openVault: false, panel: "none", ctx: null, selectedId: null, openPileId: null, snap: snapshot() });
  },
  closeCraft: () => set({ openCraft: false }),
  openVaultGump: () => {
    const w = getWorld();
    if (w.player.ghost) {
      get().flash("A ghost cannot.");
      return;
    }
    set({ openVault: true, openBook: false, openCraft: false, panel: "none", ctx: null, selectedId: null, openPileId: null, snap: snapshot() });
  },
  closeVault: () => set({ openVault: false }),
  openPetsGump: () => {
    set({ openPets: true, renamePetId: null, openBook: false, openCraft: false, openVault: false, panel: "none", ctx: null, snap: snapshot() });
  },
  closePets: () => set({ openPets: false, renamePetId: null }),
  openPetRename: (id) => {
    set({ openPets: true, renamePetId: id, openBook: false, openCraft: false, openVault: false, panel: "none", ctx: null, snap: snapshot() });
  },
  namePet: (id, name) => {
    const err = commandNamePet(getWorld(), id, name);
    if (err && err.startsWith("It is not")) get().flash(err);
    set({ renamePetId: null, snap: snapshot() });
  },
  mintApplied: (item) => {
    const note = applyMint(getWorld(), item);
    if (note) get().flash(note);
    set({ snap: snapshot() });
  },
  mintRareApplied: (uid) => {
    const note = applyMintRare(getWorld(), uid);
    if (note) get().flash(note);
    set({ snap: snapshot() });
  },
  redeemApplied: (item, rare) => {
    const note = applyRedeem(getWorld(), item, rare);
    get().flash(note);
    set({ snap: snapshot() });
  },
  makeRecipe: (id) => {
    const err = commandCraft(getWorld(), id);
    if (err) get().flash(err);
    set({ snap: snapshot() });
  },
  makeRecipeBatch: (id, times) => {
    const err = commandCraftBatch(getWorld(), id, times);
    if (err) get().flash(err);
    set({ snap: snapshot() });
  },
  useStation: (id) => {
    const w = getWorld();
    if (w.player.ghost) {
      get().flash("A ghost cannot.");
      return;
    }
    const b = w.buildings.find((x) => x.id === id);
    if (!b || !stationOf(b.kind)) {
      get().flash("No work here.");
      set({ ctx: null });
      return;
    }
    const p = you(w);
    if (!p) return;
    const reach = craftReach(b.kind);
    if (Math.hypot(p.x - b.tx, p.z - b.ty) > reach) {
      const err = commandWalk(w, b.tx, b.ty);
      if (err) get().flash(err);
      else get().flash(b.kind === "forge" ? "The fire is that way." : "The bench is that way.");
      set({ ctx: null, snap: snapshot() });
      return;
    }
    get().openCraftGump();
  },
  cast: (spell, target) => {
    const w = getWorld();
    const err = commandCast(w, spell, target);
    if (err) get().flash(err);
    else get().flash(SPELL_META[spell].words);
    const arm = err === "Click a beast." || err === "Click the ground.";
    const folded = spell === "recall" && !err;
    const stay = spell === "mark" || (Boolean(err) && !arm && !folded);
    set({ openBook: arm || folded ? false : stay ? true : get().openBook, ctx: null, snap: snapshot() });
  },
  forgetMark: (id) => {
    const err = forgetMark(getWorld(), id);
    get().flash(err);
    set({ snap: snapshot() });
  },
  recruit: (id) => {
    const err = recruitPerson(getWorld(), id);
    if (err) get().flash(err);
    else set({ snap: snapshot(), selectedId: id });
  },
  speed: (s) => {
    setSpeed(getWorld(), s);
    set({ snap: snapshot() });
  },
  armBuild: (kind) => {
    if (kind && getWorld().player.ghost) {
      get().flash("A ghost cannot.");
      return;
    }
    dropBuildHold();
    let at: { tx: number; ty: number } | null = null;
    if (kind) {
      const p = you(getWorld());
      if (p) {
        at = {
          tx: Math.round(p.x + Math.sin(p.facing) * 6),
          ty: Math.round(p.z + Math.cos(p.facing) * 6),
        };
      } else at = { tx: COURT.tx, ty: COURT.ty + 8 };
      get().flash("Drag the shade. Lift to raise.");
    }
    set({ buildKind: kind, buildAt: at, tillArmed: false, tillAt: null, panel: "none", ctx: null, openBook: false, openCraft: false });
  },
  hoverBuild: (tx, ty) => {
    if (!get().buildKind) return;
    const at = get().buildAt;
    if (at && at.tx === tx && at.ty === ty) return;
    set({ buildAt: { tx, ty } });
  },
  armTill: (on) => {
    dropBuildHold();
    if (!on) {
      set({ tillArmed: false, tillAt: null });
      return;
    }
    const w = getWorld();
    if (w.player.ghost) {
      get().flash("A ghost cannot.");
      return;
    }
    if (w.player.wear.main !== "hoe") {
      get().flash("Hold a hoe — tap it in You.");
      return;
    }
    const p = you(w);
    const at = p
      ? { tx: Math.round(p.x + Math.sin(p.facing) * 3), ty: Math.round(p.z + Math.cos(p.facing) * 3) }
      : { tx: COURT.tx, ty: COURT.ty + 6 };
    get().flash("Click grass or dirt. The hoe makes a bed.");
    set({ tillArmed: true, tillAt: at, buildKind: null, buildAt: null, panel: "none", ctx: null, openBook: false, openCraft: false });
  },
  hoverTill: (tx, ty) => {
    if (!get().tillArmed) return;
    const at = get().tillAt;
    if (at && at.tx === tx && at.ty === ty) return;
    set({ tillAt: { tx, ty } });
  },
}));

export { hasSave };
