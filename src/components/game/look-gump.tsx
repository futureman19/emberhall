// The Looking Glass — Emberhall's character setup, spoken in the game's voice.
// Three steps: a name, a calling, a reflection. Purely presentational: the
// host receives one LookChoice and decides what to persist (wiring lands
// after the crafting gate; see the character-customization plan, Phase 2).
import { useMemo, useState } from "react";
import { CLASS_META } from "@/game/catalog";
import { GARB_TINTS, HAIR_COLORS, HAIR_STYLES, SKIN_TONES, type Swatch } from "@/game/look/catalog.ts";
import { listParts, partsById, savePart } from "@/game/look/parts.ts";
import { resolveLook } from "@/game/look/resolve.ts";
import { LOOK_SCHEMA, type HairStyleId, type LookRecipeV1 } from "@/game/look/types.ts";
import { personName } from "@/game/names";
import type { ClassId } from "@/game/types";
import { LookPreview } from "./look-preview";
import { PartSculptor } from "./part-sculptor";

export interface LookChoice {
  name: string;
  cls: ClassId;
  look: LookRecipeV1;
}

const ROLE_HINT: Record<ClassId, string> = {
  ranger: "Walks the treeline; reads the weather.",
  warrior: "Stands between trouble and the door.",
  mage: "Keeps a flame in the palm.",
  rogue: "Finds what others miss.",
  merchant: "Knows what everything is worth.",
};

const STEPS = ["A name", "A calling", "A reflection"] as const;
const CLASSES = Object.keys(CLASS_META) as ClassId[];

