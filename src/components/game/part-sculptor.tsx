// The part sculptor — Emberhall's voxel editor for custom figure parts.
// Edit one horizontal layer at a time (an honest 2D grid), watch the 3D
// sculpture grow on the figure. Pure component: the host receives one
// validated VoxelPartV1 (emberhall.part/1) and decides where it lives.
import { useMemo, useState } from "react";
import { GARB_TINTS, HAIR_COLORS, SKIN_TONES, type Swatch } from "@/game/look/catalog.ts";
import {
  PART_GRID,
  PART_MAX_COLORS,
  PART_MAX_VOXELS,
  PART_SCHEMA,
  PART_SLOTS,
  newPartId,
  validatePart,
  type PartSlot,
  type Voxel,
  type VoxelPartV1,
} from "@/game/look/parts.ts";
import { resolveLook } from "@/game/look/resolve.ts";
import { LOOK_SCHEMA } from "@/game/look/types.ts";
import { LookPreview } from "./look-preview";

const PALETTE: readonly Swatch[] = [...HAIR_COLORS, ...GARB_TINTS, ...SKIN_TONES.slice(0, 2)];
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

export function PartSculptor({
  onDone,
  onCancel,
}: {
  onDone: (part: VoxelPartV1) => void;
  onCancel: () => void;
}) {
  const [slot, setSlot] = useState<PartSlot>("hair");
  const [name, setName] = useState("");
  const [voxels, setVoxels] = useState<Map<string, Voxel>>(new Map());
  const [layer, setLayer] = useState(0);
  const [color, setColor] = useState("#a85a42");
  const [erase, setErase] = useState(false);
  const [custom, setCustom] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const colors = useMemo(() => new Set([...voxels.values()].map((v) => v.c)), [voxels]);
  const ghostBelow = useMemo(
    () => new Set([...voxels.values()].filter((v) => v.y === layer - 1).map((v) => key(v.x, v.y, v.z))),
    [voxels, layer],
  );
  const part: VoxelPartV1 = useMemo(
    () => ({
      schema: PART_SCHEMA,
      id: newPartId(),
      name: name.trim(),
      slot,
      voxels: [...voxels.values()],
      createdAt: Date.now(),
    }),
    [name, slot, voxels],
  );

  const poke = (x: number, z: number, forceErase = false) => {
    setVoxels((prev) => {
      const next = new Map(prev);
      const k = key(x, layer, z);
      if (erase || forceErase) next.delete(k);
      else if (next.size < PART_MAX_VOXELS) next.set(k, { x, y: layer, z, c: color });
      return next;
    });
  };

  const save = () => {
    const errs = validatePart(part);
    setErrors(errs);
    if (!errs.length) onDone(part);
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4" data-testid="part-sculptor">
      <div
        className="flex w-full max-w-2xl gap-5 rounded-md border p-5"
        style={{ background: "rgba(20,17,14,0.96)", borderColor: "#3a322c" }}
      >
        <div className="flex flex-1 flex-col gap-3">
          <div className="text-xs tracking-[0.3em] uppercase" style={{ color: "#c9a36a" }}>
            The Sculptor's Bench
          </div>

          <div className="flex gap-2">
            {PART_SLOTS.map((s) => (
              <button
                key={s}
                type="button"
                data-testid={`slot-${s}`}
                onClick={() => setSlot(s)}
                className="rounded-sm border px-2.5 py-1 text-xs capitalize hover:bg-white/5"
                style={{
                  borderColor: slot === s ? "#e8b96a" : "#3a322c",
                  color: slot === s ? "#ece6d8" : "#8a8680",
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* slice editor */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                data-testid="layer-up"
                disabled={layer >= PART_GRID - 1}
                onClick={() => setLayer(layer + 1)}
                className="rounded-sm border px-2 disabled:opacity-30"
                style={{ borderColor: "#3a322c", color: "#c9a36a" }}
              >
                ▲
              </button>
              <span className="text-[10px]" style={{ color: "#8a8680" }} data-testid="layer-label">
                {layer + 1}/{PART_GRID}
              </span>
              <button
                type="button"
                data-testid="layer-down"
                disabled={layer <= 0}
                onClick={() => setLayer(layer - 1)}
                className="rounded-sm border px-2 disabled:opacity-30"
                style={{ borderColor: "#3a322c", color: "#c9a36a" }}
              >
                ▼
              </button>
            </div>
            <div
              className="grid shrink-0 gap-[2px] rounded-sm border p-1"
              style={{ gridTemplateColumns: `repeat(${PART_GRID}, 1fr)`, borderColor: "#2e241c", background: "#14100c" }}
            >
              {Array.from({ length: PART_GRID * PART_GRID }, (_, i) => {
                const x = i % PART_GRID;
                const z = Math.floor(i / PART_GRID);
                const k = key(x, layer, z);
                const v = voxels.get(k);
                const ghost = !v && ghostBelow.has(key(x, layer - 1, z));
                return (
                  <button
                    key={k}
                    type="button"
                    data-testid={`cell-${x}-${z}`}
                    onClick={() => poke(x, z)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      poke(x, z, true);
                    }}
                    className="h-6 w-6 rounded-[2px]"
                    style={{
                      background: v ? v.c : ghost ? "rgba(138,134,128,0.25)" : "#221c16",
                      outline: ghost ? "1px dashed rgba(138,134,128,0.4)" : "none",
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="tool-paint"
              onClick={() => setErase(false)}
              className="rounded-sm border px-2.5 py-1 text-xs"
              style={{ borderColor: !erase ? "#e8b96a" : "#3a322c", color: !erase ? "#ece6d8" : "#8a8680" }}
            >
              ✏ Paint
            </button>
            <button
              type="button"
              data-testid="tool-erase"
              onClick={() => setErase(true)}
              className="rounded-sm border px-2.5 py-1 text-xs"
              style={{ borderColor: erase ? "#e8b96a" : "#3a322c", color: erase ? "#ece6d8" : "#8a8680" }}
            >
              ⌫ Erase
            </button>
            <span className="ml-auto text-[10px]" style={{ color: "#8a8680" }} data-testid="voxel-count">
              {voxels.size}/{PART_MAX_VOXELS} voxels · {colors.size}/{PART_MAX_COLORS} colors
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {PALETTE.map((s) => (
              <button
                key={s.id}
                type="button"
                title={s.label}
                data-testid={`sculpt-swatch-${s.id}`}
                onClick={() => setColor(s.hex)}
                className="h-6 w-6 rounded-sm border transition-transform hover:scale-110"
                style={{
                  background: s.hex,
                  borderColor: color === s.hex ? "#e8b96a" : "#3a322c",
                }}
              />
            ))}
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="#hex"
              data-testid="sculpt-custom"
              className="h-6 w-16 rounded-sm border bg-transparent px-1 text-[10px] outline-none"
              style={{ borderColor: "#3a322c", color: "#ece6d8" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && /^#[0-9a-fA-F]{6}$/.test(custom)) setColor(custom.toLowerCase());
              }}
            />
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 24))}
            placeholder="Name your part"
            data-testid="part-name"
            className="rounded-sm border bg-transparent px-2.5 py-1.5 font-serif text-sm outline-none"
            style={{ borderColor: "#3a322c", color: "#ece6d8" }}
          />

          {errors.length > 0 && (
            <div className="text-xs" style={{ color: "#a85a42" }} data-testid="sculpt-errors">
              {errors[0]}
            </div>
          )}

          <div className="mt-auto flex justify-end gap-2">
            <button
              type="button"
              data-testid="part-cancel"
              onClick={onCancel}
              className="rounded-sm border px-4 py-1.5 text-sm hover:bg-white/5"
              style={{ borderColor: "#3a322c", color: "#c9c3b6" }}
            >
              Set it down
            </button>
            <button
              type="button"
              data-testid="part-save"
              onClick={save}
              className="rounded-sm border px-4 py-1.5 font-serif text-sm"
              style={{ borderColor: "#e8b96a", color: "#e8b96a", background: "rgba(232,185,106,0.08)" }}
            >
              Fire it in the kiln
            </button>
          </div>
        </div>

        {/* live mirror: the part on the figure */}
        <div className="hidden w-48 shrink-0 rounded-sm border sm:block" style={{ borderColor: "#2e241c", background: "#181410" }}>
          <LookPreview look={resolveLook({ schema: LOOK_SCHEMA })} parts={[part]} />
        </div>
      </div>
    </div>
  );
}
