import { canTill, CROP_META } from "@/game/farm";
import { groundY } from "@/game/height";
import { getWorld } from "@/game/live";
import { useGame } from "@/game/store";
import { hitAt, hoverAt, leftAt, liftAt } from "@/game/world-pointer";
import type { CropPlot, Sapling } from "@/game/types";

function Plant({ plot }: { plot: CropPlot }) {
  const y = groundY(getWorld(), plot.tx, plot.ty);
  const intent = useGame((s) => s.snap.player.intent);
  const marked =
    (intent.kind === "plant" || intent.kind === "harvest" || intent.kind === "till") &&
    intent.tx === plot.tx &&
    intent.ty === plot.ty;
  const stage = plot.stage;
  const crop = plot.crop;
  const h = stage <= 1 ? 0.22 : stage === 2 ? 0.44 : 0.7;
  const w = crop === "wheat" ? 0.1 : crop === "garlic" ? 0.2 : 0.34;
  const color = crop ? (marked ? "#e0b56a" : stage >= 3 ? CROP_META[crop].ripe : CROP_META[crop].color) : "#4a3424";
  const frame = marked ? "#c9a36a" : "#6a4a32";
  return (
    <group
      position={[plot.tx, y, plot.ty]}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.button === 2) hitAt(plot.tx, plot.ty, e.clientX, e.clientY);
        else if (e.button === 0) leftAt(plot.tx, plot.ty);
      }}
      onPointerMove={() => hoverAt(plot.tx, plot.ty)}
      onPointerUp={(e) => {
        if (e.button === 0) liftAt(plot.tx, plot.ty);
      }}
    >
      <mesh position={[0, 0.04, 0.42]} receiveShadow>
        <boxGeometry args={[0.92, 0.08, 0.1]} />
        <meshStandardMaterial color={frame} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.04, -0.42]} receiveShadow>
        <boxGeometry args={[0.92, 0.08, 0.1]} />
        <meshStandardMaterial color={frame} roughness={0.9} />
      </mesh>
      <mesh position={[0.42, 0.04, 0]} receiveShadow>
        <boxGeometry args={[0.1, 0.08, 0.84]} />
        <meshStandardMaterial color={frame} roughness={0.9} />
      </mesh>
      <mesh position={[-0.42, 0.04, 0]} receiveShadow>
        <boxGeometry args={[0.1, 0.08, 0.84]} />
        <meshStandardMaterial color={frame} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.07, 0]} receiveShadow>
        <boxGeometry args={[0.78, 0.12, 0.78]} />
        <meshStandardMaterial color={marked ? "#6a4a28" : "#4a3424"} roughness={0.96} />
      </mesh>
      {crop && stage > 0 && (
        <>
          <mesh position={[0, 0.14 + h * 0.5, 0]} castShadow>
            <boxGeometry args={[w, h, crop === "wheat" ? 0.1 : w]} />
            <meshStandardMaterial color={color} roughness={0.82} />
          </mesh>
          {crop === "cabbage" && stage >= 2 && (
            <mesh position={[0, 0.16 + h, 0]} castShadow>
              <boxGeometry args={[w * 1.2, 0.16, w * 1.2]} />
              <meshStandardMaterial color={stage >= 3 ? "#7a9a50" : "#5a7040"} roughness={0.78} />
            </mesh>
          )}
          {crop === "wheat" && stage >= 2 && (
            <>
              <mesh position={[-0.16, 0.14 + h * 0.55, 0.1]} castShadow>
                <boxGeometry args={[0.08, h * 0.95, 0.08]} />
                <meshStandardMaterial color={color} roughness={0.9} />
              </mesh>
              <mesh position={[0.14, 0.14 + h * 0.48, -0.12]} castShadow>
                <boxGeometry args={[0.08, h * 0.85, 0.08]} />
                <meshStandardMaterial color={color} roughness={0.9} />
              </mesh>
              {stage >= 3 && (
                <mesh position={[0, 0.14 + h + 0.06, 0]} castShadow>
                  <boxGeometry args={[0.14, 0.1, 0.14]} />
                  <meshStandardMaterial color="#c9a36a" roughness={0.7} />
                </mesh>
              )}
            </>
          )}
          {crop === "garlic" && stage >= 2 && (
            <mesh position={[0, 0.18, 0]} castShadow>
              <boxGeometry args={[0.22, 0.18, 0.22]} />
              <meshStandardMaterial color={stage >= 3 ? "#ece6d8" : "#c9c3b6"} roughness={0.7} />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}

function TillGhost() {
  const armed = useGame((s) => s.tillArmed);
  const at = useGame((s) => s.tillAt);
  if (!armed || !at) return null;
  const y = groundY(getWorld(), at.tx, at.ty);
  const ok = !canTill(getWorld(), at.tx, at.ty);
  const color = ok ? "#c9a36a" : "#a85a42";
  return (
    <group position={[at.tx, y + 0.06, at.ty]} raycast={() => {}}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.92, 0.92]} />
        <meshBasicMaterial color={color} transparent opacity={0.42} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.04, 0.42]}>
        <boxGeometry args={[0.92, 0.08, 0.1]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.04, -0.42]}>
        <boxGeometry args={[0.92, 0.08, 0.1]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh position={[0.42, 0.04, 0]}>
        <boxGeometry args={[0.1, 0.08, 0.84]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh position={[-0.42, 0.04, 0]}>
        <boxGeometry args={[0.1, 0.08, 0.84]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} />
      </mesh>
    </group>
  );
}

function YoungTree({ sapling }: { sapling: Sapling }) {
  const y = groundY(getWorld(), sapling.tx, sapling.ty);
  const intent = useGame((s) => s.snap.player.intent);
  const marked = intent.kind === "forest" && intent.tx === sapling.tx && intent.ty === sapling.ty;
  const h = sapling.stage === 1 ? 0.28 : sapling.stage === 2 ? 0.55 : 0.9;
  const r = sapling.stage === 1 ? 0.12 : sapling.stage === 2 ? 0.22 : 0.34;
  return (
    <group
      position={[sapling.tx, y, sapling.ty]}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.button === 2) hitAt(sapling.tx, sapling.ty, e.clientX, e.clientY);
        else if (e.button === 0) leftAt(sapling.tx, sapling.ty);
      }}
      onPointerMove={() => hoverAt(sapling.tx, sapling.ty)}
      onPointerUp={(e) => {
        if (e.button === 0) liftAt(sapling.tx, sapling.ty);
      }}
    >
      <mesh position={[0, h * 0.45, 0]} castShadow>
        <boxGeometry args={[0.08, h, 0.08]} />
        <meshStandardMaterial color={marked ? "#c9a36a" : "#6a4a32"} roughness={0.9} />
      </mesh>
      <mesh position={[0, h + r * 0.4, 0]} castShadow>
        <boxGeometry args={[r * 2, r, r * 2]} />
        <meshStandardMaterial color={marked ? "#8aaa58" : "#5a7040"} roughness={0.82} />
      </mesh>
    </group>
  );
}

export function Crops() {
  const plots = useGame((s) => s.snap.plots);
  const saplings = useGame((s) => s.snap.saplings);
  const hour = useGame((s) => s.snap.hour);
  void hour;
  return (
    <group>
      {(plots ?? []).map((p) => (
        <Plant key={p.id} plot={p} />
      ))}
      {(saplings ?? []).map((s) => (
        <YoungTree key={s.id} sapling={s} />
      ))}
      <TillGhost />
    </group>
  );
}
