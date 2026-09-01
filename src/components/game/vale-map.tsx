import { useEffect, useRef, type MouseEvent } from "react";
import { MAP, PLACES } from "@/game/atlas";
import { biomeWeights } from "@/game/biome";
import { getWorld } from "@/game/live";
import { commandWalk } from "@/game/player";
import { useGame } from "@/game/store";
import type { TileKind } from "@/game/types";

const KIND_RGB: Record<TileKind, [number, number, number]> = {
  grass: [74, 90, 50],
  dirt: [106, 84, 56],
  cobble: [110, 104, 92],
  road: [138, 112, 80],
  tree: [63, 82, 48],
  rock: [90, 88, 76],
  water: [58, 74, 88],
  sand: [196, 180, 138],
  floor: [90, 74, 58],
  wall: [74, 70, 64],
  step: [122, 106, 88],
  pit: [26, 22, 18],
  snow: [216, 210, 198],
  marsh: [58, 74, 54],
};

const PIX = 256;
const WALK_CAP = 48000;
const JUNGLE: [number, number, number] = [42, 66, 40];
const TAIGA: [number, number, number] = [58, 70, 52];

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function colorAt(tx: number, ty: number): [number, number, number] {
  const w = getWorld();
  const t = w.tiles[ty]?.[tx];
  if (!t) return [20, 16, 14];
  let c = KIND_RGB[t.kind] ?? KIND_RGB.grass;
  const wgt = biomeWeights(tx, ty);
  if (t.kind === "grass" || t.kind === "tree" || t.kind === "dirt") {
    c = mix(c, JUNGLE, wgt.jungle * 0.45);
    c = mix(c, TAIGA, wgt.taiga * 0.4);
    c = mix(c, [216, 210, 198], wgt.tundra * 0.55);
    c = mix(c, [196, 180, 138], wgt.desert * 0.5);
    c = mix(c, [58, 74, 54], wgt.fen * 0.5);
  }
  return c;
}

function paint(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (canvas.width !== PIX) canvas.width = PIX;
  if (canvas.height !== PIX) canvas.height = PIX;
  const img = ctx.createImageData(PIX, PIX);
  const data = img.data;
  const step = MAP / PIX;
  for (let py = 0; py < PIX; py++) {
    for (let px = 0; px < PIX; px++) {
      const tx = Math.min(MAP - 1, Math.floor(px * step));
      const ty = Math.min(MAP - 1, Math.floor(py * step));
      const [r, g, b] = colorAt(tx, ty);
      const i = (py * PIX + px) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function tileFromEvent(el: HTMLElement, clientX: number, clientY: number) {
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  const tx = Math.round(((clientX - r.left) / r.width) * MAP);
  const ty = Math.round(((clientY - r.top) / r.height) * MAP);
  return {
    tx: Math.max(0, Math.min(MAP - 1, tx)),
    ty: Math.max(0, Math.min(MAP - 1, ty)),
  };
}

function nearPlace(tx: number, ty: number, r = 36) {
  let best = null as (typeof PLACES)[number] | null;
  let d = r;
  for (const p of PLACES) {
    const dd = Math.hypot(p.tx - tx, p.ty - ty);
    if (dd < d) {
      d = dd;
      best = p;
    }
  }
  return best;
}

function walkTo(tx: number, ty: number) {
  const place = nearPlace(tx, ty);
  const err = commandWalk(getWorld(), place?.tx ?? tx, place?.ty ?? ty, WALK_CAP);
  if (err) useGame.getState().flash(err);
}

function ChartCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const landKey = useGame((s) => s.snap.landKey);
  useEffect(() => {
    if (ref.current) paint(ref.current);
  }, [landKey]);
  return (
    <canvas
      ref={ref}
      className={className}
      width={PIX}
      height={PIX}
      aria-hidden
    />
  );
}

function Marks({ labels }: { labels?: boolean }) {
  const x = useGame((s) => s.snap.youX);
  const z = useGame((s) => s.snap.youZ);
  const corpse = useGame((s) => s.snap.player?.corpseAt ?? null);
  return (
    <>
      {PLACES.map((p) => (
        <span
          key={p.id}
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${(p.tx / MAP) * 100}%`, top: `${(p.ty / MAP) * 100}%` }}
        >
          <span className="block size-1.5 rounded-full bg-gold" />
          {labels ? (
            <span className="mt-0.5 block whitespace-nowrap font-display text-xs leading-none text-fg">{p.name}</span>
          ) : null}
        </span>
      ))}
      {corpse ? (
        <span
          className="pointer-events-none absolute z-10 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent"
          style={{ left: `${(corpse.tx / MAP) * 100}%`, top: `${(corpse.ty / MAP) * 100}%` }}
        />
      ) : null}
      <span
        className="pointer-events-none absolute z-20 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
        style={{ left: `${(x / MAP) * 100}%`, top: `${(z / MAP) * 100}%` }}
      />
    </>
  );
}

function onChartClick(e: MouseEvent<HTMLDivElement>) {
  const tile = tileFromEvent(e.currentTarget, e.clientX, e.clientY);
  if (!tile) return;
  walkTo(tile.tx, tile.ty);
}

export function MiniVale() {
  return (
    <div
      data-vale-map="mini"
      className="relative size-full cursor-pointer overflow-hidden bg-bg/80"
      title="Tap the land to walk"
      onClick={onChartClick}
    >
      <ChartCanvas className="pointer-events-none size-full" />
      <Marks />
    </div>
  );
}

export function ValeChart() {
  return (
    <div>
      <h2 className="font-display text-sm text-fg">The vale</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted">Tap the land or a name. You walk there.</p>
      <div
        data-vale-map="chart"
        className="relative mt-3 w-full cursor-pointer overflow-hidden rounded-[var(--radius-md)] border border-border bg-bg"
        style={{ aspectRatio: "1 / 1" }}
        title="Tap the land to walk"
        onClick={onChartClick}
      >
        <ChartCanvas className="pointer-events-none size-full" />
        <Marks labels />
      </div>
    </div>
  );
}
