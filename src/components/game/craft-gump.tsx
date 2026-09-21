import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ItemGlyph } from "@/components/game/paperdoll";
import { ItemTipContent } from "@/components/game/item-tip";
import { Tip } from "@/components/ui/tip";
import { countTag, hasTag, ITEM_META, tagConsumeOrder } from "@/game/catalog";
import { RECIPES, canMake, maxCraftable, stationsHere, type Recipe, type Station } from "@/game/craft";
import { BOOTS_FORM, BOW_FORM, GAUNTLETS_FORM, GREAVES_FORM, HELM_FORM, MAIL_FORM, SHIELD_FORM, SWORD_FORM } from "@/game/crafting/forms";
import { listResourceInventory } from "@/game/inventory/resources";
import { getWorld } from "@/game/live";
import type { MaterialGrade } from "@/game/resources/types";
import { useGame } from "@/game/store";
import type { ItemId, ResourceStackKey } from "@/game/types";
import { MaterialSelector } from "./crafting/material-selector";
import { WorkmanshipPreview } from "./crafting/workmanship-preview";
import { InlayPanel } from "./crafting/inlay-panel";
import { ConfirmCraft } from "./crafting/confirm-craft";
import { RefiningPanel } from "./crafting/refining-panel";
import { cn } from "@/lib/utils";

type Group = Station | "field";

const TITLE: Record<Group, { title: string; blurb: string }> = {
  bench: { title: "The bench", blurb: "Logs to boards. Then torch, club, crate, staff, cap, shield, bow, cuirass — any wood serves." },
  forge: { title: "The forge", blurb: "Ore to ingot. Then ring, knife, tools, gorget, boots, gauntlets, mace, sword, helm, iron shield, greaves, mail." },
  fire: { title: "The fire", blurb: "Roast meat, bake bread, simmer stew — a campfire of three wood, or a kitchen hearth." },
  field: { title: "In the field", blurb: "A blade in hand. Cloth to bandages, or to hood, gloves, hose, tunic, cloak. Two hides to a leather shirt. Three wood to a campfire. Garlic and ginseng to a heal draught; silk and ash to night sight." },
};

const WORK_TABS = [
  { id: "forms", label: "Forms" },
  { id: "refine", label: "Refine" },
  { id: "inlay", label: "Inlay" },
  { id: "recipes", label: "Recipes" },
] as const;
type WorkTab = (typeof WORK_TABS)[number]["id"];