function SwatchRow({
  title,
  swatches,
  value,
  onPick,
  testid,
}: {
  title: string;
  swatches: readonly Swatch[];
  value: string;
  onPick: (hex: string) => void;
  testid: string;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs tracking-[0.2em] uppercase" style={{ color: "#8a8680" }}>
        {title}
      </div>
      <div className="flex flex-wrap gap-2">
        {swatches.map((s) => (
          <button
            key={s.id}
            type="button"
            title={s.label}
            data-testid={`${testid}-${s.id}`}
            onClick={() => onPick(s.hex)}
            className="h-8 w-8 rounded-sm border transition-transform hover:scale-110"
            style={{
              background: s.hex,
              borderColor: value === s.hex ? "#e8b96a" : "#3a322c",
              boxShadow: value === s.hex ? "0 0 10px rgba(232,185,106,0.5)" : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function LookGump({ onDone }: { onDone: (choice: LookChoice) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(() => personName(Math.random));
  const [cls, setCls] = useState<ClassId>("ranger");
  const [skin, setSkin] = useState("#c9c3b6");
  const [hairStyle, setHairStyle] = useState<HairStyleId>("crop");
  const [hairColor, setHairColor] = useState("#3a322c");
  const [garb, setGarb] = useState("#a85a42");
  const [partIds, setPartIds] = useState<string[]>([]);
  const [sculpting, setSculpting] = useState(false);
  const [craftVersion, setCraftVersion] = useState(0);

  const preview = useMemo(
    () => resolveLook({ schema: LOOK_SCHEMA, skin, hairStyle, hairColor, garb }),
    [skin, hairStyle, hairColor, garb],
  );
  const crafted = useMemo(() => listParts(), [craftVersion]);
  const wornParts = useMemo(() => partsById(partIds), [partIds, craftVersion]);
  const trimmed = name.trim();
  const last = step === STEPS.length - 1;

  const finish = () =>
    onDone({
      name: trimmed,
      cls,
      look: { schema: LOOK_SCHEMA, cls, skin, hairStyle, hairColor, garb, parts: partIds.length ? partIds : undefined },
    });

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" data-testid="look-gump">
      <div
        className="flex w-full max-w-3xl gap-6 rounded-md border p-6"
        style={{ background: "rgba(20,17,14,0.94)", borderColor: "#3a322c" }}
      >
        {/* the mirror — always watching */}
        <div className="hidden w-56 shrink-0 flex-col sm:flex">
          <div className="flex-1 rounded-sm border" style={{ borderColor: "#2e241c", background: "#181410" }}>
            <LookPreview look={preview} parts={wornParts} />
          </div>
          <div className="mt-3 text-center">
            <div className="font-serif text-lg" style={{ color: "#ece6d8" }}>{trimmed || "…"}</div>
            <div className="text-xs" style={{ color: CLASS_META[cls].color }}>{CLASS_META[cls].label}</div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="text-xs tracking-[0.3em] uppercase" style={{ color: "#c9a36a" }}>
            The Looking Glass — {STEPS[step]}
          </div>

          <div className="mt-4 min-h-56 flex-1">
            {step === 0 && (
              <div>
                <p className="font-serif text-sm leading-relaxed" style={{ color: "#c9c3b6" }}>
                  The glass does not ask where you came from. Only what the vale should call you.
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 24))}
                    data-testid="look-name"
                    className="w-full rounded-sm border bg-transparent px-3 py-2 font-serif text-lg outline-none"
                    style={{ borderColor: "#3a322c", color: "#ece6d8" }}
                    placeholder="Speak your name"
                  />
                  <button
                    type="button"
                    data-testid="look-dice"
                    title="Let the vale name you"
                    onClick={() => setName(personName(Math.random))}
                    className="rounded-sm border px-3 py-2 text-lg hover:bg-white/5"
                    style={{ borderColor: "#3a322c", color: "#c9a36a" }}
                  >
                    ⚄
                  </button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col gap-2">
                {CLASSES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    data-testid={`look-class-${c}`}
                    onClick={() => {
                      setCls(c);
                      setGarb(CLASS_META[c].color);
                    }}
                    className="flex items-center gap-3 rounded-sm border px-3 py-2 text-left transition-colors hover:bg-white/5"
                    style={{
                      borderColor: cls === c ? CLASS_META[c].color : "#3a322c",
                      background: cls === c ? "rgba(255,255,255,0.04)" : "transparent",
                    }}
                  >
                    <span className="h-4 w-4 shrink-0 rounded-sm" style={{ background: CLASS_META[c].color }} />
                    <span className="font-serif" style={{ color: "#ece6d8" }}>{CLASS_META[c].label}</span>
                    <span className="ml-auto text-xs italic" style={{ color: "#8a8680" }}>{ROLE_HINT[c]}</span>
                  </button>
                ))}
                <p className="mt-2 text-xs italic" style={{ color: "#8a8680" }}>
                  A calling is a beginning, not a cage — the glass will answer again whenever you return.
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-4">
                <SwatchRow title="Skin" swatches={SKIN_TONES} value={skin} onPick={setSkin} testid="look-skin" />
                <div>
                  <div className="mb-1.5 text-xs tracking-[0.2em] uppercase" style={{ color: "#8a8680" }}>Hair</div>
                  <div className="flex flex-wrap gap-2">
                    {HAIR_STYLES.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        title={s.hint}
                        data-testid={`look-hairstyle-${s.id}`}
                        onClick={() => setHairStyle(s.id)}
                        className="rounded-sm border px-3 py-1.5 text-xs hover:bg-white/5"
                        style={{
                          borderColor: hairStyle === s.id ? "#e8b96a" : "#3a322c",
                          color: hairStyle === s.id ? "#ece6d8" : "#8a8680",
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <SwatchRow title="Hair color" swatches={HAIR_COLORS} value={hairColor} onPick={setHairColor} testid="look-haircolor" />
                <SwatchRow title="Garb" swatches={GARB_TINTS} value={garb} onPick={setGarb} testid="look-garb" />
                <div>
                  <div className="mb-1.5 text-xs tracking-[0.2em] uppercase" style={{ color: "#8a8680" }}>Crafted</div>
                  <div className="flex flex-wrap gap-2">
                    {crafted.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        data-testid={`look-part-${p.id}`}
                        title={`${p.name} — ${p.slot}`}
                        onClick={() => setPartIds(partIds.includes(p.id) ? partIds.filter((id) => id !== p.id) : [...partIds, p.id])}
                        className="rounded-sm border px-2.5 py-1.5 text-xs hover:bg-white/5"
                        style={{
                          borderColor: partIds.includes(p.id) ? "#e8b96a" : "#3a322c",
                          color: partIds.includes(p.id) ? "#ece6d8" : "#8a8680",
                        }}
                      >
                        ✦ {p.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      data-testid="look-sculpt"
                      onClick={() => setSculpting(true)}
                      className="rounded-sm border border-dashed px-2.5 py-1.5 text-xs hover:bg-white/5"
                      style={{ borderColor: "#c9a36a", color: "#c9a36a" }}
                    >
                      ⚒ Sculpt new
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-1.5">
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className="h-1.5 w-6 rounded-full"
                  style={{ background: i <= step ? "#e8b96a" : "#3a322c" }}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  type="button"
                  data-testid="look-back"
                  onClick={() => setStep(step - 1)}
                  className="rounded-sm border px-4 py-2 text-sm hover:bg-white/5"
                  style={{ borderColor: "#3a322c", color: "#c9c3b6" }}
                >
                  Back
                </button>
              )}
              <button
                type="button"
                data-testid={last ? "look-done" : "look-next"}
                disabled={!trimmed}
                onClick={() => (last ? finish() : setStep(step + 1))}
                className="rounded-sm border px-4 py-2 font-serif text-sm disabled:opacity-40"
                style={{
                  borderColor: "#e8b96a",
                  color: "#e8b96a",
                  background: "rgba(232,185,106,0.08)",
                  boxShadow: last ? "0 0 16px rgba(232,185,106,0.25)" : "none",
                }}
              >
                {last ? "Step into the vale" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
      {sculpting && (
        <PartSculptor
          onDone={(part) => {
            savePart(part);
            setPartIds((ids) => [...ids, part.id]);
            setCraftVersion((v) => v + 1);
            setSculpting(false);
          }}
          onCancel={() => setSculpting(false)}
        />
      )}
    </div>
  );
}