export function CraftGump() {
  const open = useGame((s) => s.openCraft);
  const close = useGame((s) => s.closeCraft);
  const make = useGame((s) => s.makeRecipe);
  const makeBatch = useGame((s) => s.makeRecipeBatch);
  const makeExact = useGame((s) => s.makeExactRecipe);
  const refine = useGame((s) => s.refineStack);
  const inlayItem = useGame((s) => s.inlayItem);
  const pack = useGame((s) => s.snap.player?.pack);
  const skills = useGame((s) => s.snap.player?.skills);
  const held = useGame((s) => s.snap.player?.wear?.main);
  const x = useGame((s) => s.snap.youX);
  const z = useGame((s) => s.snap.youZ);
  const resources = useGame((s) => s.snap.player?.resources);
  const rares = useGame((s) => s.snap.player?.rares ?? []);
  const [body, setBody] = useState<ResourceStackKey | null>(null);
  const [binding, setBinding] = useState<ResourceStackKey | null>(null);
  const [edge, setEdge] = useState<ResourceStackKey | null>(null);
  const [hilt, setHilt] = useState<ResourceStackKey | null>(null);
  const [swordBinding, setSwordBinding] = useState<ResourceStackKey | null>(null);
  const [plate, setPlate] = useState<ResourceStackKey | null>(null);
  const [frame, setFrame] = useState<ResourceStackKey | null>(null);
  const [shieldBinding, setShieldBinding] = useState<ResourceStackKey | null>(null);
  const [helmPlate, setHelmPlate] = useState<ResourceStackKey | null>(null);
  const [helmLining, setHelmLining] = useState<ResourceStackKey | null>(null);
  const [mailPlate, setMailPlate] = useState<ResourceStackKey | null>(null);
  const [mailLining, setMailLining] = useState<ResourceStackKey | null>(null);
  const [bootsPlate, setBootsPlate] = useState<ResourceStackKey | null>(null);
  const [bootsLining, setBootsLining] = useState<ResourceStackKey | null>(null);
  const [gauntletsPlate, setGauntletsPlate] = useState<ResourceStackKey | null>(null);
  const [gauntletsLining, setGauntletsLining] = useState<ResourceStackKey | null>(null);
  const [greavesPlate, setGreavesPlate] = useState<ResourceStackKey | null>(null);
  const [greavesLining, setGreavesLining] = useState<ResourceStackKey | null>(null);
  const [tab, setTab] = useState<WorkTab>("forms");
  if (!open) return null;
  const here = stationsHere(getWorld());
  void x;
  void z;
  const bladeOk = Boolean(held && hasTag(held, "blade"));
  const resourceRows = listResourceInventory(resources ?? { stacks: {} });
  const bodyRole = BOW_FORM.roles.find(({ role }) => role === "body")!;
  const bindingRole = BOW_FORM.roles.find(({ role }) => role === "binding")!;
  const edgeRole = SWORD_FORM.roles.find(({ role }) => role === "edge")!;
  const hiltRole = SWORD_FORM.roles.find(({ role }) => role === "hilt")!;
  const swordBindingRole = SWORD_FORM.roles.find(({ role }) => role === "binding")!;
  const plateRole = SHIELD_FORM.roles.find(({ role }) => role === "plate")!;
  const frameRole = SHIELD_FORM.roles.find(({ role }) => role === "frame")!;
  const shieldBindingRole = SHIELD_FORM.roles.find(({ role }) => role === "binding")!;
  const helmPlateRole = HELM_FORM.roles.find(({ role }) => role === "plate")!;
  const helmLiningRole = HELM_FORM.roles.find(({ role }) => role === "lining")!;
  const mailPlateRole = MAIL_FORM.roles.find(({ role }) => role === "plate")!;
  const mailLiningRole = MAIL_FORM.roles.find(({ role }) => role === "lining")!;
  const selectedCount = (key: ResourceStackKey | null) => resourceRows.find((row) => row.key === key)?.count ?? 0;
  const bowDisabled = !here.includes("bench")
    ? "Stand at the yard or hall"
    : !body || !binding
      ? "Choose body and binding"
      : selectedCount(body) < bodyRole.amount || selectedCount(binding) < bindingRole.amount
        ? "Not enough selected material"
        : null;
  const swordDisabled = !here.includes("forge")
    ? "Stand at the forge"
    : !edge || !hilt || !swordBinding
      ? "Choose edge, hilt, and binding"
      : selectedCount(edge) < edgeRole.amount || selectedCount(hilt) < hiltRole.amount || selectedCount(swordBinding) < swordBindingRole.amount
        ? "Not enough selected material"
        : null;
  const shieldDisabled = !here.includes("forge")
    ? "Stand at the forge"
    : !plate || !frame || !shieldBinding
      ? "Choose plates, frame, and binding"
      : selectedCount(plate) < plateRole.amount || selectedCount(frame) < frameRole.amount || selectedCount(shieldBinding) < shieldBindingRole.amount
        ? "Not enough selected material"
        : null;
  const helmDisabled = !here.includes("forge")
    ? "Stand at the forge"
    : !helmPlate || !helmLining
      ? "Choose plates and lining"
      : selectedCount(helmPlate) < helmPlateRole.amount || selectedCount(helmLining) < helmLiningRole.amount
        ? "Not enough selected material"
        : null;
  const mailDisabled = !here.includes("forge")
    ? "Stand at the forge"
    : !mailPlate || !mailLining
      ? "Choose plates and lining"
      : selectedCount(mailPlate) < mailPlateRole.amount || selectedCount(mailLining) < mailLiningRole.amount
        ? "Not enough selected material"
        : null;
  const groups: Group[] = ["bench", "forge", "fire", "field"];
  return (
    <div className="pointer-events-auto absolute top-16 right-3 max-h-[min(70vh,36rem)] w-[min(100%-1.5rem,22rem)] overflow-auto rounded-[var(--radius-lg)] border border-border bg-bg/92 p-4 sm:right-4">
      <p className="font-display text-sm text-fg">Work</p>
      <p className="mt-2 text-pretty text-xs leading-relaxed text-muted">
        Wood at the yard. Iron at a forge. A blade anywhere. The work takes, or it splits.
      </p>
      <div role="tablist" aria-label="Work sections" className="mt-3 flex gap-1">
        {WORK_TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "min-h-11 flex-1 rounded-[var(--radius-xs)] border px-2 text-xs font-medium",
              tab === id ? "border-gold/60 bg-gold/10 text-gold" : "border-border bg-surface text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "forms" && (
      <>
      <div className="mt-4 space-y-2" aria-label="Advanced bow work">
        <p className="font-display text-xs tracking-wider text-gold uppercase">Form · Bow</p>
        <MaterialSelector role={bodyRole} rows={resourceRows} selected={body} onSelect={setBody} group="bow-body" />
        <MaterialSelector role={bindingRole} rows={resourceRows} selected={binding} onSelect={setBinding} group="bow-binding" />
        <WorkmanshipPreview
          skill={skills?.carpentry ?? 0}
          difficulty={18}
          primaryGrade={body ? (body.split(":")[2] as MaterialGrade) : undefined}
        />
        <ConfirmCraft
          selected={{ body, binding }}
          rows={resourceRows}
          disabledReason={bowDisabled}
          formLabel="bow"
          onConfirm={() => body && binding && makeExact("bow", [
            { role: "body", key: body },
            { role: "binding", key: binding },
          ])}
        />
      </div>
      <div className="mt-2 space-y-2" aria-label="Advanced sword work">
        <p className="font-display text-xs tracking-wider text-gold uppercase">Form · Sword</p>
        <MaterialSelector role={edgeRole} rows={resourceRows} selected={edge} onSelect={setEdge} group="sword-edge" />
        <MaterialSelector role={hiltRole} rows={resourceRows} selected={hilt} onSelect={setHilt} group="sword-hilt" />
        <MaterialSelector role={swordBindingRole} rows={resourceRows} selected={swordBinding} onSelect={setSwordBinding} group="sword-binding" />
        <WorkmanshipPreview
          skill={skills?.smithing ?? 0}
          difficulty={20}
          primaryGrade={edge ? (edge.split(":")[2] as MaterialGrade) : undefined}
        />
        <ConfirmCraft
          selected={{ edge, hilt, binding: swordBinding }}
          rows={resourceRows}
          disabledReason={swordDisabled}
          formLabel="sword"
          onConfirm={() => edge && hilt && swordBinding && makeExact("sword", [
            { role: "edge", key: edge },
            { role: "hilt", key: hilt },
            { role: "binding", key: swordBinding },
          ])}
        />
      </div>
      <div className="mt-2 space-y-2" aria-label="Advanced shield work">
        <p className="font-display text-xs tracking-wider text-gold uppercase">Form · Shield</p>
        <MaterialSelector role={plateRole} rows={resourceRows} selected={plate} onSelect={setPlate} group="shield-plate" />
        <MaterialSelector role={frameRole} rows={resourceRows} selected={frame} onSelect={setFrame} group="shield-frame" />
        <MaterialSelector role={shieldBindingRole} rows={resourceRows} selected={shieldBinding} onSelect={setShieldBinding} group="shield-binding" />
        <WorkmanshipPreview
          skill={skills?.smithing ?? 0}
          difficulty={21}
          primaryGrade={plate ? (plate.split(":")[2] as MaterialGrade) : undefined}
        />
        <ConfirmCraft
          selected={{ plate, frame, binding: shieldBinding }}
          rows={resourceRows}
          disabledReason={shieldDisabled}
          formLabel="shield"
          onConfirm={() => plate && frame && shieldBinding && makeExact("shield", [
            { role: "plate", key: plate },
            { role: "frame", key: frame },
            { role: "binding", key: shieldBinding },
          ])}
        />
      </div>
      <div className="mt-2 space-y-2" aria-label="Advanced helm work">
        <p className="font-display text-xs tracking-wider text-gold uppercase">Form · Helm</p>
        <MaterialSelector role={helmPlateRole} rows={resourceRows} selected={helmPlate} onSelect={setHelmPlate} group="helm-plate" />
        <MaterialSelector role={helmLiningRole} rows={resourceRows} selected={helmLining} onSelect={setHelmLining} group="helm-lining" />
        <WorkmanshipPreview
          skill={skills?.smithing ?? 0}
          difficulty={24}
          primaryGrade={helmPlate ? (helmPlate.split(":")[2] as MaterialGrade) : undefined}
        />
        <ConfirmCraft
          selected={{ plate: helmPlate, lining: helmLining }}
          rows={resourceRows}
          disabledReason={helmDisabled}
          formLabel="helm"
          onConfirm={() => helmPlate && helmLining && makeExact("helm", [
            { role: "plate", key: helmPlate },
            { role: "lining", key: helmLining },
          ])}
        />
      </div>
      <div className="mt-2 space-y-2" aria-label="Advanced mail work">
        <p className="font-display text-xs tracking-wider text-gold uppercase">Form · Mail</p>
        <MaterialSelector role={mailPlateRole} rows={resourceRows} selected={mailPlate} onSelect={setMailPlate} group="mail-plate" />
        <MaterialSelector role={mailLiningRole} rows={resourceRows} selected={mailLining} onSelect={setMailLining} group="mail-lining" />
        <WorkmanshipPreview
          skill={skills?.smithing ?? 0}
          difficulty={30}
          primaryGrade={mailPlate ? (mailPlate.split(":")[2] as MaterialGrade) : undefined}
        />
        <ConfirmCraft
          selected={{ plate: mailPlate, lining: mailLining }}
          rows={resourceRows}
          disabledReason={mailDisabled}
          formLabel="mail"
          onConfirm={() => mailPlate && mailLining && makeExact("mail", [
            { role: "plate", key: mailPlate },
            { role: "lining", key: mailLining },
          ])}
        />
      </div>
      {[
        { form: BOOTS_FORM, label: "boots", diff: 15, plate: bootsPlate, setPlate: setBootsPlate, lining: bootsLining, setLining: setBootsLining },
        { form: GAUNTLETS_FORM, label: "gauntlets", diff: 18, plate: gauntletsPlate, setPlate: setGauntletsPlate, lining: gauntletsLining, setLining: setGauntletsLining },
        { form: GREAVES_FORM, label: "greaves", diff: 27, plate: greavesPlate, setPlate: setGreavesPlate, lining: greavesLining, setLining: setGreavesLining },
      ].map(({ form, label, diff, plate: piecePlate, setPlate, lining: pieceLining, setLining }) => {
        const plateRole = form.roles.find(({ role }) => role === "plate")!;
        const liningRole = form.roles.find(({ role }) => role === "lining")!;
        const disabled = !here.includes("forge")
          ? "Stand at the forge"
          : !piecePlate || !pieceLining
            ? "Choose plates and lining"
            : selectedCount(piecePlate) < plateRole.amount || selectedCount(pieceLining) < liningRole.amount
              ? "Not enough selected material"
              : null;
        return (
          <div key={form.id} className="mt-2 space-y-2" aria-label={`Advanced ${label} work`}>
            <p className="font-display text-xs tracking-wider text-gold uppercase">Form · {form.label}</p>
            <MaterialSelector role={plateRole} rows={resourceRows} selected={piecePlate} onSelect={setPlate} group={`${label}-plate`} />
            <MaterialSelector role={liningRole} rows={resourceRows} selected={pieceLining} onSelect={setLining} group={`${label}-lining`} />
            <WorkmanshipPreview
              skill={skills?.smithing ?? 0}
              difficulty={diff}
              primaryGrade={piecePlate ? (piecePlate.split(":")[2] as MaterialGrade) : undefined}
            />
            <ConfirmCraft
              selected={{ plate: piecePlate, lining: pieceLining }}
              rows={resourceRows}
              disabledReason={disabled}
              formLabel={label}
              onConfirm={() => piecePlate && pieceLining && makeExact(form.id, [
                { role: "plate", key: piecePlate },
                { role: "lining", key: pieceLining },
              ])}
            />
          </div>
        );
      })}
      </>
      )}
      {tab === "refine" && (
        <div className="mt-4 space-y-4">
          {(["bench", "forge"] as const).map((st) => (
            <RefiningPanel
              key={st}
              rows={resourceRows}
              station={st}
              atStation={here.includes(st)}
              skill={st === "forge" ? (skills?.smithing ?? 0) : (skills?.carpentry ?? 0)}
              onRefine={refine}
            />
          ))}
        </div>
      )}
      {tab === "inlay" && (
        <div className="mt-4">
          <InlayPanel items={rares} rows={resourceRows} onInlay={inlayItem} />
        </div>
      )}
      {tab === "recipes" && groups.map((st) => {
        const at = st === "field" ? true : here.includes(st);
        const list = st === "field"
          ? RECIPES.filter((r) => r.station === null && !r.exactRecipeId)
          : RECIPES.filter((r) => r.station === st && !r.exactRecipeId);
        if (st === "field" && list.length === 0) return null;
        return (
          <div key={st} className="mt-4">
            <p className="font-display text-xs tracking-wider text-muted uppercase">{TITLE[st].title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{at ? TITLE[st].blurb : st === "forge" ? "Raise a forge, then stand by the fire." : "Stand in the yard, or the hall."}</p>
            <ul className="mt-2 space-y-1">
              {list.map((r) => (
                <li key={r.id}>
                  <RecipeRow
                    rec={r}
                    at={at}
                    pack={pack}
                    skill={skills?.[r.skill] ?? 0}
                    bladeOk={bladeOk}
                    max={maxCraftable(getWorld(), r)}
                    onMake={() => make(r.id)}
                    onMakeBatch={(times) => makeBatch(r.id, times)}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <Button className="mt-3 w-full" variant="secondary" onClick={close}>
        Close
      </Button>
    </div>
  );
}

function RecipeRow({
  rec,
  at,
  pack,
  skill,
  bladeOk,
  max,
  onMake,
  onMakeBatch,
}: {
  rec: Recipe;
  at: boolean;
  pack?: Record<string, number>;
  skill: number;
  bladeOk: boolean;
  max: number;
  onMake: () => void;
  onMakeBatch: (times: number) => void;
}) {
  const ready = at && canMake(getWorld(), rec) && (!rec.needsBlade || bladeOk);
  const product = (Object.keys(rec.give) as ItemId[]).find((k) => (rec.give[k] ?? 0) > 0);
  return (
    <div
      className={cn(
        "flex min-h-11 w-full flex-col items-stretch rounded-[var(--radius-xs)] border border-border bg-surface-2 px-3 py-2 text-left",
        !ready && "opacity-60",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <Tip content={product ? <ItemTipContent id={product} /> : null} side="bottom">
          <span className="text-sm text-fg underline decoration-dotted decoration-border-strong underline-offset-2">{rec.label}</span>
        </Tip>
        <span className="flex items-center gap-1">
          <button
            type="button"
            disabled={!ready}
            onClick={onMake}
            className="min-h-8 rounded-[var(--radius-xs)] border border-border bg-bg px-2 text-xs text-fg disabled:opacity-50"
          >
            Make
          </button>
          <button
            type="button"
            disabled={!ready || max < 5}
            onClick={() => onMakeBatch(5)}
            className="min-h-8 rounded-[var(--radius-xs)] border border-border bg-bg px-2 text-xs text-fg disabled:opacity-50"
          >
            ×5
          </button>
          <button
            type="button"
            disabled={!ready || max < 2}
            onClick={() => onMakeBatch(max)}
            className="min-h-8 rounded-[var(--radius-xs)] border border-border bg-bg px-2 text-xs text-fg disabled:opacity-50"
          >
            Max{max > 1 ? ` ${max}` : ""}
          </button>
          <span className="ml-1 font-display text-xs tracking-wider text-muted uppercase">{Math.round(skill)}</span>
        </span>
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-1">
        {Object.entries(rec.need).map(([k, n]) => (
          <Tip key={k} content={<ItemTipContent id={k as ItemId} />} side="bottom">
            <span className="flex items-center gap-0.5 text-xs text-muted">
              <ItemGlyph id={k as ItemId} className="size-3.5" />
              {n} {ITEM_META[k as ItemId].label}
              <span className="text-muted">({pack?.[k as ItemId] ?? 0})</span>
            </span>
          </Tip>
        ))}
        {(rec.needTags ?? []).map((nt) => (
          <Tip
            key={nt.tag}
            side="bottom"
            content={
              <span className="block text-[11px] text-muted">
                anything tagged <span className="italic text-fg">{nt.tag}</span> — {tagConsumeOrder(nt.tag).slice(0, 5).map((id) => ITEM_META[id].label.toLowerCase()).join(", ")}
                {tagConsumeOrder(nt.tag).length > 5 ? "…" : ""}
              </span>
            }
          >
            <span className="flex items-center gap-0.5 text-xs text-muted">
              {nt.n} <span className="italic">{nt.tag}</span>
              <span className="text-muted">({countTag(pack, nt.tag)})</span>
            </span>
          </Tip>
        ))}
        {rec.needsBlade ? <span className={cn("text-xs", bladeOk ? "text-muted" : "text-accent")}>+ a blade in hand</span> : null}
      </span>
      <span className="mt-1 text-xs text-muted">{rec.hint}</span>
    </div>
  );
}
